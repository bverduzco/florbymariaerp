import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { computePaymentRule } from "@/lib/payment-rules"

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
 *   quoteMode?:    "event" | "no_event", // drives which payment rule applies
 *   leadSource?:        string | null,
 *   leadSourceDetail?:  string | null,   // v1.9: referrer/planner name or other source detail
 *   notes?:        string | null,
 *   overrideDecline?: boolean,           // v1.9: must be true when payment rule is "decline" (event < 2 weeks)
 *                                        //       When true, the override is logged in notes.
 *   lineItems?:   Array<{                // v1.9: optional — created in same transaction
 *     productSku?: string | null,
 *     productId?:  string | null,
 *     description: string,
 *     qty:         number,
 *     unitPrice:   number,
 *   }>,
 * }
 *
 * Payment rules (applied at creation, stored on Quote.paymentRule):
 *   - quoteMode='no_event'                  → 100% upfront (COD), rule='no_event_cod'
 *   - quoteMode='event', no eventDate       → 50% default + warning, rule='event_default_50pct'
 *   - event > 6 months away                  → 30% deposit, rule='event_30pct'
 *   - event ≤ 6 months, ≥ 2 weeks           → 50% deposit, rule='event_50pct'
 *   - event < 2 weeks away                  → DECLINE — quote is created only if
 *                                              overrideDecline=true (rule='event_declined_too_close'
 *                                              is still stored so the override is auditable).
 *
 * Backward compatibility:
 *   - Old shape { customerName, subtotal, eventType?, eventDate?, leadSource?, notes? } still works.
 *   - quoteMode defaults to 'event' when not provided (preserves old behavior).
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
    // Legacy path — caller supplied a subtotal directly.
    // Note: this stores subtotal=X on the Quote row without creating QuoteLine
    // rows to back it. All v1.9 UI callers send lineItems[], so this path is
    // only reachable by external API consumers using the old shape.
    subtotal = Number(body.subtotal)
  } else {
    subtotal = 0
  }

  const iva = subtotal * 0.16
  const total = subtotal + iva

  // ── Compute payment rule + deposit ────────────────────────
  // quoteMode defaults to "event" when not provided (preserves old behavior —
  // legacy callers didn't send quoteMode but did send eventType/eventDate).
  const quoteMode = body.quoteMode ?? "event"
  const paymentRule = computePaymentRule(quoteMode, body.eventDate ?? null)

  // ── Decline enforcement (warn + override) ──────────────────
  // If the rule is "decline" and the caller didn't set overrideDecline=true,
  // reject the request with 422 Unprocessable Entity.
  if (paymentRule.decline && !body.overrideDecline) {
    return NextResponse.json(
      {
        error: "Event is less than 2 weeks away — must decline.",
        paymentRule: paymentRule.rule,
        warning: paymentRule.warning,
        hint: "Set overrideDecline=true in the request body to create the quote anyway (the override will be logged in notes).",
      },
      { status: 422 }
    )
  }

  // v1.9: Check if the delivery/event date falls on a blocked date
  if (body.eventDate) {
    const eventDateObj = new Date(body.eventDate)
    const dateKey = eventDateObj.toISOString().slice(0, 10)
    const blocked = await db.blockedDate.findUnique({ where: { date: eventDateObj } })
    if (blocked) {
      return NextResponse.json(
        {
          error: `The date ${dateKey} is blocked (${blocked.reason}). Cannot create a quote for this date.`,
          blockedReason: blocked.reason,
          blockedBy: blocked.blockedBy,
          hint: blocked.blockedBy === "system"
            ? "This is a system block (Sunday/holiday). Choose a different date."
            : "Unblock this date in the Calendar tab, or choose a different date.",
        },
        { status: 422 }
      )
    }
  }

  const depositRequired = total * paymentRule.depositPct

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

    // ── Compose notes (append override marker if applicable) ──
    let notes = body.notes ?? null
    if (paymentRule.decline && body.overrideDecline) {
      const overrideMarker = `[OVERRIDE: event <2wk accepted by ${body.executedBy ?? "Maria"} on ${new Date().toISOString().slice(0, 10)}]`
      notes = notes ? `${notes}\n\n${overrideMarker}` : overrideMarker
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
        paymentRule: paymentRule.rule, // v1.9: store the rule applied
        leadSource: body.leadSource ?? null,
        leadSourceDetail: body.leadSourceDetail ?? null,
        notes,
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
    return NextResponse.json(
      {
        quote,
        paymentRule: {
          rule: paymentRule.rule,
          label: paymentRule.label,
          depositPct: paymentRule.depositPct,
          decline: paymentRule.decline,
          warning: paymentRule.warning,
          overridden: paymentRule.decline && body.overrideDecline,
        },
      },
      { status: 201 }
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
