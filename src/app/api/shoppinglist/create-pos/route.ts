import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

/**
 * POST /api/shoppinglist/create-pos
 * Body: { items: [{ materialSku, qtyPacks, costPerPack, supplier, materialName }] }
 *
 * Takes the shopping list items (grouped by supplier already by the client)
 * and creates one Purchase Order per supplier with PurchaseOrderLine entries.
 * Returns the created PO numbers.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null)

  if (!body?.items || !Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json(
      { error: "Missing items array" },
      { status: 400 }
    )
  }

  // Group items by supplier
  const bySupplier = new Map<string, Array<{
    materialSku: string
    materialName: string
    qtyPacks: number
    costPerPack: number
  }>>()

  for (const item of body.items) {
    const supplier = item.supplier || "Unassigned"
    if (!bySupplier.has(supplier)) bySupplier.set(supplier, [])
    bySupplier.get(supplier)!.push({
      materialSku: item.materialSku,
      materialName: item.materialName,
      qtyPacks: item.qtyPacks,
      costPerPack: item.costPerPack,
    })
  }

  // Get current PO count for numbering
  const poCount = await db.purchaseOrder.count()
  let poNum = poCount + 1

  const createdPOs: Array<{ poNumber: string; supplier: string; lineCount: number; total: number }> = []

  try {
    for (const [supplier, items] of bySupplier) {
      const poNumber = `PO-${String(poNum).padStart(4, "0")}`
      poNum++

      const totalCost = items.reduce((s, i) => s + i.qtyPacks * i.costPerPack, 0)

      const po = await db.purchaseOrder.create({
        data: {
          poNumber,
          supplier,
          status: "draft",
          totalCost,
          notes: `Auto-generated from Shopping List`,
          lines: {
            create: items.map((item) => ({
              materialSku: item.materialSku,
              materialName: item.materialName,
              qtyPacks: item.qtyPacks,
              costPerPack: item.costPerPack,
              lineTotal: item.qtyPacks * item.costPerPack,
            })),
          },
        },
      })

      createdPOs.push({
        poNumber: po.poNumber,
        supplier,
        lineCount: items.length,
        total: totalCost,
      })
    }

    return NextResponse.json({
      created: createdPOs,
      count: createdPOs.length,
      totalCost: createdPOs.reduce((s, p) => s + p.total, 0),
    }, { status: 201 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
