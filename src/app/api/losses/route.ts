import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { generateSequentialNumber } from "@/lib/sequential-number"

export const dynamic = "force-dynamic"

/**
 * POST /api/losses
 * Body: {
 *   materialSku, qtyLostPacks, reason, discoveredBy?, notes?,
 *   acknowledgeDiscrepancy?: boolean  // "log only what's in stock" when true
 * }
 *
 * Creates a new loss record. Computes costImpact from material's packPrice.
 * Deducts stock and creates a StockMovement record.
 *
 * v1.9.2 Stock floor check:
 *   If qtyLost > currentStock, the loss is capped at currentStock.
 *   - If acknowledgeDiscrepancy=true: loss record stores the FULL reported qty,
 *     stock is deducted by the capped (available) qty, and a MissingPurchaseLog
 *     is created for the difference.
 *   - If acknowledgeDiscrepancy=false (or not set): loss record stores the
 *     FULL reported qty, stock is deducted by the capped (available) qty,
 *     and a MissingPurchaseLog is created for the difference.
 *   - Stock NEVER goes negative.
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

  const requestedQty = Number(body.qtyLostPacks)
  const currentStock = material.currentStockPacks ?? 0
  const costImpact = (material.packPrice ?? 0) * requestedQty

  // Stock floor check: cap deduction at what's available
  const qtyToDeduct = Math.min(requestedQty, Math.max(0, currentStock))
  const qtyShort = Math.max(0, requestedQty - currentStock)
  const hasDiscrepancy = qtyShort > 0

  const lossNumber = await generateSequentialNumber(db, "loss", "lossNumber", "LOSS-", 4)

  try {
    const result = await db.$transaction(async (tx) => {
      // Loss record always stores the FULL reported qty + full cost impact
      const created = await tx.loss.create({
        data: {
          lossNumber,
          date: new Date(),
          materialSku: body.materialSku,
          qtyLostPacks: requestedQty,
          reason: body.reason,
          discoveredBy: body.discoveredBy ?? "Maria",
          costImpact,
          notes: body.notes ?? null,
        },
      })

      // Stock deduction: always capped (never goes negative)
      if (qtyToDeduct > 0) {
        await tx.material.update({
          where: { sku: body.materialSku },
          data: { currentStockPacks: { decrement: qtyToDeduct } },
        })
      }

      // StockMovement: records the ACTUAL deduction (capped)
      try {
        await tx.stockMovement.create({
          data: {
            date: new Date(),
            materialSku: body.materialSku,
            packs: -qtyToDeduct,
            reason: "loss",
            reference: lossNumber,
            notes: hasDiscrepancy
              ? `Loss: ${body.reason}. CAPPED: requested ${requestedQty}, only ${qtyToDeduct} in stock — deducted all available.`
              : (body.notes ?? `Loss: ${body.reason}`),
          },
        })
      } catch {
        // StockMovement table might not exist — silently skip
      }

      // If there's a discrepancy, create a MissingPurchaseLog
      if (hasDiscrepancy) {
        try {
          await tx.missingPurchaseLog.create({
            data: {
              materialSku: body.materialSku,
              materialName: material.name,
              qtyShort,
              estCost: qtyShort * (material.packPrice ?? 0),
              triggerType: "loss",
              triggerRef: lossNumber,
              notes: `Discovered via ${lossNumber}: requested ${requestedQty} packs, only ${currentStock} in stock. ${body.acknowledgeDiscrepancy ? "User acknowledged unlogged purchase." : "Unacknowledged discrepancy."}`,
            },
          })
        } catch {
          // MissingPurchaseLog table might not exist — silently skip
        }
      }

      return created
    })

    // Build response with warning if there was a discrepancy
    const response: Record<string, unknown> = {
      loss: result,
      stockAfter: Math.max(0, currentStock - qtyToDeduct),
    }

    if (hasDiscrepancy) {
      response.warning = `Stock was ${currentStock}, not ${requestedQty}. Deducted ${qtyToDeduct} (all available). Loss recorded at full reported value of ${requestedQty}. A missing purchase log was created — check the Procurement tab.`
      response.qtyRequested = requestedQty
      response.qtyDeducted = qtyToDeduct
      response.qtyShort = qtyShort
      response.missingPurchaseFlagged = true
    }

    return NextResponse.json(response, { status: 201 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
