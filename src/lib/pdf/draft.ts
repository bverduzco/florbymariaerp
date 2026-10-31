// src/lib/pdf/draft.ts — v1.8: Draft Excel generator (Node)
//
// Replaces scripts/generate_draft.py (openpyxl).
// Produces a customer-facing "ERP Draft" Excel with 3 sheets:
//   1. Orders
//   2. Customers
//   3. Line Items
//
// Called by: src/app/api/orders/draft/route.ts
//
// Output: Excel buffer (Promise<Buffer>) — streamed directly to browser.

import ExcelJS from "exceljs"
import { nowGmtMinus6Label } from "./utils"

// === Brand colors (match v1.7 exactly) ===
const COLOR_ROSE = "BE185D"
const COLOR_STONE = "44403C"
const COLOR_STONE_LIGHT = "78716C"
const COLOR_BG_LIGHT = "FAFAF9"
const COLOR_BORDER = "E7E5E4"

// === Payload interface ===
export interface DraftCustomer {
  id: string
  name: string
  phone: string
  email: string
  address: string
  notes: string
  createdAt: string
}

export interface DraftLineItem {
  orderId: string
  orderNumber: string
  productName: string
  productSize: string | null
  qty: number
  unitPrice: number
  lineTotal: number
}

export interface DraftOrder {
  id: string
  orderNumber: string
  status: string
  customerName: string | null
  customerPhone: string | null
  deliveryDate: string | null
  deliveryAddress: string | null
  deliveryNotes: string | null
  internalNotes: string | null
  cardMessage: string | null
  paymentStatus: string
  paymentMethod: string | null
  paymentOptionsSentAt: string | null
  paymentConfirmedAt: string | null
  createdAt: string
  total: number
}

export interface DraftPayload {
  orders: DraftOrder[]
  customers: DraftCustomer[]
  lineItems: DraftLineItem[]
  generatedAt?: string // optional override for testing
}

// === Style helpers ===

const TITLE_FONT: Partial<ExcelJS.Font> = {
  name: "Calibri",
  size: 16,
  bold: true,
  color: { argb: "FF" + COLOR_ROSE },
}

const SUBTITLE_FONT: Partial<ExcelJS.Font> = {
  name: "Calibri",
  size: 10,
  italic: true,
  color: { argb: "FF" + COLOR_STONE_LIGHT },
}

const HEADER_FONT: Partial<ExcelJS.Font> = {
  name: "Calibri",
  size: 11,
  bold: true,
  color: { argb: "FFFFFFFF" },
}

const HEADER_FILL: Partial<ExcelJS.Fill> = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF" + COLOR_ROSE },
}

const CELL_FONT: Partial<ExcelJS.Font> = {
  name: "Calibri",
  size: 10,
  color: { argb: "FF" + COLOR_STONE },
}

const BORDER_THIN: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FF" + COLOR_BORDER } },
  left: { style: "thin", color: { argb: "FF" + COLOR_BORDER } },
  bottom: { style: "thin", color: { argb: "FF" + COLOR_BORDER } },
  right: { style: "thin", color: { argb: "FF" + COLOR_BORDER } },
}

function applyHeaderStyle(cell: ExcelJS.Cell) {
  cell.font = HEADER_FONT
  cell.fill = HEADER_FILL as ExcelJS.Fill
  cell.alignment = { vertical: "middle", horizontal: "left" }
  cell.border = BORDER_THIN
}

function applyCellStyle(cell: ExcelJS.Cell, opts: { bold?: boolean; alignment?: Partial<ExcelJS.Alignment>; altRow?: boolean } = {}) {
  cell.font = { ...CELL_FONT, bold: opts.bold }
  cell.alignment = { vertical: "middle", horizontal: opts.alignment?.horizontal ?? "left", wrapText: true }
  if (opts.altRow) {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF" + COLOR_BG_LIGHT },
    }
  }
  cell.border = BORDER_THIN
}

// === Sheet builders ===

function buildOrdersSheet(wb: ExcelJS.Workbook, orders: DraftOrder[], generatedAt: string) {
  const ws = wb.addWorksheet("Orders")
  ws.columns = [
    { header: "Order #", key: "orderNumber", width: 14 },
    { header: "Status", key: "status", width: 18 },
    { header: "Customer", key: "customerName", width: 24 },
    { header: "Phone", key: "customerPhone", width: 16 },
    { header: "Delivery Date", key: "deliveryDate", width: 14 },
    { header: "Delivery Address", key: "deliveryAddress", width: 32 },
    { header: "Delivery Notes", key: "deliveryNotes", width: 28 },
    { header: "Internal Notes", key: "internalNotes", width: 28 },
    { header: "Card Message", key: "cardMessage", width: 32 },
    { header: "Payment Status", key: "paymentStatus", width: 16 },
    { header: "Payment Method", key: "paymentMethod", width: 14 },
    { header: "Total (MXN)", key: "total", width: 14 },
    { header: "Created At", key: "createdAt", width: 18 },
  ]

  // Title + subtitle
  ws.getCell("A1").value = "Orders — Draft Export (from app database)"
  ws.getCell("A1").font = TITLE_FONT
  ws.getCell("A2").value = `Generated ${generatedAt} (GMT-6)`
  ws.getCell("A2").font = SUBTITLE_FONT
  ws.spliceRows(3, 1) // blank row between subtitle and header

  // Header row
  const headerRow = ws.getRow(4)
  headerRow.values = ws.columns.map((c) => c.header) as ExcelJS.CellValue[]
  headerRow.eachCell((cell) => applyHeaderStyle(cell))
  headerRow.height = 22

  // Data rows
  orders.forEach((order, idx) => {
    const row = ws.addRow({
      orderNumber: order.orderNumber,
      status: order.status.replace(/_/g, " "),
      customerName: order.customerName ?? "",
      customerPhone: order.customerPhone ?? "",
      deliveryDate: order.deliveryDate ?? "",
      deliveryAddress: order.deliveryAddress ?? "",
      deliveryNotes: order.deliveryNotes ?? "",
      internalNotes: order.internalNotes ?? "",
      cardMessage: order.cardMessage ?? "",
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod ?? "",
      total: order.total,
      createdAt: order.createdAt,
    })
    row.eachCell((cell) => applyCellStyle(cell, { altRow: idx % 2 === 1 }))
    row.height = 32
  })

  // Freeze header
  ws.views = [{ state: "frozen", ySplit: 4 }]
}

