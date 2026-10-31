// src/lib/pdf/recibo.ts — v1.8: Recibo PDF generator (Node)
//
// Replaces scripts/generate_invoice_pdf.py (ReportLab).
// Produces a byte-for-byte equivalent PDF in Spanish using pdfmake.
//
// Called by: src/app/api/orders/[id]/pdf/route.ts
//
// Input: order payload (same shape as v1.7's Python script).
// Output: PDF buffer (Promise<Buffer>).

import type { TDocumentDefinitions, Content } from "pdfmake/interfaces"
import { formatSpanishLong } from "./utils"

// === Brand colors (match v1.7 exactly) ===
const COLOR_ROSE = "#BE185D"
const COLOR_ROSE_LIGHT = "#FCE7F3"
const COLOR_STONE = "#44403C"
const COLOR_STONE_LIGHT = "#78716C"
const COLOR_AMBER = "#D97706"
const COLOR_EMERALD = "#047857"
const COLOR_BORDER = "#E7E5E4"
const COLOR_BG_LIGHT = "#FAFAF9"

// Register fonts — pdfmake needs explicit font registration.
// Helvetica is the default in ReportLab, but pdfmake uses Roboto by default.
// We use Helvetica (built into pdfmake via the standard PDF fonts).
const fonts = {
  Helvetica: {
    normal: "Helvetica",
    bold: "Helvetica-Bold",
    italics: "Helvetica-Oblique",
    bolditalics: "Helvetica-BoldOblique",
  },
}

// === Payload interface (matches v1.7 Python input) ===
export interface ReciboPayload {
  orderNumber: string
  createdAt: string
  deliveryDate: string | null
  status?: string
  customer: {
    name: string
    phone?: string
    email?: string
    address?: string
  }
  deliveryAddress: string
  cardMessage?: string | null
  deliveryNotes?: string | null
  lineItems: Array<{
    productName: string
    productSize?: string | null
    qty: number
    unitPrice: number
    lineTotal: number
  }>
  subtotal: number
  iva: number
  deliveryFee: number
  discount: number
  total: number
  paymentMethod: "cash" | "spei" | "online_link" | null
}

