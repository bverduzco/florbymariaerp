import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { isValidOrderTransition, ORDER_VALID_STATUSES } from "@/lib/status-transitions"

export const dynamic = "force-dynamic"

/**
 * PATCH /api/orders/[id]/status
 * Body: { status: string }
 *
 * Updates an order's status. Validates that the transition is allowed
 * per the canonical pipeline (Class 6 fix):
 *   draft → quote_sent → awaiting_payment → payment_confirmed →
 *   procuring → producing → delivered → fulfilled
 *
 *   - Cancellation ("cancelled") is allowed from any non-terminal state.
 *   - Forward skips are allowed (e.g. draft → delivered for quick orders).
 *   - Backward transitions are NOT allowed (e.g. fulfilled → draft).
 *   - Terminal states (fulfilled, cancelled) are locked.
 *
 * The auto-timestamp logic (deliveredAt, fulfilledAt, etc.) is preserved.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json().catch(() => null)

  if (!body?.status) {
    return NextResponse.json({ error: "Missing field: status" }, { status: 400 })
  }

  // Validate the target status is a recognized value
  if (!ORDER_VALID_STATUSES.includes(body.status)) {
    return NextResponse.json(
      { error: `Invalid status. Valid: ${ORDER_VALID_STATUSES.join(", ")}` },
      { status: 400 }
    )
  }

  // Class 6 fix: fetch the current status and validate the transition
  const existing = await db.order.findUnique({
    where: { id },
    select: { status: true },
  })
  if (!existing) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 })
  }

  const transition = isValidOrderTransition(existing.status, body.status)
  if (!transition.valid) {
    return NextResponse.json(
      {
        error: transition.reason ?? "Invalid status transition",
        currentStatus: existing.status,
        requestedStatus: body.status,
      },
      { status: 422 }
    )
  }

  try {
    const data: Record<string, string | Date | null> = { status: body.status }

    // Auto-set timestamps based on status
    if (body.status === "delivered") data.deliveredAt = new Date()
    if (body.status === "fulfilled") data.fulfilledAt = new Date()
    if (body.status === "cancelled") data.cancelledAt = new Date()
    if (body.status === "payment_confirmed") data.paymentConfirmedAt = new Date()

    const order = await db.order.update({ where: { id }, data })
    return NextResponse.json({ order })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
