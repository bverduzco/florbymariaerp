import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { generateSequentialNumber } from "@/lib/sequential-number"

export const dynamic = "force-dynamic"

/**
 * POST /api/losses
 * Body: { materialSku, qtyLostPacks, reason, discoveredBy?, notes? }
 * Creates a new loss record. Computes costImpact from material's packPrice.
 *
 * v1.9: Also deducts qtyLostPacks from Material.currentStockPacks
 * and creates a StockMovement record.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body?.materialSku || !body?.qtyLostPacks || !body?.reason) {
    return NextResponse.json(
      { error: "Missing required fields: materialSku, qtyLostPacks, reason" },
      { status: 400 }
    )
  }

  // Fetch material to compute cost impact + get current stock
  const material = await db.material.findUnique({
    where: { sku: body.materialSku },
    select: { packPrice: true, name: true, currentStockPacks: true },
  })
  if (!material) {
    return NextResponse.json({ error: "Material not found" }, { status: 404 })
  }

  const qtyLost = Number(body.qtyLostPacks)
  const costImpact = (material.packPrice ?? 0) * qtyLost

  const lossNumber = await generateSequentialNumber(db, "loss", "lossNumber", "LOSS-", 4)

  try {
    const loss = await db.loss.create({
      data: {
        lossNumber,
        date: new Date(),
        materialSku: body.materialSku,
        qtyLostPacks: qtyLost,
        reason: body.reason,
        discoveredBy: body.discoveredBy ?? "Maria",
        costImpact,
        notes: body.notes ?? null,
      },
    })

    // v1.9: Deduct from material stock
    const currentStock = material.currentStockPacks ?? 0
    const newStock = Math.max(0, currentStock - qtyLost)

    await db.material.update({
      where: { sku: body.materialSku },
      data: { currentStockPacks: newStock },
    })

    await db.stockMovement.create({
      data: {
        date: new Date(),
        materialSku: body.materialSku,
        packs: -qtyLost,
        reason: "loss",
        reference: lossNumber,
        notes: body.notes ?? `Loss: ${body.reason}`,
      },
    }).catch(() => {
      // StockMovement table might not exist — silently skip
    })

    return NextResponse.json({ loss, stockAfter: newStock }, { status: 201 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
