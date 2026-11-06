import { NextResponse } from "next/server"
import { parseDateAsGMTMinus6 } from "@/lib/date-helpers"
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
    data.eventDate = body.eventDate ? parseDateAsGMTMinus6(body.eventDate as string) as Date : null
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
 *
 * Class 8 fix: checks for dependent records before deleting.
 * Pass ?force=true to delete anyway (unlinks orders first, then deletes).
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  const { id } = await params
  const url = new URL(request.url)
  const force = url.searchParams.get("force") === "true"

  const existing = await db.event.findUnique({ where: { id }, select: { id: true } })
  if (!existing) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 })
  }

  // Check for dependent records
  const [orderCount, eventLineItemCount, quoteCount] = await Promise.all([
    db.order.count({ where: { eventId: id } }),
    db.eventLineItem.count({ where: { eventId: id } }),
    db.quote.count({ where: { eventId: id } }),
  ])

  const dependents: string[] = []
  if (orderCount > 0) dependents.push(`${orderCount} Order(s)`)
  if (eventLineItemCount > 0) dependents.push(`${eventLineItemCount} EventLineItem(s)`)
  if (quoteCount > 0) dependents.push(`${quoteCount} Quote(s)`)

  if (dependents.length > 0 && !force) {
    return NextResponse.json(
      {
        error: `Cannot delete event: ${dependents.join(", ")} reference it.`,
        dependents,
        hint: "Pass ?force=true to unlink orders/quotes and delete anyway.",
      },
      { status: 422 }
    )
  }

  try {
    // Unlink orders and quotes first (both have eventId as FK with SetNull)
    if (force || orderCount > 0) {
      await db.order.updateMany({ where: { eventId: id }, data: { eventId: null } })
    }
    if (force || quoteCount > 0) {
      await db.quote.updateMany({ where: { eventId: id }, data: { eventId: null } })
    }
    await db.event.delete({ where: { id } })
    return NextResponse.json({ success: true, id })
  } catch {
    return NextResponse.json({ error: "Event not found" }, { status: 404 })
  }
}
