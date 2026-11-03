import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { logChange } from "@/lib/audit"
import { generateSequentialNumber } from "@/lib/sequential-number"

export const dynamic = "force-dynamic"

/**
 * POST /api/payments
 * Body: { direction, type, linkedId?, linkedName?, amount, method?, reference?, notes? }
 * Creates a new payment record.
 *
 * v1.9: If the payment is IN (money received) and linkedId is an Order ID,
 * auto-updates the Order's status + paymentStatus:
 *   - order.status → "payment_confirmed"
 *   - order.paymentStatus → "confirmed"
 *   - order.paymentConfirmedAt → now
 *   - order.paymentAmount → payment.amount
 *   - order.paymentMethod → payment.method
 *   - order.paymentReference → payment.reference
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body?.direction || !body?.type || !body?.amount) {
    return NextResponse.json(
      { error: "Missing required fields: direction, type, amount" },
      { status: 400 }
    )
  }

  const paymentNumber = await generateSequentialNumber(db, "payment", "paymentNumber", "PAY-", 4)

  try {
    const payment = await db.payment.create({
      data: {
        paymentNumber,
        date: new Date(),
        direction: body.direction,
        type: body.type,
        linkedId: body.linkedId ?? null,
        linkedName: body.linkedName ?? null,
        amount: Number(body.amount),
        method: body.method ?? null,
        reference: body.reference ?? null,
        status: "confirmed",
        recordedBy: "Maria",
        notes: body.notes ?? null,
      },
    })

    // v1.9: Auto-update order status if this is an incoming payment linked to an Order
    if (body.direction === "in" && body.linkedId) {
      const order = await db.order.findUnique({
        where: { id: body.linkedId },
        select: { id: true, status: true, paymentStatus: true, paymentConfirmedAt: true },
      })

      if (order && order.status !== "fulfilled" && order.status !== "delivered" && order.status !== "cancelled") {
        const updateData: Record<string, unknown> = {
          paymentStatus: "confirmed",
          paymentConfirmedAt: new Date(),
          paymentAmount: Number(body.amount),
        }
        if (body.method) updateData.paymentMethod = body.method
        if (body.reference) updateData.paymentReference = body.reference

        // Only update status if it's not already past payment_confirmed
        if (!["procuring", "producing", "delivered", "fulfilled"].includes(order.status)) {
          updateData.status = "payment_confirmed"
        }

        await db.order.update({
          where: { id: order.id },
          data: updateData,
        })

        // Audit trail
        await logChange({
          entityType: "Order", entityId: order.id,
          action: "status_change", fieldName: "status",
          oldValue: order.status,
          newValue: String(updateData.status ?? order.status),
        })
        await logChange({
          entityType: "Payment", entityId: payment.id,
          action: "create", fieldName: "amount",
          newValue: String(payment.amount),
        })
      }
    }

    return NextResponse.json({ payment }, { status: 201 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
