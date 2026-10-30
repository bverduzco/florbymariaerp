import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

/**
 * POST /api/materials/reset-perishable
 *
 * Zeros out all Flower and Foliage materials that have current stock > 0.
 * For each affected material:
 *   1. Creates a Loss row (LOSS-NNNN, reason="expired", qty=current stock)
 *   2. Creates a StockMovement row (negative packs, reason="loss")
 *   3. Sets Material.currentStockPacks = 0
 *
 * Does NOT affect: packaging, consumables, tools.
 */
export async function POST() {
  // Find all perishable materials with stock > 0
  const perishables = await db.material.findMany({
    where: {
      category: { in: ["flower", "foliage"] },
      currentStockPacks: { gt: 0 },
    },
    select: { id: true, sku: true, name: true, currentStockPacks: true, packPrice: true },
  })

  if (perishables.length === 0) {
    return NextResponse.json({
      message: "No perishable stock to reset.",
      affected: 0,
      totalPacks: 0,
      totalValue: 0,
      losses: [],
    })
  }

  // Get current loss count for numbering
  const lossCount = await db.loss.count()
  let lossNum = lossCount + 1

  const created: Array<{ lossNumber: string; materialSku: string; materialName: string; qtyLost: number; costImpact: number }> = []
  let totalPacks = 0
  let totalValue = 0

  for (const mat of perishables) {
    const qty = mat.currentStockPacks ?? 0
    const costImpact = (mat.packPrice ?? 0) * qty
    const lossNumber = `LOSS-${String(lossNum).padStart(4, "0")}`
    lossNum++

    // Create Loss record
    await db.loss.create({
      data: {
        lossNumber,
        date: new Date(),
        materialSku: mat.sku,
        qtyLostPacks: qty,
        reason: "expired",
        discoveredBy: "Maria",
        costImpact,
        notes: "Auto-created by Reset Perishable Stock",
      },
    })

    // Create StockMovement (negative)
    await db.stockMovement.create({
      data: {
        date: new Date(),
        materialSku: mat.sku,
        packs: -qty,
        reason: "loss",
        reference: lossNumber,
        notes: "Auto-created by Reset Perishable Stock",
      },
    })

    // Zero out the material's stock
    await db.material.update({
      where: { id: mat.id },
      data: { currentStockPacks: 0 },
    })

    created.push({
      lossNumber,
      materialSku: mat.sku,
      materialName: mat.name,
      qtyLost: qty,
      costImpact,
    })

    totalPacks += qty
    totalValue += costImpact
  }

  return NextResponse.json({
    message: `${perishables.length} perishable materials reset.`,
    affected: perishables.length,
    totalPacks,
    totalValue,
    losses: created,
  }, { status: 201 })
}
