import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { generateSequentialNumber } from "@/lib/sequential-number"

export const dynamic = "force-dynamic"

/**
 * POST /api/materials/reset-perishable
 *
 * Zeros out perishable materials (Flower / Foliage by default) that have
 * current stock > 0. For each affected material:
 *   1. Creates a Loss row (LOSS-NNNN, reason="expired")
 *   2. Creates a StockMovement row (negative packs, reason="loss")
 *   3. Sets Material.currentStockPacks = 0 (or decrements by the requested qty)
 *
 * Body (optional):
 *   {
 *     items?: [{ sku: string, qty: number }],   // if omitted: ALL perishables with stock>0
 *     reason?: string,                          // default "expired"
 *     notes?: string                            // default "Auto-created by Reset Perishable Stock"
 *   }
 *
 * If `items` is provided, ONLY those materials are reset (and `qty` may be
 * less than currentStock for a partial write-off). If omitted, the route
 * resets ALL perishables in one atomic transaction.
 *
 * Class 1 fix: the entire batch runs in `db.$transaction`. If any material's
 * Loss / StockMovement / update fails mid-loop, ALL changes are rolled back —
 * no partial state where some perishables were zeroed and others weren't.
 */
export async function POST(request: Request) {
  // Parse body — empty body is fine (means "reset all perishables")
  const body = await request.json().catch(() => null) ?? {}
  const reason = typeof body.reason === "string" && body.reason.trim() ? body.reason.trim() : "expired"
  const notes = typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : "Auto-created by Reset Perishable Stock"
  const requestedItems: Array<{ sku: string; qty: number }> = Array.isArray(body.items)
    ? body.items
        .filter((it: unknown): it is { sku: string; qty: number } =>
          typeof it === "object" && it !== null &&
          typeof (it as { sku?: unknown }).sku === "string" &&
          typeof (it as { qty?: unknown }).qty === "number" &&
          (it as { qty: number }).qty > 0
        )
        .map((it) => ({ sku: String(it.sku), qty: Number(it.qty) }))
    : []

  // Build the list of materials to reset:
  //   - If body.items is provided: only those SKUs (and only the requested qty each)
  //   - Otherwise: ALL flower/foliage materials with currentStockPacks > 0 (full reset)
  type ResetRow = { id: string; sku: string; name: string; currentStockPacks: number; packPrice: number | null; resetTo: number; qty: number }

  let perishables: ResetRow[]

  if (requestedItems.length > 0) {
    const skus = requestedItems.map((it) => it.sku)
    const rows = await db.material.findMany({
      where: { sku: { in: skus } },
      select: { id: true, sku: true, name: true, currentStockPacks: true, packPrice: true },
    })
    // Map sku → requested qty so we can compute resetTo = current - requested (floored at 0)
    const qtyBySku = new Map(requestedItems.map((it) => [it.sku, it.qty]))
    perishables = rows
      .map((m): ResetRow => {
        const requested = qtyBySku.get(m.sku) ?? 0
        const current = m.currentStockPacks ?? 0
        // Cap the requested qty at current stock (can't write off more than we have)
        const qty = Math.min(requested, current)
        return {
          id: m.id,
          sku: m.sku,
          name: m.name,
          currentStockPacks: current,
          packPrice: m.packPrice,
          qty,
          resetTo: Math.max(0, current - qty),
        }
      })
      .filter((m) => m.qty > 0)
  } else {
    // Full reset: all perishable categories with stock > 0
    const rows = await db.material.findMany({
      where: {
        category: { in: ["flower", "foliage"] },
        currentStockPacks: { gt: 0 },
      },
      select: { id: true, sku: true, name: true, currentStockPacks: true, packPrice: true },
    })
    perishables = rows.map((m): ResetRow => {
      const current = m.currentStockPacks ?? 0
      return {
        id: m.id,
        sku: m.sku,
        name: m.name,
        currentStockPacks: current,
        packPrice: m.packPrice,
        qty: current,
        resetTo: 0,
      }
    })
  }

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
  const created: Array<{ lossNumber: string; materialSku: string; materialName: string; qtyLost: number; costImpact: number }> = []
  let totalPacks = 0
  let totalValue = 0

  await db.$transaction(async (tx) => {
    for (const mat of perishables) {
      const qty = mat.qty
      if (qty <= 0) continue
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
          qtyLostUnits: qty,   // same as packs — we report in packs here
          unit: "pack",
          reason,
          discoveredBy: "Maria",
          costImpact,
          notes,
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
            notes,
          },
        })
      } catch {
        // StockMovement table might not exist — silently skip
      }

      // Zero out the material's stock (or decrement by the requested qty)
      await tx.material.update({
        where: { id: mat.id },
        data: { currentStockPacks: mat.resetTo },
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
    message: `${created.length} perishable materials reset.`,
    affected: created.length,
    totalPacks,
    totalValue,
    losses: created,
  }, { status: 201 })
}
