import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { recomputeQuoteTotals } from "@/lib/quote-totals"

export const dynamic = "force-dynamic"

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * PATCH /api/quote-lines/[id]
 * Body: { description?, qty?, unitPrice? }
 * Updates a quote line. Recomputes lineTotal = qty × unitPrice.
 * Also recomputes the quote's totals after the update.
 *
 * v1.9.1 (Class 3 fix): the recompute now correctly handles
 * discount + deliveryFee + IVA-on-discounted-subtotal via the shared
 * recomputeQuoteTotals() helper. Previously used `total = subtotal + iva`
 * which ignored both, causing wrong totals.
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

    // Class 3 fix: recompute the quote's totals via shared helper
    const totals = await recomputeQuoteTotals(existing.quoteId)

    return NextResponse.json({
      quoteLine: line,
      quoteTotals: totals,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

/**
 * DELETE /api/quote-lines/[id]
 * Removes a quote line. Recomputes the quote's totals after removal.
 *
 * v1.9.1 (Class 3 fix): same as PATCH — recompute uses the shared helper.
 */
export async function DELETE(_request: Request, { params }: RouteParams) {
  const { id } = await params

  const existing = await db.quoteLine.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: "Quote line not found" }, { status: 404 })
  }

  try {
    await db.quoteLine.delete({ where: { id } })

    // Class 3 fix: recompute via shared helper
    const totals = await recomputeQuoteTotals(existing.quoteId)

    return NextResponse.json({
      deleted: id,
      quoteTotals: totals,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
