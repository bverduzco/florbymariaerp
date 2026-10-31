import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

/**
 * POST /api/quotes
 *
 * v1.9 body shape (all fields optional except customerName):
 * {
 *   customerName: string,                 // required
 *   customerId?:   string,               // optional — explicit customer link (auto-resolved by name otherwise)
 *   eventId?:      string | null,        // optional — link to existing Event
 *   eventType?:    string | null,        // wedding | birthday | ... | everyday | sympathy | just_because | custom | other
 *   eventDate?:    string (ISO) | null,  // event date OR delivery date for no-event quotes
 *   quoteMode?:    "event" | "no_event", // pure UI hint — informs what eventType means; not stored
 *   leadSource?:        string | null,
 *   leadSourceDetail?:  string | null,   // v1.9: referrer/planner name or other source detail
 *   notes?:        string | null,
 *   lineItems?:   Array<{                // v1.9: optional — created in same transaction
 *     productSku?: string | null,
 *     productId?:  string | null,
 *     description: string,
 *     qty:         number,
 *     unitPrice:   number,
 *   }>,
 * }
 *
 * Backward compatibility:
 *   - Old shape { customerName, subtotal, eventType?, eventDate?, leadSource?, notes? } still works.
 *   - If `lineItems[]` provided, subtotal/iva/total/deposit are computed from lines (overrides any `subtotal` field).
 *   - If no `lineItems[]` AND `subtotal` provided → uses the supplied subtotal (legacy path).
 *   - If neither → subtotal defaults to 0.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body?.customerName) {
    return NextResponse.json(
      { error: "Missing required field: customerName" },
      { status: 400 }
    )
  }

  // ── Compute totals ────────────────────────────────────────
  // Priority: lineItems > explicit subtotal > 0
  let subtotal: number
  let linesData: Array<{
    productSku: string | null
    productId: string | null
    description: string
    qty: number
    unitPrice: number
    lineTotal: number
  }> = []

  const hasLineItems = Array.isArray(body.lineItems) && body.lineItems.length > 0

  if (hasLineItems) {
    // Coerce + validate each line; compute lineTotal = qty × unitPrice
    linesData = body.lineItems
      .filter(
        (l: { description?: string; qty?: number; unitPrice?: number }) =>
          l && typeof l.description === "string" && l.description.trim() !== "" && Number(l.qty) > 0 && Number(l.unitPrice) >= 0
      )
      .map((l: {
        productSku?: string | null
        productId?: string | null
        description: string
        qty: number
        unitPrice: number
      }) => {
        const qty = Number(l.qty)
        const unitPrice = Number(l.unitPrice)
        return {
          productSku: l.productSku ?? null,
          productId: l.productId ?? null,
          description: l.description,
          qty,
          unitPrice,
          lineTotal: qty * unitPrice,
        }
      })
    subtotal = linesData.reduce((s, l) => s + l.lineTotal, 0)
  } else if (body.subtotal !== undefined && body.subtotal !== null && !Number.isNaN(Number(body.subtotal))) {
    // Legacy path — caller supplied a subtotal directly
    subtotal = Number(body.subtotal)
  } else {
    subtotal = 0
  }

  const iva = subtotal * 0.16
  const total = subtotal + iva
  const depositRequired = total * 0.5

  // ── Generate next quote number ────────────────────────────
  const count = await db.quote.count()
  const quoteNumber = `QTE-${String(count + 1).padStart(4, "0")}`

  try {
    // ── Resolve customer link ────────────────────────────────
    // Priority: explicit customerId > fuzzy name match > null
    let customerId: string | null = body.customerId ?? null
    if (!customerId) {
      const customer = await db.customer.findFirst({
        where: { name: { contains: body.customerName } },
        select: { id: true },
      })
      customerId = customer?.id ?? null
    }

    // ── Validate eventId if provided ─────────────────────────
    let eventId: string | null = body.eventId ?? null
    if (eventId) {
      const event = await db.event.findUnique({
        where: { id: eventId },
        select: { id: true },
      })
      if (!event) {
        return NextResponse.json(
          { error: `Event not found: ${eventId}` },
          { status: 404 }
        )
      }
    } else {
      eventId = null
    }

    // ── Create quote + (optional) line items in one transaction ──
    const quote = await db.quote.create({
      data: {
        quoteNumber,
        quoteDate: new Date(),
        customerId,
        customerName: body.customerName,
        eventId,
        eventType: body.eventType ?? null,
        eventDate: body.eventDate ? new Date(body.eventDate) : null,
        status: "draft",
        validUntil: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // 15 days
        subtotal,
        iva,
        total,
        depositRequired,
        leadSource: body.leadSource ?? null,
        leadSourceDetail: body.leadSourceDetail ?? null,
        notes: body.notes ?? null,
        lines: hasLineItems
          ? {
              create: linesData.map((l, idx) => ({
                lineNumber: idx + 1,
                productSku: l.productSku,
                productId: l.productId,
                description: l.description,
                qty: l.qty,
                unitPrice: l.unitPrice,
                lineTotal: l.lineTotal,
              })),
            }
          : undefined,
      },
      include: { lines: true },
    })
    return NextResponse.json({ quote }, { status: 201 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
