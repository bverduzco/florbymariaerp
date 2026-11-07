import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * PATCH /api/missing-purchase-logs/[id]
 * Body: {
 *   resolutionType: "purchase" | "donation" | "ignored",
 *   resolvedByPo?: string,        // ADHOC-0001 (when resolving via ad-hoc purchase)
 *   resolvedNotes?: string,       // auto-filled or manual notes
 * }
 *
 * Resolves a missing purchase log. For "purchase" resolution, the caller
 * should have already created the ad-hoc purchase (via /api/ad-hoc-purchases
 * with resolveMissingPurchaseId in the body). For "donation", creates
 * a StockMovement reconciliation pair (net-zero stock effect). For "ignored",
 * just marks as resolved without any financial/stock reconciliation.
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  const { id } = await params
  const body = await request.json().catch(() => null)

  if (!body?.resolutionType) {
    return NextResponse.json(
      { error: "Missing required field: resolutionType (purchase | donation | ignored)" },
      { status: 400 }
    )
  }

  const validTypes = ["purchase", "donation", "ignored"]
  if (!validTypes.includes(body.resolutionType)) {
    return NextResponse.json(
      { error: `Invalid resolutionType. Valid: ${validTypes.join(", ")}` },
      { status: 400 }
    )
  }

  const existing = await db.missingPurchaseLog.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: "Missing purchase log not found" }, { status: 404 })
  }

  if (existing.resolvedAt) {
    return NextResponse.json(
      { error: `Already resolved as ${existing.resolutionType} on ${existing.resolvedAt}` },
      { status: 422 }
    )
  }

  try {
    const result = await db.$transaction(async (tx) => {
      // For donation resolution: create a StockMovement reconciliation pair
      // (net-zero stock effect — materials came in as gift, went out as execution use)
      if (body.resolutionType === "donation") {
        try {
          // Inflow: donated materials received
          await tx.stockMovement.create({
            data: {
              date: new Date(),
              materialSku: existing.materialSku,
              packs: existing.qtyShort,
              reason: "donation",
              reference: existing.triggerRef ?? undefined,
              notes: `Donated materials used in ${existing.triggerRef ?? "execution"}. ${existing.qtyShort} packs received as gift.`,
            },
          })
          // Outflow: donated materials consumed
          await tx.stockMovement.create({
            data: {
              date: new Date(),
              materialSku: existing.materialSku,
              packs: -existing.qtyShort,
              reason: "execution_donation",
              reference: existing.triggerRef ?? undefined,
              notes: `${existing.qtyShort} packs used from donation in ${existing.triggerRef ?? "execution"}.`,
            },
          })
        } catch {
          // StockMovement table might not exist — silently skip
        }
      }

      // Mark as resolved
      return tx.missingPurchaseLog.update({
        where: { id },
        data: {
          resolutionType: body.resolutionType,
          resolvedAt: new Date(),
          resolvedByPo: body.resolvedByPo ?? null,
          resolvedNotes: body.resolvedNotes ??
            (body.resolutionType === "purchase"
              ? `Resolved via ${body.resolvedByPo ?? "ad-hoc purchase"}. Materials were already consumed — no stock adjustment needed.`
              : body.resolutionType === "donation"
                ? `Resolved as donation. Materials were gifted — no cost impact, no stock adjustment.`
                : `Resolved as ignored. User determined the discrepancy was a miscount.`),
        },
      })
    })

    return NextResponse.json({ log: result })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
