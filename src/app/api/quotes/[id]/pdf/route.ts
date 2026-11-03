// src/app/api/quotes/[id]/pdf/route.ts — v1.9
//
// Streams the Quote PDF directly to the browser. No disk writes.
// Mirrors src/app/api/orders/[id]/pdf/route.ts but for quotes.
//
// v1.9.1: Also fetches the relevant LegalTemplate (LT-002 for small
// orders / no-event quotes, LT-003 for event quotes) and passes it as
// `termsText` in the payload. The PDF renders it as a "TÉRMINOS Y
// CONDICIONES" section above the validity notice.

import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { generateQuotePdf, type QuotePayload } from "@/lib/pdf/quote"

export const dynamic = "force-dynamic"
export const maxDuration = 60 // 60s — needed for Vercel Pro if generating large PDFs

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * Pick the right LegalTemplate for this quote.
 *
 * - Event quotes (weddings, corporate, etc.) → LT-003 "Condiciones del Servicio (Eventos)"
 * - No-event / everyday orders (COD) → LT-002 "Condiciones de Pedidos Pequeños"
 *
 * Returns the templateText (with [PLACEHOLDERS] still in place — the PDF
 * renders them as-is for now; placeholder substitution is a future task).
 *
 * Returns null if no matching template is found (e.g. seed data missing)
 * — the PDF gracefully omits the section in that case.
 */
async function fetchTermsText(quote: { eventType: string | null; paymentRule: string | null }): Promise<string | null> {
  // Treat no_event_cod or any quote without an event type as "small order"
  // → LT-002 applies. Anything with an eventType → LT-003.
  const appliesTo = quote.eventType ? "event_quotes" : "small_orders"
  const template = await db.legalTemplate.findFirst({
    where: { appliesTo },
    select: { templateText: true },
    orderBy: { lastUpdated: "desc" }, // most recent version if multiple exist
  })
  return template?.templateText ?? null
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params

  const quote = await db.quote.findUnique({
    where: { id },
    include: {
      customer: true,
      lines: { orderBy: { lineNumber: "asc" } },
    },
  })
  if (!quote) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 })
  }

  // Fetch the relevant LegalTemplate (LT-002 or LT-003) in parallel
  const termsText = await fetchTermsText(quote)

  const payload: QuotePayload = {
    quoteNumber: quote.quoteNumber,
    quoteDate: quote.quoteDate.toISOString(),
    validUntil: quote.validUntil?.toISOString() ?? null,
    customer: {
      name: quote.customer?.name ?? quote.customerName ?? "—",
      phone: quote.customer?.phone ?? undefined,
      email: quote.customer?.email ?? undefined,
      address: quote.customer?.address ?? undefined,
    },
    deliveryAddress: quote.customer?.address ?? null,
    eventType: quote.eventType,
    eventDate: quote.eventDate?.toISOString().split("T")[0] ?? null,
    lineItems: quote.lines.map((l) => ({
      description: l.description,
      qty: l.qty,
      unitPrice: l.unitPrice,
      lineTotal: l.lineTotal,
    })),
    subtotal: quote.subtotal,
    iva: quote.iva,
    total: quote.total,
    depositRequired: quote.depositRequired,
    paymentRule: quote.paymentRule,
    discount: quote.discount,
    discountType: quote.discountType,
    deliveryFee: quote.deliveryFee,
    notes: quote.notes,
    termsText, // v1.9.1: legal terms section content
  }

  // Generate PDF in-process — no execFile, no Python, no disk writes
  const pdfBuffer = await generateQuotePdf(payload)

  // Stream the PDF back as the HTTP response.
  const fileName = `Cotización ${quote.quoteNumber}.pdf`
  return new Response(pdfBuffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
      "Content-Length": String(pdfBuffer.length),
      "Cache-Control": "no-store",
    },
  })
}
