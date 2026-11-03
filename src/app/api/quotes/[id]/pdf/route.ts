// src/app/api/quotes/[id]/pdf/route.ts — v1.9
//
// Streams the Quote PDF directly to the browser. No disk writes.
// Mirrors src/app/api/orders/[id]/pdf/route.ts but for quotes.

import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { generateQuotePdf, type QuotePayload } from "@/lib/pdf/quote"

export const dynamic = "force-dynamic"
export const maxDuration = 60 // 60s — needed for Vercel Pro if generating large PDFs

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
    notes: quote.notes,
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
