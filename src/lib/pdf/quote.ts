// src/lib/pdf/quote.ts — v1.9: Quote PDF generator (Node)
//
// Customer-facing quote document in Spanish, branded as "COTIZACIÓN".
// Mirrors the visual style of src/lib/pdf/recibo.ts (same fonts, colors,
// layout) but adapted for quotes:
//   - Header says "COTIZACIÓN" instead of "RECIBO"
//   - Includes validUntil date (quotes expire; orders don't)
//   - Includes payment terms section (deposit + balance due + rule label)
//   - Uses quoteNumber instead of orderNumber
//
// Called by: src/app/api/quotes/[id]/pdf/route.ts
//
// Input: QuotePayload. Output: PDF buffer (Promise<Buffer>).

import type { TDocumentDefinitions, Content } from "pdfmake/interfaces"
import { formatSpanishLong, PAGE_SIZE, PAGE_WIDTH_PT, HEADER_BAND_HEIGHT_PT } from "./utils"
import { lookupPaymentRule } from "@/lib/payment-rules"

// === Brand colors (match recibo.ts exactly for consistency) ===
const COLOR_ROSE = "#BE185D"
const COLOR_ROSE_LIGHT = "#FCE7F3"
const COLOR_STONE = "#44403C"
const COLOR_STONE_LIGHT = "#78716C"
const COLOR_AMBER = "#D97706"
const COLOR_EMERALD = "#047857"
const COLOR_BORDER = "#E7E5E4"
const COLOR_BG_LIGHT = "#FAFAF9"

const fonts = {
  Helvetica: {
    normal: "Helvetica",
    bold: "Helvetica-Bold",
    italics: "Helvetica-Oblique",
    bolditalics: "Helvetica-BoldOblique",
  },
}

// === Payload interface ===
export interface QuotePayload {
  quoteNumber: string
  quoteDate: string
  validUntil: string | null
  customer: {
    name: string
    phone?: string
    email?: string
    address?: string
  }
  deliveryAddress?: string | null
  eventType?: string | null
  eventDate: string | null
  lineItems: Array<{
    description: string
    qty: number
    unitPrice: number
    lineTotal: number
  }>
  subtotal: number
  iva: number
  total: number
  depositRequired: number
  paymentRule: string | null
  discount?: number
  discountType?: string
  deliveryFee?: number
  notes?: string | null
  /** v1.9.1: Legal template text (LT-002 or LT-003) to render in a
   * "TÉRMINOS Y CONDICIONES" section. Null = omit the section. */
  termsText?: string | null
}

