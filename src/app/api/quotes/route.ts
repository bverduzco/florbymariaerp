import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

/**
 * POST /api/quotes
 * Body: { customerName, eventType?, eventDate?, subtotal, notes? }
 * Creates a new quote with status "draft".
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body?.customerName || !body?.subtotal) {
    return NextResponse.json(
      { error: "Missing required fields: customerName, subtotal" },
      { status: 400 }
    )
  }

  const subtotal = Number(body.subtotal)
  const iva = subtotal * 0.16
  const total = subtotal + iva

  // Generate next quote number
  const count = await db.quote.count()
  const quoteNumber = `QTE-${String(count + 1).padStart(4, "0")}`

  try {
    // Try to link to an existing customer by name
    const customer = await db.customer.findFirst({
      where: { name: { contains: body.customerName } },
    })

    const quote = await db.quote.create({
      data: {
        quoteNumber,
        quoteDate: new Date(),
        customerId: customer?.id ?? null,
        customerName: body.customerName,
        eventType: body.eventType ?? null,
        eventDate: body.eventDate ? new Date(body.eventDate) : null,
        status: "draft",
        validUntil: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // 15 days
        subtotal,
        iva,
        total,
        depositRequired: total * 0.5,
        leadSource: body.leadSource ?? null,
        notes: body.notes ?? null,
      },
    })
    return NextResponse.json({ quote }, { status: 201 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
