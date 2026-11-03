import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * PATCH /api/quotes/[id]
 * Body: { status?, lostReason?, orderId? }
 *
 * Updates a quote's status (and optionally lost reason / linked order).
 *
 * v1.9: `orderId` is the new proper FK (references Order.id).
 * Legacy `linkedOrderId` (loose string = Order.orderNumber) is still accepted
 * for backward compatibility — if provided, the endpoint translates it to
 * orderId by looking up the Order. New clients should send orderId directly.
 *
 * If both `orderId` and `linkedOrderId` are sent, `orderId` wins.
 *
 * If `orderId` points to a non-existent Order, returns 404.
 * If `linkedOrderId` is sent but no Order matches that orderNumber, returns 404.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json().catch(() => null)

  if (
    !body ||
    (!body.status &&
      body.lostReason === undefined &&
      body.orderId === undefined &&
      body.linkedOrderId === undefined)
  ) {
    return NextResponse.json(
      {
        error:
          "Nothing to update — provide status, lostReason, orderId, or linkedOrderId (legacy)",
      },
      { status: 400 }
    )
  }

  try {
    const data: Record<string, string | null> = {}
    if (body.status) data.status = body.status
    if (body.lostReason !== undefined) data.lostReason = body.lostReason ?? null

    // ── Resolve the linked order ────────────────────────────────
    // Priority: orderId > linkedOrderId (legacy)
    if (body.orderId !== undefined) {
      const orderId: string | null = body.orderId ?? null
      if (orderId !== null) {
        // Validate the Order exists; FK constraint would catch it anyway,
        // but a 404 with a clear message is friendlier than a Prisma FK error.
        const order = await db.order.findUnique({
          where: { id: orderId },
          select: { id: true, orderNumber: true },
        })
        if (!order) {
          return NextResponse.json(
            { error: `Order not found: ${orderId}` },
            { status: 404 }
          )
        }
        // Set both fields so legacy clients reading linkedOrderId still work.
        data.orderId = orderId
        data.linkedOrderId = order.orderNumber
      } else {
        // Explicitly clearing the link
        data.orderId = null
        data.linkedOrderId = null
      }
    } else if (body.linkedOrderId !== undefined) {
      // Legacy path: translate linkedOrderId (orderNumber string) → orderId
      const orderNumber: string | null = body.linkedOrderId ?? null
      if (orderNumber !== null) {
        const order = await db.order.findUnique({
          where: { orderNumber },
          select: { id: true, orderNumber: true },
        })
        if (!order) {
          return NextResponse.json(
            {
              error: `Order not found with orderNumber '${orderNumber}'. Tip: send orderId (Order.id) instead of linkedOrderId for the new FK.`,
            },
            { status: 404 }
          )
        }
        data.orderId = order.id
        data.linkedOrderId = order.orderNumber // keep legacy field in sync
      } else {
        // Explicitly clearing
        data.orderId = null
        data.linkedOrderId = null
      }
    }

    const quote = await db.quote.update({
      where: { id },
      data,
    })
    return NextResponse.json({ quote })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

/**
 * DELETE /api/quotes/[id]
 * Permanently deletes a quote and its lines (cascade). Use with caution.
 * If the quote is linked to an Order, the Order is NOT deleted (only the
 * quote.orderId link is cleared).
 */
export async function DELETE(_request: Request, { params }: RouteParams) {
  const { id } = await params

  const existing = await db.quote.findUnique({
    where: { id },
    select: { id: true, orderId: true, quoteNumber: true },
  })
  if (!existing) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 })
  }

  try {
    // Clear the order link (if any) before deleting — don't cascade to the order
    if (existing.orderId) {
      await db.quote.update({
        where: { id },
        data: { orderId: null },
      })
    }

    await db.quote.delete({ where: { id } })
    return NextResponse.json({ deleted: id, quoteNumber: existing.quoteNumber })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
