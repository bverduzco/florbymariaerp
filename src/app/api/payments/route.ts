import { NextResponse } from "next/server"
import { db } from "@/lib/db"
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
    // Class 1 fix: wrap payment creation + order status update + audit log
    // in $transaction. If the order update fails, the payment is rolled back
    // too — no orphaned payment with no order status change.
    const payment = await db.$transaction(async (tx) => {
      const created = await tx.payment.create({
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

      // Auto-update order status if this is an incoming payment linked to an Order
      if (body.direction === "in" && body.linkedId) {
        const order = await tx.order.findUnique({
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

          await tx.order.update({
            where: { id: order.id },
            data: updateData,
          })

          // Audit trail (using tx — stays in transaction)
          try {
            await tx.auditLog.create({
              data: {
                entityType: "Order", entityId: order.id,
                action: "status_change", fieldName: "status",
                oldValue: order.status,
                newValue: String(updateData.status ?? order.status),
                changedBy: "Maria",
              },
            })
            await tx.auditLog.create({
              data: {
                entityType: "Payment", entityId: created.id,
                action: "create", fieldName: "amount",
                newValue: String(created.amount),
                changedBy: "Maria",
              },
            })
          } catch {
            // AuditLog table might not exist — silently skip
          }
        }
      }

      return created
    })

    return NextResponse.json({ payment }, { status: 201 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
