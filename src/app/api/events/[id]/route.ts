import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { isValidEventTransition, EVENT_VALID_STATUSES } from "@/lib/status-transitions"

export const dynamic = "force-dynamic"

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/events/[id]
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params
  const event = await db.event.findUnique({
    where: { id },
    include: {
      customer: true,
      orders: { include: { customer: true, lineItems: true } },
    },
  })
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 })
  }
  return NextResponse.json({ event })
}

/**
 * PATCH /api/events/[id]
 * Body: { name?, status?, eventDate?, guests?, notes?, customerId?, orderId? (to link) }
 * Special: { linkOrderId: "ORD-1001" } links an order to this event
 * Special: { unlinkOrderId: "ORD-1001" } unlinks an order
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  const { id } = await params
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const existing = await db.event.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 })
  }

  // Handle order linking
  if (body.linkOrderId && typeof body.linkOrderId === "string") {
    await db.order.update({
      where: { orderNumber: body.linkOrderId },
      data: { eventId: id },
    })
  }
  if (body.unlinkOrderId && typeof body.unlinkOrderId === "string") {
    await db.order.update({
      where: { orderNumber: body.unlinkOrderId },
      data: { eventId: null },
    })
  }

  // Update event fields
  const data: Record<string, unknown> = {}
  if (typeof body.name === "string") data.name = body.name
  if (typeof body.status === "string") data.status = body.status
  if (typeof body.notes === "string") data.notes = body.notes
  if (body.customerId !== undefined) data.customerId = body.customerId || null
  if (body.guests !== undefined) data.guests = body.guests || null
  if (body.eventDate !== undefined) {
    data.eventDate = body.eventDate ? new Date(body.eventDate + "T00:00:00") : null
  }

  // Class 6 fix: validate status transition if body.status was set
  if (data.status && typeof data.status === "string") {
    if (!EVENT_VALID_STATUSES.includes(data.status as typeof EVENT_VALID_STATUSES[number])) {
      return NextResponse.json(
        { error: `Invalid status "${data.status}". Valid: ${EVENT_VALID_STATUSES.join(", ")}` },
        { status: 400 },
      )
    }
    const transition = isValidEventTransition(existing.status, data.status as string)
    if (!transition.valid) {
      return NextResponse.json(
        {
          error: transition.reason ?? "Invalid status transition",
          currentStatus: existing.status,
          requestedStatus: data.status,
        },
        { status: 422 },
      )
    }
  }

  if (Object.keys(data).length > 0) {
    await db.event.update({ where: { id }, data })
  }

  const updated = await db.event.findUnique({
    where: { id },
    include: { customer: true, orders: { include: { customer: true, lineItems: true } } },
  })

  return NextResponse.json({ event: updated })
}

/**
 * DELETE /api/events/[id]
 */
export async function DELETE(_request: Request, { params }: RouteParams) {
  const { id } = await params
  try {
    // Unlink orders first
    await db.order.updateMany({ where: { eventId: id }, data: { eventId: null } })
    await db.event.delete({ where: { id } })
    return NextResponse.json({ success: true, id })
  } catch {
    return NextResponse.json({ error: "Event not found" }, { status: 404 })
  }
}
