import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { recomputeQuoteTotals, nextLineNumberForQuote } from "@/lib/quote-totals"

export const dynamic = "force-dynamic"

/**
 * POST /api/quote-lines
 * Body: { quoteId, productSku?, productId?, description, qty, unitPrice, notes? }
 * Creates a new quote line. Auto-computes lineTotal = qty × unitPrice.
 * Auto-increments lineNumber within the quote.
 *
 * v1.9.1 (Class 3 + 4 fix):
 *   - lineNumber now uses MAX(lineNumber) + 1 instead of count + 1
 *     (avoids duplicate line numbers after a line is deleted)
 *   - Quote totals recomputed via recomputeQuoteTotals(), which correctly
 *     accounts for discount + deliveryFee + IVA-on-discounted-subtotal
 *     (the old inline math did `total = subtotal + iva` which ignored
 *     both, causing customers to see wrong totals on the PDF)
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body?.quoteId || !body?.description || !body?.unitPrice) {
    return NextResponse.json(
      { error: "Missing required fields: quoteId, description, unitPrice" },
      { status: 400 }
    )
  }

  try {
    // Verify the quote exists
    const quote = await db.quote.findUnique({ where: { id: body.quoteId } })
    if (!quote) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 })
    }

    // Class 4 fix: lineNumber = MAX(existing lineNumber) + 1
    // (previously: count + 1, which produced duplicates after a line was deleted)
    const lineNumber = await nextLineNumberForQuote(body.quoteId)

    const qty = Number(body.qty) || 1
    const unitPrice = Number(body.unitPrice)
    const lineTotal = qty * unitPrice

    const quoteLine = await db.quoteLine.create({
      data: {
        quoteId: body.quoteId,
        lineNumber,
        productSku: body.productSku ?? null,
        productId: body.productId ?? null,
        description: body.description,
        qty,
        unitPrice,
        lineTotal,
        notes: body.notes ?? null,
      },
    })

    // Class 3 fix: recompute the quote's totals using the shared helper
    // (correctly handles discount + deliveryFee + IVA-on-discounted-subtotal)
    const totals = await recomputeQuoteTotals(body.quoteId)

    return NextResponse.json(
      {
        quoteLine,
        quoteTotals: totals
          ? {
              subtotal: totals.subtotal,
              iva: totals.iva,
              total: totals.total,
              depositRequired: totals.depositRequired,
              paymentRule: quote.paymentRule,
              depositPct: totals.depositPct,
            }
          : null,
      },
      { status: 201 }
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
