import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

/**
 * POST /api/ad-hoc-purchases
 * Body: { vendor, materialSku, qtyPacks, unitCost, ticketNumber?, paymentMethod?, notes? }
 * Creates a new ad-hoc purchase record.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body?.vendor || !body?.materialSku || !body?.qtyPacks || !body?.unitCost) {
    return NextResponse.json(
      { error: "Missing required fields: vendor, materialSku, qtyPacks, unitCost" },
      { status: 400 }
    )
  }

  const material = await db.material.findUnique({ where: { sku: body.materialSku } })
  if (!material) {
    return NextResponse.json({ error: "Material not found" }, { status: 404 })
  }

  const qtyPacks = Number(body.qtyPacks)
  const unitCost = Number(body.unitCost)
  const total = qtyPacks * unitCost

  const count = await db.adHocPurchase.count()
  const adhocNumber = `ADHOC-${String(count + 1).padStart(4, "0")}`

  try {
    const purchase = await db.adHocPurchase.create({
      data: {
        adhocNumber,
        date: new Date(),
        vendor: body.vendor.trim(),
        materialSku: body.materialSku,
        qtyPacks,
        unitCost,
        total,
        ticketNumber: body.ticketNumber?.trim() || null,
        paymentMethod: body.paymentMethod || null,
        notes: body.notes?.trim() || null,
      },
    })
    return NextResponse.json({ purchase }, { status: 201 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
