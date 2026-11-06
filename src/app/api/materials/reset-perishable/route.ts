import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { generateSequentialNumber } from "@/lib/sequential-number"

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

  // Find the MAX existing LOSS-NNNN number and start incrementing from there.
  // Calling generateSequentialNumber() once and then manually bumping the
  // counter saves N redundant queries when resetting many materials at once.
  const firstLossNumber = await generateSequentialNumber(db, "loss", "lossNumber", "LOSS-", 4)
  // Parse the numeric suffix so we can increment it locally for subsequent losses.
  const match = /^LOSS-(\d+)$/.exec(firstLossNumber)
  let lossNum = match ? parseInt(match[1], 10) : 1

  // Class 1 fix: wrap the entire batch in $transaction. If any material's
  // loss/stockMovement/update fails mid-loop, ALL changes are rolled back —
  // no partial state where some perishables were zeroed and others weren't.
  //
  // Class 2 fix: stock zeroing now uses atomic update (set to 0 directly
  // instead of computing from current — since we're zeroing regardless of
  // what the current value is, this is equivalent and simpler).
  const created: Array<{ lossNumber: string; materialSku: string; materialName: string; qtyLost: number; costImpact: number }> = []
  let totalPacks = 0
  let totalValue = 0

  await db.$transaction(async (tx) => {
    for (const mat of perishables) {
      const qty = mat.currentStockPacks ?? 0
      const costImpact = (mat.packPrice ?? 0) * qty
      const lossNumber = `LOSS-${String(lossNum).padStart(4, "0")}`
      lossNum++

      // Create Loss record
      await tx.loss.create({
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

      // Create StockMovement (negative) — best-effort
      try {
        await tx.stockMovement.create({
          data: {
            date: new Date(),
            materialSku: mat.sku,
            packs: -qty,
            reason: "loss",
            reference: lossNumber,
            notes: "Auto-created by Reset Perishable Stock",
          },
        })
      } catch {
        // StockMovement table might not exist — silently skip
      }

      // Zero out the material's stock
      await tx.material.update({
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
  })

  return NextResponse.json({
    message: `${perishables.length} perishable materials reset.`,
    affected: perishables.length,
    totalPacks,
    totalValue,
    losses: created,
  }, { status: 201 })
}
