/**
 * Build a customer-facing WhatsApp message for a Quote.
 *
 * Adapted from the v1.7 buildWhatsAppMessage() helper (recovered from git
 * history when src/components/floristry/order-detail.tsx was deleted during
 * the v1.9 tsc cleanup). Adjusted to:
 *   - Use quoteNumber instead of orderNumber
 *   - Show deposit + balance due (instead of just total) — reflects the
 *     payment rule applied at creation (100% COD / 30% / 50%)
 *   - Show the payment rule label so the customer understands what they owe
 *   - Include validUntil date (quotes expire; orders don't)
 *
 * Output is plain text with WhatsApp markdown formatting (*bold*, _italic_).
 * Returns null if the quote is missing required fields (shouldn't happen
 * but caller should handle gracefully).
 */

import type { Quote } from "@prisma/client"
import { lookupPaymentRule } from "./payment-rules"

// Minimal type for the quote shape we need (so callers can pass either a
// Prisma Quote or a serialized object). Using a structural type keeps this
// helper testable without a real Prisma client.
export type QuoteForMessage = {
  quoteNumber: string
  customerName: string | null
  eventDate: Date | string | null
  deliveryAddress?: string | null
  cardMessage?: string | null
  deliveryNotes?: string | null
  subtotal: number
  iva: number
  total: number
  depositRequired: number
  paymentRule: string | null
  validUntil: Date | string | null
  discount?: number
  discountType?: string
  notes?: string | null
}

export type QuoteLineForMessage = {
  description: string
  qty: number
  unitPrice: number
}

export function buildQuoteWhatsAppMessage(
  quote: QuoteForMessage,
  lines: QuoteLineForMessage[]
): string | null {
  if (!quote.quoteNumber || !quote.customerName) return null

  const out: string[] = []
  out.push("🌸 *Flor by Maria*")
  out.push("")
  out.push(`¡Hola ${quote.customerName}!`)
  out.push("")
  out.push("Aquí está el resumen de su cotización:")
  out.push("")
  out.push(`📋 *Cotización:* ${quote.quoteNumber}`)
  out.push("🌹 *Productos:*")
  for (const li of lines) {
    out.push(
      `• ${li.description} ×${li.qty} — $${(li.unitPrice * li.qty).toLocaleString("es-MX")}`
    )
  }
  out.push("")
  out.push(`💵 *Subtotal:* $${Math.round(quote.subtotal).toLocaleString("es-MX")}`)
  // Show discount if any
  if ((quote.discount ?? 0) > 0) {
    const discAmount = quote.discountType === "percentage"
      ? quote.subtotal * ((quote.discount ?? 0) / 100)
      : (quote.discount ?? 0)
    const discLabel = quote.discountType === "percentage" ? `${quote.discount}%` : "monto fijo"
    out.push(`🏷️ *Descuento (${discLabel}):* −$${Math.round(discAmount).toLocaleString("es-MX")}`)
  }
  out.push(`📊 *IVA (16%):* $${Math.round(quote.iva).toLocaleString("es-MX")}`)
  out.push(`✅ *Total:* $${Math.round(quote.total).toLocaleString("es-MX")}`)
  out.push("")

  // Payment terms — show deposit + balance due based on the rule applied
  const rule = lookupPaymentRule(quote.paymentRule)
  const balanceDue = quote.total - quote.depositRequired
  out.push("💳 *Condiciones de pago:*")
  out.push(`   ${rule.label}`)
  if (rule.depositPct < 1.0) {
    out.push(`   • Anticipo: $${Math.round(quote.depositRequired).toLocaleString("es-MX")}`)
    out.push(`   • Saldo contra entrega: $${Math.round(balanceDue).toLocaleString("es-MX")}`)
  } else {
    // COD — full amount upfront
    out.push(`   • Pago total: $${Math.round(quote.total).toLocaleString("es-MX")} (antes de iniciar)`)
  }
  out.push("")

  // Dates
  if (quote.eventDate) {
    const d = new Date(quote.eventDate)
    out.push(
      `📅 *Fecha:* ${d.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}`
    )
  }
  if (quote.validUntil) {
    const v = new Date(quote.validUntil)
    out.push(
      `⏰ *Válida hasta:* ${v.toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })}`
    )
  }
  if (quote.deliveryAddress) {
    out.push(`📍 ${quote.deliveryAddress}`)
  }
  if (quote.cardMessage) {
    out.push(`💌 Tarjeta: "${quote.cardMessage}"`)
  }
  out.push("")
  out.push("💳 *Opciones de pago:*")
  out.push("• Efectivo")
  out.push("• Transferencia SPEI (datos abajo)")
  out.push("")
  out.push(
    "Para confirmar su cotización, por favor realice el anticipo y envíe el comprobante. Una vez recibido, procederemos con la preparación de su pedido. 🌷"
  )
  out.push("")
  out.push("¡Quedamos a la espera! Gracias por su confianza. 💐")

  return out.join("\n")
}
