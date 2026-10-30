import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

/**
 * PATCH /api/orders/[id]/status
 * Body: { status: string }
 * Updates an order's status.
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

  const validStatuses = [
    "draft", "quote_sent", "awaiting_payment", "payment_confirmed",
    "procuring", "producing", "delivered", "fulfilled", "cancelled",
  ]
  if (!validStatuses.includes(body.status)) {
    return NextResponse.json(
      { error: `Invalid status. Valid: ${validStatuses.join(", ")}` },
      { status: 400 }
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
