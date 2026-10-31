// src/app/api/quotes/[id]/message/route.ts — v1.9
//
// Returns the WhatsApp message text for a quote as plain text.
// The client fetches this and copies to clipboard (or shows in a dialog
// so Maria can tweak before pasting into WhatsApp manually).
//
// Returns: { message: string } as JSON (so we can add fields later if needed,
// e.g. a wa.me URL for one-click open).

import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { buildQuoteWhatsAppMessage } from "@/lib/quote-message"

export const dynamic = "force-dynamic"

interface RouteParams {
  params: Promise<{ id: string }>
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

  const message = buildQuoteWhatsAppMessage(
    {
      quoteNumber: quote.quoteNumber,
      customerName: quote.customer?.name ?? quote.customerName,
      eventDate: quote.eventDate,
      deliveryAddress: quote.customer?.address ?? null,
      cardMessage: null, // quotes don't have cardMessage (orders do)
      deliveryNotes: null,
      subtotal: quote.subtotal,
      iva: quote.iva,
      total: quote.total,
      depositRequired: quote.depositRequired,
      paymentRule: quote.paymentRule,
      validUntil: quote.validUntil,
      notes: quote.notes,
    },
    quote.lines.map((l) => ({
      description: l.description,
      qty: l.qty,
      unitPrice: l.unitPrice,
    }))
  )

  if (!message) {
    return NextResponse.json(
      { error: "Quote is missing required fields (quoteNumber or customerName)" },
      { status: 422 }
    )
  }

  // Also return a wa.me URL for one-click open (uses customer phone if available)
  const phone = quote.customer?.phone?.replace(/\D/g, "")
  const waMeUrl = phone
    ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
    : null

  return NextResponse.json({
    message,
    waMeUrl,
    quoteNumber: quote.quoteNumber,
    customerName: quote.customer?.name ?? quote.customerName,
  })
}
