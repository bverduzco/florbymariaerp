import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { generateSequentialNumber } from "@/lib/sequential-number"

export const dynamic = "force-dynamic"

/**
 * POST /api/ad-hoc-purchases
 * Body: {
 *   vendor, materialSku, qtyPacks, unitCost, ticketNumber?, paymentMethod?, notes?,
 *   resolveMissingPurchaseId?: string  // when resolving a MissingPurchaseLog
 * }
 *
 * Creates a new ad-hoc purchase record. When resolveMissingPurchaseId is
 * provided, the purchase is treated as resolving an inventory discrepancy
 * (materials already consumed by execution/loss). The notes are auto-filled
 * with the discrepancy reference, and the MissingPurchaseLog is resolved.
 * No stock bump occurs — the materials were already used.
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

  const adhocNumber = await generateSequentialNumber(db, "adHocPurchase", "adhocNumber", "ADHOC-", 4)

  // If resolving a missing purchase, auto-fill notes
  let notes = body.notes?.trim() || null
  let missingPurchaseLog: { id: string; triggerRef: string | null; materialName: string; qtyShort: number } | null = null

  if (body.resolveMissingPurchaseId) {
    try {
      missingPurchaseLog = await db.missingPurchaseLog.findUnique({
        where: { id: body.resolveMissingPurchaseId },
        select: { id: true, triggerRef: true, materialName: true, qtyShort: true },
      })
      if (missingPurchaseLog) {
        const resolutionNote = `Resolving inventory discrepancy for ${missingPurchaseLog.triggerRef ?? "execution"}: ${qtyPacks} packs of ${body.materialSku} were used but not in inventory.`
        notes = notes ? `${notes}\n\n${resolutionNote}` : resolutionNote
      }
    } catch {
      // MissingPurchaseLog table might not exist — proceed without resolution
    }
  }

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
        notes,
      },
    })

    // If resolving a missing purchase, mark it as resolved
    if (missingPurchaseLog) {
      try {
        await db.missingPurchaseLog.update({
          where: { id: missingPurchaseLog.id },
          data: {
            resolutionType: "purchase",
            resolvedAt: new Date(),
            resolvedByPo: adhocNumber,
            resolvedNotes: `Resolved via ${adhocNumber}. Materials were already consumed — purchase recorded for financial accuracy.`,
          },
        })
      } catch {
        // Best-effort — the purchase was created, resolution tracking is secondary
      }
    }

    return NextResponse.json({ purchase, resolvedMissingPurchase: !!missingPurchaseLog }, { status: 201 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
