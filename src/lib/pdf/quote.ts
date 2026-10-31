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
  notes?: string | null
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

  // === HEADER: Logo + business info (left) | Quote meta (right) ===
  const headerTable: Content = {
    table: {
      widths: ["*", "*"],
      body: [
        [
          {
            stack: [
              { text: "✿ Flor by Maria", color: COLOR_ROSE, bold: true, fontSize: 24, lineHeight: 1.1 },
              { text: "Bouquets & arreglos personalizados", color: COLOR_STONE_LIGHT, italics: true, fontSize: 10, margin: [0, 2, 0, 6] },
              {
                text: [
                  { text: "Flor by Maria\n", bold: true, color: COLOR_STONE, fontSize: 9 },
                  { text: "Arreglos florales & bouquets\n", color: COLOR_STONE, fontSize: 9 },
                  { text: "Ciudad de México\n", color: COLOR_STONE, fontSize: 9 },
                  { text: "WhatsApp: (pendiente)\n", color: COLOR_STONE, fontSize: 9 },
                  { text: "Email: hola@florbymaria.mx", color: COLOR_STONE, fontSize: 9 },
                ],
              },
            ],
          },
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
  const totalsTable: any = {
    table: {
      widths: ["*", "auto"],
      body: [
        [
          { text: "Subtotal", color: COLOR_STONE_LIGHT, fontSize: 9, alignment: "right" },
          { text: `$${payload.subtotal.toLocaleString("es-MX", { maximumFractionDigits: 2 })}`, color: COLOR_STONE, fontSize: 10, alignment: "right" },
        ],
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
      ],
    },
    layout: "noBorders",
    margin: [0, 0, 0, 4],
  }
  // Only show balance due row if there's actually a balance (i.e. deposit < 100%)
  if (rule.depositPct < 1.0) {
    totalsTable.table.body.push([
      { text: "Saldo contra entrega", color: COLOR_STONE_LIGHT, fontSize: 9, alignment: "right" },
      { text: `$${balanceDue.toLocaleString("es-MX", { maximumFractionDigits: 2 })}`, color: COLOR_AMBER, fontSize: 10, alignment: "right" },
    ])
  }

  // === CONDICIONES DE PAGO ===
  const paymentSection: Content = {
    stack: [
      { text: "CONDICIONES DE PAGO", color: COLOR_STONE_LIGHT, fontSize: 9, bold: true, margin: [0, 8, 0, 4] },
      {
        text: [
          { text: `${rule.label}\n`, color: COLOR_STONE, fontSize: 10, bold: true },
          { text: "Opciones de pago:\n", color: COLOR_STONE_LIGHT, fontSize: 9 },
          { text: "• Efectivo\n", color: COLOR_STONE, fontSize: 9 },
          { text: "• Transferencia SPEI (datos bancarios al confirmar)", color: COLOR_STONE, fontSize: 9 },
        ],
      },
    ],
    margin: [0, 0, 0, 8],
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

  // === VALIDITY NOTICE ===
  const validityNotice: Content = {
    stack: [
      {
        text: `Esta cotización es válida hasta el ${validUntilFmt}.`,
        color: COLOR_AMBER, fontSize: 9, italics: true, alignment: "center",
        margin: [0, 4, 0, 4],
      },
    ],
  }

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
      ...notesSection,
      validityNotice,
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
