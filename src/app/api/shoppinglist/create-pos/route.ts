import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { generateSequentialNumber } from "@/lib/sequential-number"

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

  // Validate each item before touching Prisma. If any item has a non-finite
  // or non-positive qtyPacks (e.g. NaN, Infinity serialized as null, undefined,
  // 0, negative), reject with a clear error explaining which material is bad.
  // This catches the unitsPerPack=0 → Infinity → JSON null regression at the
  // API boundary instead of letting it bubble up as an opaque Prisma error.
  const invalidItems: Array<{ sku: string; name: string; qtyPacks: unknown; reason: string }> = []
  for (const item of body.items) {
    const sku = item?.materialSku ?? "(missing sku)"
    const name = item?.materialName ?? "(missing name)"
    const q = item?.qtyPacks
    if (q === null || q === undefined) {
      invalidItems.push({ sku, name, qtyPacks: q, reason: "missing (likely a unitsPerPack=0 Infinity → null in client serialization; the shopping list page has been patched to fall back to 12)" })
    } else if (typeof q !== "number" || !Number.isFinite(q)) {
      invalidItems.push({ sku, name, qtyPacks: q, reason: `not a finite number (got ${typeof q === "number" ? q : typeof q})` })
    } else if (q <= 0) {
      invalidItems.push({ sku, name, qtyPacks: q, reason: `must be > 0 (got ${q})` })
    }
  }
  if (invalidItems.length > 0) {
    return NextResponse.json(
      {
        error: `Invalid items: ${invalidItems.length} item(s) have invalid qtyPacks.`,
        invalidItems,
        hint: "This usually means the material has unitsPerPack=0 in the database. Set unitsPerPack on the Materials page (or accept the fallback of 12 — refresh the shopping list page first).",
      },
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

  // Find the MAX existing PO-NNNN number and start incrementing from there.
  // The /api/purchase-orders/route.ts handler uses the same pattern (find
  // max + increment) for POs created directly via the Procurement tab, so
  // we stay consistent — if a PO was created there and then the Shopping
  // List is used, we won't collide.
  const firstPoNumber = await generateSequentialNumber(db, "purchaseOrder", "poNumber", "PO-", 4)
  const match = /^PO-(\d+)$/.exec(firstPoNumber)
  let poNum = match ? parseInt(match[1], 10) : 1

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