// === Build the document definition ===
function buildDocDefinition(payload: QuotePayload): TDocumentDefinitions {
  const quoteDateFmt = formatSpanishLong(payload.quoteDate)
  const validUntilFmt = payload.validUntil
    ? formatSpanishLong(payload.validUntil)
    : "—"
  const eventDateFmt = payload.eventDate ? formatSpanishLong(payload.eventDate) : "—"

  const rule = lookupPaymentRule(payload.paymentRule)
  const balanceDue = payload.total - payload.depositRequired

  // === HEADER: Logo (left) + Business info (next) | Quote meta (right) ===
  //
  // Layout: 3 columns inside a single header row
  //   [logo 32pt] [business name + tagline + contact info]  [COTIZACIÓN meta]
  //
  // The previous version used a "✿ Flor by Maria" text line where the ✿
  // glyph (U+273F) doesn't exist in Helvetica. VLM inspection of the
  // rendered PDF showed the ✿ rendered as a blank or fallback box,
  // and the business name overlapped it visually because the broken
  // glyph had unexpected width.
  //
  // This version embeds the actual flower-logo.svg (rose square with a
  // white 5-petal flower + yellow center) as an inline SVG element
  // using pdfmake's `svg` content type. SVG is preferred over PNG
  // because:
  //   1. It scales crisply at any size (logo is 36pt in PDF, original
  //      viewBox is 32×32 — perfect aspect ratio).
  //   2. No need to bundle the PNG via VFS or read the file at runtime
  //      (Vercel serverless doesn't bundle arbitrary fs reads).
  //   3. The SVG content is small (867 bytes) and easy to inline.
  //
  // The flower SVG matches public/flower-logo.svg exactly — kept in
  // sync by hand. If the logo file changes, update this string too.
  const FLOWER_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="6" fill="rgb(190, 24, 93)"/>
  <g transform="translate(16,16)">
    <g fill="#FFFFFF">
      <ellipse cx="0" cy="-7" rx="3.2" ry="5.5"/>
      <ellipse cx="0" cy="-7" rx="3.2" ry="5.5" transform="rotate(72)"/>
      <ellipse cx="0" cy="-7" rx="3.2" ry="5.5" transform="rotate(144)"/>
      <ellipse cx="0" cy="-7" rx="3.2" ry="5.5" transform="rotate(216)"/>
      <ellipse cx="0" cy="-7" rx="3.2" ry="5.5" transform="rotate(288)"/>
    </g>
    <circle r="2.6" fill="#FFD23F"/>
    <circle r="1" fill="rgb(190, 24, 93)" opacity="0.35"/>
  </g>
</svg>`

  const headerTable: Content = {
    table: {
      // 3 columns: logo (fixed 42pt) | business info (flex) | quote meta (auto)
      widths: [42, "*", "auto"],
      body: [
        [
          // Col 1: Logo (vertically centered via margin top)
          {
            svg: FLOWER_LOGO_SVG,
            width: 36,
            // Slight top margin to vertically align with the "Flor by Maria" text baseline
            margin: [0, 2, 0, 0],
          },
          // Col 2: Business name + tagline + contact info (left-aligned)
          {
            stack: [
              { text: "Flor by Maria", color: COLOR_ROSE, bold: true, fontSize: 24, lineHeight: 1.1 },
              { text: "Bouquets & arreglos personalizados", color: COLOR_STONE_LIGHT, italics: true, fontSize: 10, margin: [0, 2, 0, 6] },
              {
                text: [
                  { text: "Arreglos florales & bouquets\n", color: COLOR_STONE, fontSize: 9 },
                  { text: "Ciudad de México\n", color: COLOR_STONE, fontSize: 9 },
                  { text: "WhatsApp: (pendiente)\n", color: COLOR_STONE, fontSize: 9 },
                  { text: "Email: hola@florbymaria.mx", color: COLOR_STONE, fontSize: 9 },
                ],
              },
            ],
            // Left-align the column, give it a tiny left margin so it
            // doesn't touch the logo
            margin: [4, 0, 0, 0],
          },
          // Col 3: Quote meta (right-aligned)
          {
            stack: [
              { text: "COTIZACIÓN", bold: true, fontSize: 14, color: COLOR_STONE, alignment: "right" },
              { text: "#", fontSize: 9, color: COLOR_STONE_LIGHT, alignment: "right", margin: [0, 4, 0, 0] },
              { text: payload.quoteNumber, bold: true, fontSize: 11, color: COLOR_STONE, alignment: "right" },
              { text: "Fecha de emisión:", fontSize: 9, color: COLOR_STONE_LIGHT, alignment: "right", margin: [0, 8, 0, 0] },
              { text: quoteDateFmt, fontSize: 10, color: COLOR_STONE, alignment: "right" },
              { text: "Válida hasta:", fontSize: 9, color: COLOR_STONE_LIGHT, alignment: "right", margin: [0, 8, 0, 0] },
              { text: validUntilFmt, bold: true, fontSize: 10, color: COLOR_AMBER, alignment: "right" },
            ],
          },
        ],
      ],
    },
    layout: "noBorders",
    margin: [0, 0, 0, 12],
  }

  // === PARA + ENTREGAR EN ===
  const billToLines: Content[] = []
  if (payload.customer.name) {
    billToLines.push({ text: payload.customer.name, bold: true, color: COLOR_STONE, fontSize: 10 })
  }
  if (payload.customer.phone) {
    billToLines.push({ text: `Tel: ${payload.customer.phone}`, color: COLOR_STONE, fontSize: 10 })
  }
  if (payload.customer.email) {
    billToLines.push({ text: payload.customer.email, color: COLOR_STONE, fontSize: 10 })
  }
  if (billToLines.length === 0) {
    billToLines.push({ text: "—", color: COLOR_STONE, fontSize: 10 })
  }

  const deliveryLines: Content[] = []
  if (payload.deliveryAddress) {
    deliveryLines.push({ text: payload.deliveryAddress, color: COLOR_STONE, fontSize: 10 })
  } else if (payload.customer.address) {
    deliveryLines.push({ text: payload.customer.address, color: COLOR_STONE, fontSize: 10 })
  } else {
    deliveryLines.push({ text: "Recoger en taller", color: COLOR_STONE, fontSize: 10 })
  }
  if (payload.eventDate) {
    deliveryLines.push({ text: `Fecha del evento: ${eventDateFmt}`, color: COLOR_ROSE, fontSize: 10, bold: true, margin: [0, 2, 0, 0] })
  }

  const billToTable: Content = {
    table: {
      widths: ["*", "*"],
      body: [
        [
          { text: "PARA", color: COLOR_STONE_LIGHT, fontSize: 9, fillColor: COLOR_BG_LIGHT },
          { text: "ENTREGAR EN", color: COLOR_STONE_LIGHT, fontSize: 9, fillColor: COLOR_BG_LIGHT },
        ],
        [billToLines, deliveryLines],
      ],
    },
    margin: [0, 0, 0, 8],
  }

  // === TABLA DE PRODUCTOS ===
  // Type as any: pdfmake's Content type is overly strict about table body
  // cell shapes (mixed text/object rows), but the runtime accepts them.
  const lineItemsTable: any = {
    table: {
      widths: ["*", "auto", "auto", "auto"],
      headerRows: 1,
      body: [
        [
          { text: "PRODUCTO", color: "white", bold: true, fontSize: 9, fillColor: COLOR_ROSE },
          { text: "CANT.", color: "white", bold: true, fontSize: 9, fillColor: COLOR_ROSE, alignment: "center" },
          { text: "PRECIO", color: "white", bold: true, fontSize: 9, fillColor: COLOR_ROSE, alignment: "right" },
          { text: "IMPORTE", color: "white", bold: true, fontSize: 9, fillColor: COLOR_ROSE, alignment: "right" },
        ],
        ...payload.lineItems.map((li) => [
          { text: li.description, color: COLOR_STONE, fontSize: 9 },
          { text: String(li.qty), color: COLOR_STONE, fontSize: 9, alignment: "center" },
          { text: `$${li.unitPrice.toLocaleString("es-MX", { maximumFractionDigits: 2 })}`, color: COLOR_STONE, fontSize: 9, alignment: "right" },
          { text: `$${li.lineTotal.toLocaleString("es-MX", { maximumFractionDigits: 2 })}`, color: COLOR_STONE, fontSize: 9, alignment: "right", bold: true },
        ]),
      ],
    },
    layout: {
      hLineColor: () => COLOR_BORDER,
      vLineColor: () => COLOR_BORDER,
      paddingTop: () => 4,
      paddingBottom: () => 4,
    },
    margin: [0, 0, 0, 8],
  }

  // === TOTALES ===
  // (balanceDue already computed above near rule lookup)
  // Compute discount amount for display
  const discountAmount = payload.discount && payload.discount > 0
    ? (payload.discountType === "percentage"
        ? payload.subtotal * (payload.discount / 100)
        : payload.discount)
    : 0

  const totalsBody: any[][] = [
    [
      { text: "Subtotal", color: COLOR_STONE_LIGHT, fontSize: 9, alignment: "right" },
      { text: `$${payload.subtotal.toLocaleString("es-MX", { maximumFractionDigits: 2 })}`, color: COLOR_STONE, fontSize: 10, alignment: "right" },
    ],
  ]

  if (discountAmount > 0) {
    const discLabel = payload.discountType === "percentage"
      ? `Descuento (${payload.discount}%)`
      : "Descuento"
    totalsBody.push([
      { text: discLabel, color: COLOR_ROSE, fontSize: 9, alignment: "right" },
      { text: `−$${discountAmount.toLocaleString("es-MX", { maximumFractionDigits: 2 })}`, color: COLOR_ROSE, fontSize: 10, alignment: "right" },
    ])
  }

  // Delivery fee
  const fee = payload.deliveryFee ?? 0
  if (fee > 0) {
    totalsBody.push([
      { text: "Envío", color: COLOR_STONE_LIGHT, fontSize: 9, alignment: "right" },
      { text: `$${fee.toLocaleString("es-MX", { maximumFractionDigits: 2 })}`, color: COLOR_STONE, fontSize: 10, alignment: "right" },
    ])
  }

  totalsBody.push(
    [
      { text: "IVA (16%)", color: COLOR_STONE_LIGHT, fontSize: 9, alignment: "right" },
      { text: `$${payload.iva.toLocaleString("es-MX", { maximumFractionDigits: 2 })}`, color: COLOR_STONE, fontSize: 10, alignment: "right" },
    ],
    [
      { text: "TOTAL", color: COLOR_ROSE, fontSize: 11, bold: true, alignment: "right" },
      { text: `$${payload.total.toLocaleString("es-MX", { maximumFractionDigits: 2 })}`, color: COLOR_ROSE, fontSize: 13, bold: true, alignment: "right" },
    ],
    [
      { text: `Anticipo (${Math.round(rule.depositPct * 100)}%)`, color: COLOR_STONE_LIGHT, fontSize: 9, alignment: "right" },
      { text: `$${payload.depositRequired.toLocaleString("es-MX", { maximumFractionDigits: 2 })}`, color: COLOR_EMERALD, fontSize: 10, alignment: "right", bold: true },
    ],
  )

  // Only show balance due row if there's actually a balance
  if (rule.depositPct < 1.0) {
    totalsBody.push([
      { text: "Saldo contra entrega", color: COLOR_STONE_LIGHT, fontSize: 9, alignment: "right" },
      { text: `$${balanceDue.toLocaleString("es-MX", { maximumFractionDigits: 2 })}`, color: COLOR_AMBER, fontSize: 10, alignment: "right" },
    ])
  }

  const totalsTable: any = {
    table: {
      widths: ["*", "auto"],
      body: totalsBody,
    },
    layout: "noBorders",
    margin: [0, 0, 0, 4],
  }

  // === CONDICIONES DE PAGO ===
  // Two clearly separated blocks: payment rule (top) + payment options (bottom).
  // The previous version had these crammed into a single mixed-font text[]
  // which made the different sizes/styles look cluttered. Now each block is
  // its own paragraph with consistent styling and proper spacing.
  const paymentSection: Content = {
    stack: [
      // Block 1: section header + payment rule label
      { text: "CONDICIONES DE PAGO", color: COLOR_STONE_LIGHT, fontSize: 9, bold: true, margin: [0, 8, 0, 4] },
      { text: rule.label, color: COLOR_STONE, fontSize: 10, bold: true, margin: [0, 0, 0, 10] },

      // Block 2: payment options — its own sub-heading + bullet list
      { text: "Opciones de pago:", color: COLOR_STONE_LIGHT, fontSize: 9, margin: [0, 0, 0, 3] },
      {
        ul: [
          { text: "Efectivo", color: COLOR_STONE, fontSize: 9 },
          { text: "Transferencia SPEI (datos bancarios al confirmar)", color: COLOR_STONE, fontSize: 9 },
        ],
        // Slight indent so the bullets visually belong to "Opciones de pago:"
        margin: [12, 0, 0, 4],
      },
    ],
    margin: [0, 0, 0, 8],
  }

  // === TÉRMINOS Y CONDICIONES (LT-002 or LT-003) ===
  // Rendered only when `payload.termsText` is provided. For everyday / no-event
  // quotes this is LT-002 (Condiciones de Pedidos Pequeños). For event quotes
  // it's LT-003 (Condiciones del Servicio — Eventos). The PDF API route
  // selects which template to load.
  const termsSection: Content[] = []
  if (payload.termsText) {
    // Split the template text into paragraphs (it uses \n\n as paragraph breaks)
    // and render each as its own line so the layout reads naturally.
    const paragraphs = payload.termsText
      .split(/\n\n+/)
      .map((p) => p.trim())
      .filter(Boolean)

    termsSection.push({
      stack: [
        { text: "TÉRMINOS Y CONDICIONES", color: COLOR_STONE_LIGHT, fontSize: 9, bold: true, margin: [0, 4, 0, 4] },
        ...paragraphs.map((p) => ({
          text: p,
          color: COLOR_STONE,
          fontSize: 8,
          // Slightly tighter line height for the small print
          lineHeight: 1.25,
          margin: [0, 0, 0, 4],
        })),
      ],
      // Box it in a subtle background so it reads as "legal fine print"
      // distinct from the rest of the document.
      background: COLOR_BG_LIGHT,
      margin: [0, 0, 0, 8],
      padding: 8,
    } as Content)
  }

  // === NOTAS (if any) ===
  const notesSection: Content[] = []
  if (payload.notes) {
    notesSection.push({
      stack: [
        { text: "NOTAS", color: COLOR_STONE_LIGHT, fontSize: 9, bold: true, margin: [0, 4, 0, 4] },
        { text: payload.notes, color: COLOR_STONE, fontSize: 9, italics: true },
      ],
      margin: [0, 0, 0, 8],
    })
  }

  // (Validity notice removed — the "Válida hasta" date is already shown
  // prominently in the header at the top of the page, so a second copy
  // at the bottom was redundant. Per Maria's request, keep top only.)

  // === THANK YOU ===
  // Note: no emoji here because Helvetica doesn't render them. (The recibo.ts
  // file has the same constraint.) Emojis are reserved for the WhatsApp message.
  const thankYouNote: Content = {
    text: "¡Gracias por su confianza!",
    color: COLOR_ROSE, fontSize: 11, bold: true, alignment: "center",
    margin: [0, 8, 0, 0],
  }

  // === FOOTER (page numbers + business info) ===
  // Cast to any: pdfmake's DynamicContent type doesn't accept the function
  // signature cleanly, but it works at runtime.
  const footerFunction: any = (currentPage: number, pageCount: number) => ({
    columns: [
      { text: "Flor by Maria · CDMX · hola@florbymaria.mx", color: COLOR_STONE_LIGHT, fontSize: 8, margin: [30, 0, 0, 0] },
      { text: `Página ${currentPage} de ${pageCount}`, color: COLOR_STONE_LIGHT, fontSize: 8, alignment: "right", margin: [0, 0, 30, 0] },
    ],
    margin: [0, 10, 0, 0],
  })

  return {
    pageSize: PAGE_SIZE,
    pageMargins: [36, 36, 36, 36],
    defaultStyle: {
      font: "Helvetica",
      fontSize: 10,
      color: COLOR_STONE,
      lineHeight: 1.2,
    },
    content: [
      headerTable,
      billToTable,
      lineItemsTable,
      totalsTable,
      paymentSection,
      ...termsSection,
      ...notesSection,
      // validityNotice intentionally omitted — header already shows the
      // "Válida hasta" date, so a duplicate at the bottom was redundant.
      thankYouNote,
    ],
    footer: footerFunction,
    background: () => ({
      canvas: [
        { type: "rect", x: 0, y: 0, w: PAGE_WIDTH_PT, h: HEADER_BAND_HEIGHT_PT, color: COLOR_ROSE },
      ],
    }),
  }
}

// === Public API ===

/**
 * Generate the Quote PDF and return it as a Buffer.
 * The API route streams this directly to the browser — no disk writes.
 */
export async function generateQuotePdf(payload: QuotePayload): Promise<Buffer> {
  const docDefinition = buildDocDefinition(payload)
  const { default: PdfPrinter } = await import("pdfmake")
  const printer = new PdfPrinter(fonts)
  const pdfDoc = printer.createPdfKitDocument(docDefinition, {})
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = []
    pdfDoc.on("data", (chunk) => chunks.push(Buffer.from(chunk)))
    pdfDoc.on("end", () => resolve(Buffer.concat(chunks)))
    pdfDoc.on("error", reject)
    pdfDoc.end()
  })
}