function buildCustomersSheet(wb: ExcelJS.Workbook, customers: DraftCustomer[], generatedAt: string) {
  const ws = wb.addWorksheet("Customers")
  ws.columns = [
    { header: "Name", key: "name", width: 28 },
    { header: "Phone", key: "phone", width: 18 },
    { header: "Email", key: "email", width: 28 },
    { header: "Address", key: "address", width: 40 },
    { header: "Notes", key: "notes", width: 32 },
    { header: "Created At", key: "createdAt", width: 18 },
  ]

  ws.getCell("A1").value = "Customers — Draft Export (from app database)"
  ws.getCell("A1").font = TITLE_FONT
  ws.getCell("A2").value = `Generated ${generatedAt} (GMT-6)`
  ws.getCell("A2").font = SUBTITLE_FONT
  ws.spliceRows(3, 1)

  const headerRow = ws.getRow(4)
  headerRow.values = ws.columns.map((c) => c.header) as ExcelJS.CellValue[]
  headerRow.eachCell((cell) => applyHeaderStyle(cell))
  headerRow.height = 22

  customers.forEach((customer, idx) => {
    const row = ws.addRow({
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      address: customer.address,
      notes: customer.notes,
      createdAt: customer.createdAt,
    })
    row.eachCell((cell) => applyCellStyle(cell, { altRow: idx % 2 === 1 }))
    row.height = 28
  })

  ws.views = [{ state: "frozen", ySplit: 4 }]
}

function buildLineItemsSheet(wb: ExcelJS.Workbook, lineItems: DraftLineItem[], generatedAt: string) {
  const ws = wb.addWorksheet("Line Items")
  ws.columns = [
    { header: "Order #", key: "orderNumber", width: 14 },
    { header: "Product", key: "productName", width: 32 },
    { header: "Size", key: "productSize", width: 10 },
    { header: "Qty", key: "qty", width: 8 },
    { header: "Unit Price", key: "unitPrice", width: 14 },
    { header: "Line Total", key: "lineTotal", width: 14 },
  ]

  ws.getCell("A1").value = "Line Items — Draft Export (from app database)"
  ws.getCell("A1").font = TITLE_FONT
  ws.getCell("A2").value = `Generated ${generatedAt} (GMT-6)`
  ws.getCell("A2").font = SUBTITLE_FONT
  ws.spliceRows(3, 1)

  const headerRow = ws.getRow(4)
  headerRow.values = ws.columns.map((c) => c.header) as ExcelJS.CellValue[]
  headerRow.eachCell((cell) => applyHeaderStyle(cell))
  headerRow.height = 22

  lineItems.forEach((li, idx) => {
    const row = ws.addRow({
      orderNumber: li.orderNumber,
      productName: li.productName,
      productSize: li.productSize ?? "",
      qty: li.qty,
      unitPrice: li.unitPrice,
      lineTotal: li.lineTotal,
    })
    row.eachCell((cell) => applyCellStyle(cell, { altRow: idx % 2 === 1 }))
    row.height = 22
  })

  ws.views = [{ state: "frozen", ySplit: 4 }]
}

// === Public API ===

export async function generateDraftExcel(payload: DraftPayload): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = "Flor by Maria app"
  wb.created = new Date()
  wb.modified = new Date()
  // ExcelJS's WorkbookProperties type doesn't expose title/description,
  // but they exist at runtime. Cast to any to set them.
  ;(wb.properties as any).title = "ERP Draft"
  ;(wb.properties as any).description = `Auto-generated draft export from the app database on ${payload.generatedAt ?? nowGmtMinus6Label()} (GMT-6). Review this file, then promote to be the official ERP version.`

  const generatedAt = payload.generatedAt || nowGmtMinus6Label()

  buildOrdersSheet(wb, payload.orders, generatedAt)
  buildCustomersSheet(wb, payload.customers, generatedAt)
  buildLineItemsSheet(wb, payload.lineItems, generatedAt)

  return await wb.xlsx.writeBuffer() as unknown as Buffer
}
