import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { lookupPaymentRule } from "@/lib/payment-rules"

export const dynamic = "force-dynamic"

/**
 * POST /api/quote-lines
 * Body: { quoteId, productSku?, productId?, description, qty, unitPrice, notes? }
 * Creates a new quote line. Auto-computes lineTotal = qty × unitPrice.
 * Auto-increments lineNumber within the quote.
 *
 * v1.9: When recomputing the quote's totals after adding a line, the deposit
 * is recomputed using the stored `Quote.paymentRule` (looked up via
 * lookupPaymentRule). This preserves the rule that was applied at creation —
 * editing lines doesn't silently change the deposit % on an already-sent quote.
 *
 * For legacy quotes with `paymentRule=null`, falls back to 50%.
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

    // Get next line number for this quote
    const existingLines = await db.quoteLine.count({ where: { quoteId: body.quoteId } })
    const lineNumber = existingLines + 1

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

    // Update the quote's subtotal + totals
    const allLines = await db.quoteLine.findMany({
      where: { quoteId: body.quoteId },
      select: { lineTotal: true },
    })
    const newSubtotal = allLines.reduce((s, l) => s + l.lineTotal, 0)
    const newIva = newSubtotal * 0.16
    const newTotal = newSubtotal + newIva

    // v1.9: Recompute deposit using the stored payment rule (preserves the rule
    // applied at creation — editing lines doesn't change the deposit %).
    const { depositPct } = lookupPaymentRule(quote.paymentRule)
    const newDeposit = newTotal * depositPct

    await db.quote.update({
      where: { id: body.quoteId },
      data: {
        subtotal: newSubtotal,
        iva: newIva,
        total: newTotal,
        depositRequired: newDeposit,
      },
    })

    return NextResponse.json(
      {
        quoteLine,
        quoteTotals: {
          subtotal: newSubtotal,
          iva: newIva,
          total: newTotal,
          depositRequired: newDeposit,
          paymentRule: quote.paymentRule,
          depositPct,
        },
      },
      { status: 201 }
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
