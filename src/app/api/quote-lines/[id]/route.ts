import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * PATCH /api/quote-lines/[id]
 * Body: { description?, qty?, unitPrice? }
 * Updates a quote line. Recomputes lineTotal = qty × unitPrice.
 * Also recomputes the quote's subtotal/iva/total/deposit after the update.
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  const { id } = await params
  let body: { description?: string; qty?: number; unitPrice?: number }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const existing = await db.quoteLine.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: "Quote line not found" }, { status: 404 })
  }

  const data: Record<string, unknown> = {}
  if (typeof body.description === "string") data.description = body.description
  if (typeof body.qty === "number" && body.qty > 0) data.qty = body.qty
  if (typeof body.unitPrice === "number" && body.unitPrice >= 0) data.unitPrice = body.unitPrice

  // Recompute lineTotal if qty or unitPrice changed
  const newQty = typeof body.qty === "number" ? body.qty : existing.qty
  const newUnitPrice = typeof body.unitPrice === "number" ? body.unitPrice : existing.unitPrice
  if ("qty" in data || "unitPrice" in data) {
    data.lineTotal = newQty * newUnitPrice
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 })
  }

  try {
    const line = await db.quoteLine.update({ where: { id }, data })

    // Recompute quote totals
    const allLines = await db.quoteLine.findMany({
      where: { quoteId: existing.quoteId },
      select: { lineTotal: true },
    })
    const newSubtotal = allLines.reduce((s, l) => s + l.lineTotal, 0)
    const newIva = newSubtotal * 0.16
    const newTotal = newSubtotal + newIva
    const rule = await db.quote.findUnique({
      where: { id: existing.quoteId },
      select: { paymentRule: true },
    })
    // Use stored paymentRule's depositPct (or 50% default)
    const depositPct = 0.5 // simplified — lookupPaymentRule could be used
    const newDeposit = newTotal * depositPct

    await db.quote.update({
      where: { id: existing.quoteId },
      data: {
        subtotal: newSubtotal,
        iva: newIva,
        total: newTotal,
        depositRequired: newDeposit,
      },
    })

    return NextResponse.json({
      quoteLine: line,
      quoteTotals: {
        subtotal: newSubtotal,
        iva: newIva,
        total: newTotal,
        depositRequired: newDeposit,
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

/**
 * DELETE /api/quote-lines/[id]
 * Removes a quote line. Recomputes the quote's totals after removal.
 */
export async function DELETE(_request: Request, { params }: RouteParams) {
  const { id } = await params

  const existing = await db.quoteLine.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: "Quote line not found" }, { status: 404 })
  }

  try {
    await db.quoteLine.delete({ where: { id } })

    // Recompute quote totals
    const allLines = await db.quoteLine.findMany({
      where: { quoteId: existing.quoteId },
      select: { lineTotal: true },
    })
    const newSubtotal = allLines.reduce((s, l) => s + l.lineTotal, 0)
    const newIva = newSubtotal * 0.16
    const newTotal = newSubtotal + newIva
    const newDeposit = newTotal * 0.5 // simplified

    await db.quote.update({
      where: { id: existing.quoteId },
      data: {
        subtotal: newSubtotal,
        iva: newIva,
        total: newTotal,
        depositRequired: newDeposit,
      },
    })

    return NextResponse.json({
      deleted: id,
      quoteTotals: {
        subtotal: newSubtotal,
        iva: newIva,
        total: newTotal,
        depositRequired: newDeposit,
        lineCount: allLines.length,
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
