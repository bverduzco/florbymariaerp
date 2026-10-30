import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

/**
 * POST /api/quote-lines
 * Body: { quoteId, productSku?, productId?, description, qty, unitPrice, notes? }
 * Creates a new quote line. Auto-computes lineTotal = qty × unitPrice.
 * Auto-increments lineNumber within the quote.
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

    await db.quote.update({
      where: { id: body.quoteId },
      data: {
        subtotal: newSubtotal,
        iva: newIva,
        total: newTotal,
        depositRequired: newTotal * 0.5,
      },
    })

    return NextResponse.json({ quoteLine, quoteTotals: { subtotal: newSubtotal, iva: newIva, total: newTotal } }, { status: 201 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
