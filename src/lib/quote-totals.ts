// src/lib/quote-totals.ts — single source of truth for Quote total math.
//
// Why this exists:
//   Previously, every API route that mutated a quote (create, add/edit/delete
//   line, apply discount) recomputed subtotal/iva/total/depositRequired
//   independently. They all used the wrong formula: `total = subtotal + iva`,
//   which ignored both discount and deliveryFee.
//
//   The PDF and WhatsApp message rendered discount + delivery as separate
//   line items but showed the wrong total below them. Customers were told
//   they owed $580 when they actually owed $514.
//
//   This helper centralizes the correct formula:
//     1. subtotal = Σ(lineTotal of all quote lines)
//     2. discountAmount = (percentage) ? subtotal × discount/100 : discount
//     3. discountedSubtotal = max(0, subtotal - discountAmount)
//     4. iva = discountedSubtotal × 0.16
//     5. total = discountedSubtotal + iva + (deliveryFee ?? 100)
//     6. depositRequired = total × lookupPaymentRule(quote.paymentRule).depositPct
//
//   Every site that mutates a quote calls recomputeQuoteTotals(quoteId)
//   afterward, which writes all 6 values back to the Quote row in one update.
//
// IVA note:
//   Per Mexico's SAT (Servicio de Administración Tributaria), IVA is 16% on
//   the *taxable base*. The taxable base after a discount is the discounted
//   subtotal, not the original subtotal. So IVA must be computed AFTER the
//   discount is applied. (Article 22, Reglamento de la Ley del Impuesto al
//   Valor Agregado.) The previous code computed IVA on the original subtotal,
//   which was both mathematically wrong and tax-noncompliant.

import { db } from "@/lib/db"
import { lookupPaymentRule } from "@/lib/payment-rules"

/** IVA rate in Mexico (2026). Federal VAT, applies to most goods + services. */
const IVA_RATE = 0.16

/** Default delivery fee when the quote's `deliveryFee` field is null.
 * Matches the schema default in prisma/schema.prisma. */
const DEFAULT_DELIVERY_FEE = 100

export type QuoteTotals = {
  subtotal: number
  discountAmount: number
  discountedSubtotal: number
  iva: number
  deliveryFee: number
  total: number
  depositPct: number
  depositRequired: number
  balanceDue: number
}

/**
 * Compute (but don't persist) the correct totals for a Quote given its
 * lines + discount + deliveryFee + stored paymentRule.
 *
 * Pure function — no DB writes. Useful for previews (e.g. the New Quote
 * dialog's live deposit preview could use this in the future).
 *
 * Returns null if the quote doesn't exist or has no lines.
 */
export async function computeQuoteTotals(quoteId: string): Promise<QuoteTotals | null> {
  const quote = await db.quote.findUnique({
    where: { id: quoteId },
    select: {
      discount: true,
      discountType: true,
      deliveryFee: true,
      paymentRule: true,
      lines: {
        select: { lineTotal: true },
        orderBy: { lineNumber: "asc" },
      },
    },
  })

  if (!quote) return null

  return computeTotalsFromData({
    lineTotals: quote.lines.map((l) => l.lineTotal),
    discount: quote.discount,
    discountType: quote.discountType,
    deliveryFee: quote.deliveryFee,
    paymentRule: quote.paymentRule,
  })
}

/**
 * Compute totals from raw data — used by POST /api/quotes (which doesn't
 * have a quote ID yet to look up).
 */
export function computeTotalsFromData(params: {
  lineTotals: number[]
  discount: number | null
  discountType: string | null
  deliveryFee: number | null
  paymentRule: string | null
}): QuoteTotals {
  const { lineTotals, discount, discountType, deliveryFee, paymentRule } = params

  // Step 1: subtotal = sum of all line totals
  const subtotal = lineTotals.reduce((sum, lt) => sum + lt, 0)

  // Step 2: discount amount (percentage or flat)
  //   - percentage: discountAmount = subtotal × (discount / 100)
  //     (e.g. subtotal=$1000, discount=10 → discountAmount=$100)
  //   - flat: discountAmount = discount (the value IS the dollar amount)
  //     (e.g. discount=$200 → discountAmount=$200)
  //   - discount=0 or null → no discount applied
  const rawDiscount = discount ?? 0
  const discountAmount =
    rawDiscount > 0 && discountType === "percentage"
      ? subtotal * (rawDiscount / 100)
      : rawDiscount > 0 && discountType === "flat"
        ? rawDiscount
        : 0

  // Step 3: discountedSubtotal (clamped to 0 — discount can't make subtotal negative)
  const discountedSubtotal = Math.max(0, subtotal - discountAmount)

  // Step 4: IVA on the *discounted* subtotal (per Mexican tax law —
  // discounts reduce the taxable base)
  const iva = discountedSubtotal * IVA_RATE

  // Step 5: total = discountedSubtotal + IVA + deliveryFee
  //   deliveryFee defaults to $100 (schema default) when null
  const fee = deliveryFee ?? DEFAULT_DELIVERY_FEE
  const total = discountedSubtotal + iva + fee

  // Step 6: deposit based on the payment rule that was applied at creation
  //   (stored on quote.paymentRule so editing the event date later doesn't
  //   silently change the deposit due on an already-sent quote)
  const rule = lookupPaymentRule(paymentRule)
  const depositRequired = total * rule.depositPct
  const balanceDue = total - depositRequired

  return {
    subtotal,
    discountAmount,
    discountedSubtotal,
    iva,
    deliveryFee: fee,
    total,
    depositPct: rule.depositPct,
    depositRequired,
    balanceDue,
  }
}

/**
 * Recompute totals for a quote and persist them back to the Quote row.
 *
 * Call this from every API route that mutates a quote:
 *   - POST /api/quotes (after creating the quote + lines)
 *   - POST /api/quote-lines (after creating a line)
 *   - PATCH /api/quote-lines/[id] (after editing qty/unitPrice)
 *   - DELETE /api/quote-lines/[id] (after removing a line)
 *   - PATCH /api/quotes/[id] (after changing discount or deliveryFee)
 *
 * @returns the computed totals, or null if the quote doesn't exist.
 */
export async function recomputeQuoteTotals(quoteId: string): Promise<QuoteTotals | null> {
  const totals = await computeQuoteTotals(quoteId)
  if (!totals) return null

  await db.quote.update({
    where: { id: quoteId },
    data: {
      subtotal: totals.subtotal,
      iva: totals.iva,
      total: totals.total,
      depositRequired: totals.depositRequired,
    },
  })

  return totals
}

/**
 * Compute the next lineNumber for a new QuoteLine on a given quote.
 *
 * Replaces the broken `count + 1` pattern (which produces duplicate line
 * numbers after any line is deleted). Instead, finds the MAX existing
 * lineNumber for the quote and increments it.
 *
 * Used by POST /api/quote-lines to assign a lineNumber to the new line.
 */
export async function nextLineNumberForQuote(quoteId: string): Promise<number> {
  const lastLine = await db.quoteLine.findFirst({
    where: { quoteId },
    orderBy: { lineNumber: "desc" },
    select: { lineNumber: true },
  })
  return (lastLine?.lineNumber ?? 0) + 1
}