// === Build the document definition (pdfmake's "JSON" format) ===
function buildDocDefinition(payload: ReciboPayload): TDocumentDefinitions {
  const createdDate = formatSpanishLong(payload.createdAt)
  const deliveryDateFmt = formatSpanishLong(payload.deliveryDate)

  // === HEADER: Logo + business info (left) | Recibo meta (right) ===
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
              { text: "RECIBO", bold: true, fontSize: 14, color: COLOR_STONE, alignment: "right" },
              { text: "#", fontSize: 9, color: COLOR_STONE_LIGHT, alignment: "right", margin: [0, 4, 0, 0] },
              { text: payload.orderNumber, bold: true, fontSize: 11, color: COLOR_STONE, alignment: "right" },
              { text: "Fecha de emisión:", fontSize: 9, color: COLOR_STONE_LIGHT, alignment: "right", margin: [0, 8, 0, 0] },
              { text: createdDate, fontSize: 10, color: COLOR_STONE, alignment: "right" },
              { text: "Fecha de entrega:", fontSize: 9, color: COLOR_STONE_LIGHT, alignment: "right", margin: [0, 8, 0, 0] },
              { text: deliveryDateFmt, bold: true, fontSize: 10, color: COLOR_ROSE, alignment: "right" },
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
          { text: "CANT.", color: "white", bold: true, fontSize: 9, fillColor: COLOR_ROSE, alignment: "right" },
          { text: "PRECIO UNIT.", color: "white", bold: true, fontSize: 9, fillColor: COLOR_ROSE, alignment: "right" },
          { text: "TOTAL", color: "white", bold: true, fontSize: 9, fillColor: COLOR_ROSE, alignment: "right" },
        ],
        ...payload.lineItems.map((li) => {
          const productText = li.productSize
            ? `${li.productName} (${li.productSize})`
            : li.productName
          return [
            { text: productText, color: COLOR_STONE, fontSize: 10 },
            { text: String(li.qty), color: COLOR_STONE, fontSize: 10, alignment: "right" },
            { text: `$${li.unitPrice.toLocaleString("es-MX")} MXN`, color: COLOR_STONE, fontSize: 10, alignment: "right" },
            { text: `$${li.lineTotal.toLocaleString("es-MX")} MXN`, color: COLOR_STONE, fontSize: 10, alignment: "right" },
          ]
        }),
      ],
    },
    layout: {
      fillColor: (rowIndex: number) =>
        rowIndex === 0 ? null : rowIndex % 2 === 0 ? COLOR_BG_LIGHT : null,
      hLineColor: () => COLOR_BORDER,
      hLineWidth: () => 0.25,
      vLineColor: () => COLOR_BORDER,
      vLineWidth: () => 0.25,
      paddingTop: () => 6,
      paddingBottom: () => 6,
      paddingLeft: () => 8,
      paddingRight: () => 8,
    },
    margin: [0, 0, 0, 6],
  }

  // === TOTALES ===
  const totalsRows: Content[][] = [
    [
      { text: "Subtotal (pre-IVA)", color: COLOR_STONE, fontSize: 10 },
      { text: `$${payload.subtotal.toLocaleString("es-MX")} MXN`, color: COLOR_STONE, fontSize: 10, alignment: "right" },
    ],
    [
      { text: "IVA (16%)", color: COLOR_STONE, fontSize: 10 },
      { text: `$${payload.iva.toLocaleString("es-MX")} MXN`, color: COLOR_STONE, fontSize: 10, alignment: "right" },
    ],
    [
      { text: "Envío", color: COLOR_STONE, fontSize: 10 },
      { text: `$${payload.deliveryFee.toLocaleString("es-MX")} MXN`, color: COLOR_STONE, fontSize: 10, alignment: "right" },
    ],
  ]
  if (payload.discount > 0) {
    totalsRows.push([
      { text: "Descuento", color: COLOR_ROSE, fontSize: 10 },
      { text: `−$${payload.discount.toLocaleString("es-MX")} MXN`, color: COLOR_ROSE, fontSize: 10, alignment: "right" },
    ])
  }
  totalsRows.push([
    { text: "TOTAL", bold: true, fontSize: 12, color: COLOR_STONE },
    { text: `$${payload.total.toLocaleString("es-MX")} MXN`, bold: true, fontSize: 14, color: COLOR_ROSE, alignment: "right" },
  ])

  const totalsTable: Content = {
    table: {
      widths: ["*", "auto"],
      body: totalsRows,
    },
    layout: {
      fillColor: (rowIndex: number, node: any) => {
        // Highlight the TOTAL row (last one)
        if (rowIndex === node.table.body.length - 1) return COLOR_ROSE_LIGHT
        return null
      },
      hLineColor: () => COLOR_BORDER,
      hLineWidth: () => 0.25,
      vLineColor: () => COLOR_BORDER,
      vLineWidth: () => 0.25,
      paddingTop: () => 4,
      paddingBottom: () => 4,
      paddingLeft: () => 8,
      paddingRight: () => 8,
    },
    margin: [0, 0, 0, 8],
  }

  // === MENSAJE DE TARJETA (si existe) ===
  const cardMsgSection: Content[] = []
  if (payload.cardMessage) {
    cardMsgSection.push({
      stack: [
        { text: "MENSAJE DE TARJETA", color: COLOR_STONE_LIGHT, fontSize: 9, margin: [0, 0, 0, 4] },
        { text: `"${payload.cardMessage}"`, italics: true, color: COLOR_ROSE, fontSize: 10 },
      ],
      fillColor: COLOR_ROSE_LIGHT,
      margin: [12, 8, 12, 8],
    })
    cardMsgSection.push({ text: "", margin: [0, 0, 0, 6] })
  }

  // === INSTRUCCIONES DE PAGO ===
  let paymentHtml: Content[] = []
  if (payload.paymentMethod === "cash") {
    paymentHtml = [
      { text: "Pago: Efectivo contra entrega", bold: true, color: COLOR_EMERALD, fontSize: 9 },
      { text: "Por favor ten el monto exacto listo al recibir tu bouquet.", color: COLOR_STONE, fontSize: 9, margin: [0, 2, 0, 0] },
    ]
  } else if (payload.paymentMethod === "spei") {
    paymentHtml = [
      { text: "Pago: Transferencia SPEI", bold: true, color: COLOR_STONE, fontSize: 9 },
      { text: "Banco: Banco Ejemplo", color: COLOR_STONE, fontSize: 9, margin: [0, 2, 0, 0] },
      { text: "CLABE: 012 345 67890 1234567", color: COLOR_STONE, fontSize: 9, margin: [0, 2, 0, 0] },
      { text: "Titular: Flor by Maria", color: COLOR_STONE, fontSize: 9, margin: [0, 2, 0, 0] },
      { text: `Referencia: ${payload.orderNumber}`, color: COLOR_STONE, fontSize: 9, margin: [0, 2, 0, 0] },
      { text: "Envía el comprobante por WhatsApp una vez transferido.", color: COLOR_STONE_LIGHT, fontSize: 9, margin: [0, 2, 0, 0] },
    ]
  } else if (payload.paymentMethod === "online_link") {
    paymentHtml = [
      { text: "Pago: En línea", bold: true, color: COLOR_STONE, fontSize: 9 },
      { text: "Recibirás un enlace de pago seguro por WhatsApp en breve.", color: COLOR_STONE, fontSize: 9, margin: [0, 2, 0, 0] },
      { text: "El enlace expira en 24 horas.", color: COLOR_STONE_LIGHT, fontSize: 9, margin: [0, 2, 0, 0] },
    ]
  } else {
    paymentHtml = [
      { text: "Método de pago por confirmar. Te contactaremos por WhatsApp en breve.", color: COLOR_STONE_LIGHT, fontSize: 9 },
    ]
  }

  const paymentSection: Content = {
    stack: paymentHtml,
    fillColor: COLOR_BG_LIGHT,
    margin: [12, 8, 12, 8],
  }

  // === NOTA DE AGRADECIMIENTO ===
  const thankYouNote: Content = {
    text: "Gracias por elegir a Flor by Maria. Cada bouquet se elabora con amor y cuidado. Para dudas sobre tu pedido, contáctanos por WhatsApp.",
    color: COLOR_STONE_LIGHT,
    fontSize: 9,
    margin: [0, 4, 0, 0],
  }

  // === FOOTER (page-level) ===
  const footerFunction = (currentPage: number, pageCount: number): Content => ({
    stack: [
      {
        canvas: [
          { type: "line", x1: 0, y1: 0, x2: 595 - 36 - 36, y2: 0, lineWidth: 0.5, lineColor: COLOR_BORDER },
        ],
        margin: [0, 0, 0, 2],
      },
      {
        columns: [
          { text: "Flor by Maria · Gracias por su compra", color: COLOR_STONE_LIGHT, fontSize: 8 },
          { text: `Recibo ${payload.orderNumber}`, color: COLOR_STONE_LIGHT, fontSize: 8, alignment: "right" },
        ],
      },
    ],
    margin: [36, 0, 36, 0],
  })

  return {
    pageSize: "A4",
    pageMargins: [36, 36, 36, 36], // 18mm ≈ 51pt, but using 36pt for visual balance
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
      ...cardMsgSection,
      paymentSection,
      thankYouNote,
    ],
    footer: footerFunction,
    // Top decorative band (rose)
    background: () => ({
      canvas: [
        { type: "rect", x: 0, y: 0, w: 595, h: 22, color: COLOR_ROSE },
      ],
    }),
  }
}

// === Public API ===

/**
 * Generate the Recibo PDF and return it as a Buffer.
 * The API route streams this directly to the browser — no disk writes.
 */
export async function generateReciboPdf(payload: ReciboPayload): Promise<Buffer> {
  const docDefinition = buildDocDefinition(payload)
  // Dynamically import pdfmake to avoid bundling issues at build time.
  // pdfmake depends on @foliojs-fork/fontkit which has data files that
  // Next.js's bundler can't collect during page data collection.
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
