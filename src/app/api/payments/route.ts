import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

/**
 * POST /api/payments
 * Body: { direction, type, linkedId?, linkedName?, amount, method?, reference?, notes? }
 * Creates a new payment record.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body?.direction || !body?.type || !body?.amount) {
    return NextResponse.json(
      { error: "Missing required fields: direction, type, amount" },
      { status: 400 }
    )
  }

  const count = await db.payment.count()
  const paymentNumber = `PAY-${String(count + 1).padStart(4, "0")}`

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
    return NextResponse.json({ payment }, { status: 201 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
