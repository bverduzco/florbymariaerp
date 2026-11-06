import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { serializeOrder } from "../route"
import { isValidOrderTransition, ORDER_VALID_STATUSES } from "@/lib/status-transitions"

export const dynamic = "force-dynamic"

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/orders/[id]
 * Returns a single order with customer + line items.
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params
  const order = await db.order.findUnique({
    where: { id },
    include: { customer: true, event: true, lineItems: true },
  })
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 })
  }
  return NextResponse.json({ order: serializeOrder(order) })
}

/**
 * PATCH /api/orders/[id]
 * Updates any field on the order. Common use cases:
 *   - status change (advance the sales pipeline)
 *   - payment status change (mark payment confirmed)
 *   - deliveryFee / discount edits
 *   - quoteSentAt, paymentOptionsSentAt, paymentConfirmedAt timestamps
 *
 * Body is a partial Order object — only fields you want to change.
 *
 * Special: passing `advancePipeline: true` advances status by one step
 * using the canonical pipeline:
 *   draft → quote_sent → awaiting_payment → payment_confirmed →
 *   procuring → producing → delivered → fulfilled
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  const { id } = await params
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  // Look up existing order (to validate pipeline transitions)
  const existing = await db.order.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 })
  }

  // Build update payload from allowed fields
  const allowedFields = [
    "status", "deliveryAddress", "cardMessage", "deliveryNotes", "internalNotes",
    "deliveryFee", "discount", "eventId",
    "quoteSentVia", "paymentMethod", "paymentInstructionsSent",
    "paymentStatus", "paymentAmount", "paymentReference",
  ]

  const data: Record<string, unknown> = {}
  for (const key of allowedFields) {
    if (key in body) data[key] = body[key]
  }

  // Class 6 fix: validate status transition if body.status was set directly.
  // (The advancePipeline and cancel paths below do their own validation.)
  // This catches raw `status: "X"` in the body from bypassing the pipeline rules.
  if (data.status && typeof data.status === "string" && !body.advancePipeline && !body.cancel) {
    if (!ORDER_VALID_STATUSES.includes(data.status as typeof ORDER_VALID_STATUSES[number])) {
      return NextResponse.json(
        { error: `Invalid status "${data.status}". Valid: ${ORDER_VALID_STATUSES.join(", ")}` },
        { status: 400 },
      )
    }
    const transition = isValidOrderTransition(existing.status, data.status as string)
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

    // Auto-set timestamps for direct status changes (same as /status endpoint)
    if (data.status === "delivered" && !data.deliveredAt) data.deliveredAt = new Date()
    if (data.status === "fulfilled" && !data.fulfilledAt) data.fulfilledAt = new Date()
    if (data.status === "cancelled" && !data.cancelledAt) data.cancelledAt = new Date()
    if (data.status === "payment_confirmed" && !data.paymentConfirmedAt) data.paymentConfirmedAt = new Date()
  }

  // Handle date fields (ISO string → Date object)
  const dateFields = [
    "deliveryDate", "quoteSentAt", "paymentOptionsSentAt", "paymentConfirmedAt",
    "procurementStartedAt", "producedAt", "deliveredAt", "fulfilledAt", "cancelledAt",
  ]
  for (const key of dateFields) {
    if (key in body) {
      const val = body[key]
      if (val === null || val === "") {
        data[key] = null
      } else if (typeof val === "string") {
        data[key] = new Date(val)
      }
    }
  }

  // Convenience: advancePipeline
  if (body.advancePipeline === true) {
    const pipeline = [
      "draft", "quote_sent", "awaiting_payment", "payment_confirmed",
      "procuring", "producing", "delivered", "fulfilled",
    ]
    const currentIdx = pipeline.indexOf(existing.status)
    if (currentIdx === -1) {
      return NextResponse.json(
        { error: `Cannot advance — current status "${existing.status}" not in canonical pipeline` },
        { status: 400 },
      )
    }
    if (currentIdx >= pipeline.length - 1) {
      return NextResponse.json(
        { error: "Order is already at the final pipeline stage (fulfilled)" },
        { status: 400 },
      )
    }
    data.status = pipeline[currentIdx + 1]
    // Auto-fill relevant timestamps
    const nextStatus = data.status as string
    if (nextStatus === "quote_sent" && !data.quoteSentAt) {
      data.quoteSentAt = new Date()
    } else if (nextStatus === "awaiting_payment" && !data.paymentOptionsSentAt) {
      data.paymentOptionsSentAt = new Date()
    } else if (nextStatus === "payment_confirmed") {
      if (!data.paymentConfirmedAt) data.paymentConfirmedAt = new Date()
      if (existing.paymentStatus !== "confirmed") data.paymentStatus = "confirmed"
    } else if (nextStatus === "procuring" && !data.procurementStartedAt) {
      data.procurementStartedAt = new Date()
    } else if (nextStatus === "producing" && !data.producedAt) {
      data.producedAt = new Date()
    } else if (nextStatus === "delivered" && !data.deliveredAt) {
      data.deliveredAt = new Date()
    } else if (nextStatus === "fulfilled" && !data.fulfilledAt) {
      data.fulfilledAt = new Date()
    }
  }

  // Convenience: cancelOrder
  if (body.cancel === true && existing.status !== "cancelled") {
    data.status = "cancelled"
    data.cancelledAt = new Date()
  }

  try {
    const updated = await db.order.update({
      where: { id },
      data,
      include: { customer: true, event: true, lineItems: true },
    })
    return NextResponse.json({ order: serializeOrder(updated) })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: "Failed to update order", detail: msg }, { status: 500 })
  }
}

/**
 * DELETE /api/orders/[id]
 * Permanently deletes the order and its line items (cascade).
 *
 * Class 8 fix: checks for dependent records before deleting.
 * If the order has Payments, ExecutionLogs, or linked Quotes, returns 422
 * with a list of what's blocking the delete.
 * Pass ?force=true to delete anyway (clears links first, then deletes).
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  const { id } = await params
  const url = new URL(request.url)
  const force = url.searchParams.get("force") === "true"

  const existing = await db.order.findUnique({ where: { id }, select: { id: true } })
  if (!existing) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 })
  }

  // Check for dependent records
  const [paymentCount, executionLogCount, quoteCount] = await Promise.all([
    db.payment.count({ where: { linkedId: id } }),
    db.executionLog.count({ where: { orderId: id } }),
    db.quote.count({ where: { orderId: id } }),
  ])

  const dependents: string[] = []
  if (paymentCount > 0) dependents.push(`${paymentCount} Payment(s)`)
  if (executionLogCount > 0) dependents.push(`${executionLogCount} ExecutionLog(s)`)
  if (quoteCount > 0) dependents.push(`${quoteCount} Quote(s)`)

  if (dependents.length > 0 && !force) {
    return NextResponse.json(
      {
        error: `Cannot delete order: ${dependents.join(", ")} reference it.`,
        dependents,
        hint: "Pass ?force=true to clear links and delete anyway.",
      },
      { status: 422 }
    )
  }

  try {
    // If force, clear links first
    if (force) {
      await db.payment.updateMany({ where: { linkedId: id }, data: { linkedId: null } })
      await db.executionLog.updateMany({ where: { orderId: id }, data: { orderId: null } })
      await db.quote.updateMany({ where: { orderId: id }, data: { orderId: null } })
    }

    await db.order.delete({ where: { id } })
    return NextResponse.json({ success: true, id })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: "Failed to delete order", detail: msg }, { status: 500 })
  }
}
