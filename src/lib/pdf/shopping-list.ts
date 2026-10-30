// src/lib/pdf/shopping-list.ts — v1.8: Shopping List PDF generator (Node)
//
// Replaces scripts/generate_shopping_list_pdf.py (ReportLab).
// Produces a byte-for-byte equivalent PDF using pdfmake.
//
// Called by: src/app/api/plan/pdf/route.ts
//
// Input: ShoppingListPayload (same shape as v1.7's Python script).
// Output: PDF buffer (Promise<Buffer>).

import type { TDocumentDefinitions, Content } from "pdfmake/interfaces"
import { formatSpanishShort, nowGmtMinus6Label, weekRangeLabel } from "./utils"

// === Brand colors (match v1.7 exactly) ===
const COLOR_ROSE = "#BE185D"
const COLOR_ROSE_LIGHT = "#FCE7F3"
const COLOR_STONE = "#44403C"
const COLOR_STONE_LIGHT = "#78716C"
const COLOR_AMBER = "#D97706"
const COLOR_EMERALD = "#047857"
const COLOR_BORDER = "#E7E5E4"
const COLOR_BG_LIGHT = "#FAFAF9"
const COLOR_INDIGO = "#4338CA"

const LOGO_MARK = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAIAAAD8GO2jAAAABmJLR0QA/wD/AP+gvaeTAAADTUlEQVRIidWWSUwTURjHvzedMi0tlAJSWsBaloSwiQuJEGVJJOrBaEBCSiB64eLBxARUFGOMxl0vJmg8aBTiFkAPBmNExBVJCEsAwbAvZZN2KrQwZZiOBwy00xkoCZjwTjP/+d7/N9/M+773UE1gHqznwNbV/X8AcPdDMYmHKjMJAMYrvtupuTUGYB74tvIz3jvCAUCdvac586qdnndropsAdU7KgjsAKBIi1Ppkd9/MzThNbpoTLzd1LQEYIZZHhTgqXjFazMOtz+sWgAjyA4ScJIQIje+aAYBl3QrjG9w0FQkRvmlxYj8vu422tA2Y6zqpoUmbwQgs65QEy9pGTAAgCfH3SYyUx2gxQkwbp001LX8augUB2hMHQ4uynF7dzk5WNfTdrLS0D8pjtIv6dOuAVKfSFWb4H9iJsCXwlpOHeq+8HLj7ZlFBjr1od8c9sY/MNU3GSo1X1mnylhbSSOlHVWaSyJNwDaZJy9eo4/wZ2AxGXoBIJlHrk2fa6j03tQLAzO84tT4Z4SLXSACghicdb51+cs+l5+w8wzsNMQYpUwwTZTBRJmXOIWaEN4ylmZ7LLwQBpk9tLTm3aLOVZ6q5GmE02USQTQTCaDB/cA2hSUuL/gb5uV0QAADkl/b6xIK+6xW2UZOjTg0bAYAFWFiwlMHpO9hGTb3XyuuTCslvHRxDtMyGQwQqPcPVXrHaoGN7JSoKuvPBTgEAYFIIf0CNS4YfVlva+md6xmxjpJCJ6Kh8q9AzxkJpclJ0p4/gChngClCkMrMi1iMa050CIhhXyHxTYymDafJdo5DDCoDg/H1OZYF7Y8oETJkAuPei5pMYOT81M9XYI2Qi2Cqk2oCw4myOaP1lsHZx10/Y+WypTrVqQGhRlmu/NNW2mmpbuRZiXFeQIeTD33IxMe6XHs8RGSs1eP8tQkiTm8apYf/92zExzrvH8Wcgj97s2gb677yeGzfbxsj+2684j0SehMx5w1gBwNrtHMXwqHqwpGrherCkyvCYW2gsw52yHMDyc8jaObxwzczOdV942lVc6hjQdfZJ98VnzOy/s4W1Y8jaMcRrJVhoYqU84PAudp4xvm8WqiMiUOmXHo9w0cTrHzRpWR1grcbGPzpufMBfDaYz2VHt87AAAAAASUVORK5CYII="
const fonts = {
  Helvetica: {
    normal: "Helvetica",
    bold: "Helvetica-Bold",
    italics: "Helvetica-Oblique",
    bolditalics: "Helvetica-BoldOblique",
  },
}

// === Payload interface ===
export interface ShoppingListLine {
  materialSku: string
  materialName: string
  category: string
  supplier: string
  unit: string
  totalQty: number
  unitCost: number
  totalCost: number
  packPrice: number | null
  unitsPerPack: number | null
  packsToBuy: number | null
  packQtyRounded: number | null
  totalPackCost: number | null
  alreadyOrderedPacks: number
  toBuyPacks: number | null
  substitutes: string | null
  usedBy: Array<{
    productSku: string
    productName: string
    qty: number
    deliveryDate: string | null
    customerName: string | null
  }>
  warning: string | null
}

export interface ShoppingListPayload {
  weekStartDate: string | null
  slNumber: string
  status: "pending" | "complete"
  itemsToBuyCount: number
  totalToBuyPacks: number
  generatedAt?: string // optional override — used by API route for testability
  planSummary: {
    totalBouquets: number
    totalRevenue: number
    totalCost: number
    estimatedProfit: number
    marginPct: number
    distinctMaterials: number
    distinctSuppliers: number
  }
  shoppingList: ShoppingListLine[]
  bySupplier: Record<
    string,
    {
      lines: ShoppingListLine[]
      totalPackCost: number
      lineCount: number
      openPOs: Array<{ poNumber: string }>
    }
  >
}

// === Build the document ===
function buildDocDefinition(payload: ShoppingListPayload): TDocumentDefinitions {
  const genLabel = payload.generatedAt || nowGmtMinus6Label()
  const weekLabel = weekRangeLabel(payload.weekStartDate)
  const slNumber = payload.slNumber
  const status = payload.status
  const itemsToBuyCount = payload.itemsToBuyCount
  const totalToBuyPacks = payload.totalToBuyPacks

  // === Status badge ===
  const statusText: Content =
    status === "complete"
      ? {
          text: "Status: Complete - all materials covered by open POs",
          bold: true,
          fontSize: 10,
          color: COLOR_EMERALD,
        }
      : {
          text: `Status: Pending - ${itemsToBuyCount} item${itemsToBuyCount !== 1 ? "s" : ""} still to buy, ${totalToBuyPacks} packs`,
          bold: true,
          fontSize: 10,
          color: COLOR_AMBER,
        }

  // === HEADER ===
  const totalPackCost = payload.shoppingList.reduce(
    (sum, l) => sum + (l.totalPackCost ?? 0),
    0,
  )

  const headerTable: Content = {
    table: {
      widths: ["60%", "40%"],
      body: [
        [
          {
            stack: [
              {
                text: [
                  { text: "SHOPPING LIST  ", bold: true, fontSize: 14, color: COLOR_STONE },
                  { text: slNumber, bold: true, fontSize: 12, color: COLOR_ROSE },
                ],
              },
              { text: weekLabel, color: COLOR_STONE_LIGHT, fontSize: 9, margin: [0, 6, 0, 0] },
              {
                text: `Material needed for orders placed before ${genLabel} (GMT-6)`,
                color: COLOR_STONE_LIGHT,
                italics: true,
                fontSize: 8,
                margin: [0, 4, 0, 0],
              },
              { ...statusText, margin: [0, 6, 0, 0] },
            ],
          },
          {
            stack: [
              {
                text: [
                  { text: "Bouquets: ", color: COLOR_STONE_LIGHT, fontSize: 9 },
                  { text: String(payload.planSummary.totalBouquets), bold: true, fontSize: 11, color: COLOR_STONE },
                  { text: "   Materials: ", color: COLOR_STONE_LIGHT, fontSize: 9 },
                  { text: String(payload.planSummary.distinctMaterials), bold: true, fontSize: 11, color: COLOR_STONE },
                  { text: "   Suppliers: ", color: COLOR_STONE_LIGHT, fontSize: 9 },
                  { text: String(payload.planSummary.distinctSuppliers), bold: true, fontSize: 11, color: COLOR_STONE },
                ],
                alignment: "right",
              },
              {
                text: [
                  { text: "Est. cost: ", color: COLOR_STONE_LIGHT, fontSize: 9 },
                  { text: `$${Math.round(totalPackCost).toLocaleString("es-MX")} MXN`, bold: true, fontSize: 11, color: COLOR_ROSE },
                ],
                alignment: "right",
                margin: [0, 2, 0, 0],
              },
            ],
          },
        ],
      ],
    },
    layout: "noBorders",
    margin: [0, 0, 0, 14],
  }

  // === PER-SUPPLIER SECTIONS ===
  const supplierSections: Content[] = []

  for (const supplierName of Object.keys(payload.bySupplier).sort()) {
    const group = payload.bySupplier[supplierName]
    const openPOs = group.openPOs ?? []
    const poList = openPOs.map((p) => p.poNumber).filter(Boolean).join(", ")

    const headerText = poList
      ? `${supplierName} - ${group.lineCount} items | Est. cost: $${Math.round(group.totalPackCost).toLocaleString("es-MX")} MXN | Existing POs: ${poList}`
      : `${supplierName} - ${group.lineCount} items | Est. cost: $${Math.round(group.totalPackCost).toLocaleString("es-MX")} MXN`

    supplierSections.push({
      text: headerText,
      bold: true,
      fontSize: 11,
      color: COLOR_ROSE,
      margin: [0, 8, 0, 3],
    })

    // Build the table body — each line can have a "subs" SPAN row below it
    const tableBody: Content[][] = []
    tableBody.push([
      { text: "MATERIAL", color: "white", bold: true, fontSize: 8, fillColor: COLOR_ROSE, margin: [4, 5, 4, 5] },
      { text: "SKU", color: "white", bold: true, fontSize: 8, fillColor: COLOR_ROSE, alignment: "center", margin: [4, 8, 4, 2] },
      { text: "NEED", color: "white", bold: true, fontSize: 8, fillColor: COLOR_ROSE, alignment: "center", margin: [4, 8, 4, 2] },
      { text: "PACK SIZE", color: "white", bold: true, fontSize: 8, fillColor: COLOR_ROSE, alignment: "center", margin: [4, 3, 4, 3] },
      { text: "PACKS", color: "white", bold: true, fontSize: 8, fillColor: COLOR_ROSE, alignment: "center", margin: [4, 8, 4, 2] },
      { text: "PACK PRICE", color: "white", bold: true, fontSize: 8, fillColor: COLOR_ROSE, alignment: "center", margin: [4, 3, 4, 3] },
      { text: "TOTAL", color: "white", bold: true, fontSize: 8, fillColor: COLOR_ROSE, alignment: "center", margin: [4, 8, 4, 2] },
      { text: "USED BY", color: "white", bold: true, fontSize: 8, fillColor: COLOR_ROSE, alignment: "center", margin: [4, 8, 4, 2] },
    ])

    let nonSubsRowIndex = 0
    for (const li of group.lines) {
      const needStr = `${li.totalQty} ${li.unit}${li.totalQty > 1 && li.unit !== "pack" ? "s" : ""}`
      const packSizeStr = li.unitsPerPack ? String(li.unitsPerPack) : "?"
      const packsStr = li.packQtyRounded ? String(li.packQtyRounded) : "?"
      const packPriceStr = li.packPrice ? `$${li.packPrice.toLocaleString("es-MX")}` : "?"
      const totalStr = li.totalPackCost ? `$${Math.round(li.totalPackCost).toLocaleString("es-MX")}` : "?"

      const usedByParts = li.usedBy.map((u) => {
        let part = `${u.productName} x${u.qty}`
        if (u.deliveryDate) {
          const dd = u.deliveryDate.slice(8, 10)
          const mm = u.deliveryDate.slice(5, 7)
          part += ` (deliver ${dd}/${mm})`
        }
        return part
      })
      const usedByStr = usedByParts.join("; ")

      const warningText = li.warning ? `\nWarning: ${li.warning}` : ""

      // Checkbox prefix on material name
      const materialContent: Content = {
        text: [
          { text: "[ ] ", color: COLOR_STONE_LIGHT, fontSize: 9 },
          { text: li.materialName + warningText, color: COLOR_STONE, fontSize: 9 },
        ],
      }
      if (li.warning) {
        // Add warning as italic sub-line
        materialContent.stack = [
          { text: li.materialName, color: COLOR_STONE, fontSize: 9 },
          { text: `Warning: ${li.warning}`, italics: true, color: COLOR_AMBER, fontSize: 7, margin: [0, 1, 0, 0] },
        ]
      }

      tableBody.push([
        materialContent,
        { text: li.materialSku, color: COLOR_STONE_LIGHT, fontSize: 7, alignment: "center" },
        { text: needStr, color: COLOR_STONE, fontSize: 9, alignment: "center" },
        { text: packSizeStr, color: COLOR_STONE, fontSize: 9, alignment: "center" },
        { text: packsStr, bold: true, color: COLOR_ROSE, fontSize: 10, alignment: "center" },
        { text: packPriceStr, color: COLOR_STONE, fontSize: 9, alignment: "center" },
        { text: totalStr, bold: true, color: COLOR_STONE, fontSize: 9, alignment: "center" },
        { text: usedByStr, color: COLOR_STONE_LIGHT, fontSize: 7, alignment: "center" },
      ])
      nonSubsRowIndex += 1

      // Substitutes row — only when defined
      if (li.substitutes) {
        tableBody.push([
          {
            text: `   Substitutes: ${li.substitutes}`,
            italics: true,
            color: COLOR_INDIGO,
            fontSize: 7,
            colSpan: 8,
          },
          "", "", "", "", "", "", "",
        ])
      }
    }

    const supplierTable: Content = {
      table: {
        widths: ["30%", "10%", "9%", "8%", "9%", "10%", "9%", "15%"],
        body: tableBody,
      },
      layout: {
        fillColor: (rowIndex: number, node: any, columnIndex: number) => {
          if (rowIndex === 0) return null // header row uses its own fillColor
          // Find if this row is a substitutes row (has colSpan on col 0)
          const cell = node.table.body[rowIndex][0]
          if (cell && (cell as any).colSpan) {
            return null // subs row gets white background
          }
          // Alternating rows
          // Count only non-subs rows for parity
          let nonSubsCount = 0
          for (let i = 1; i < rowIndex; i++) {
            const c = node.table.body[i][0]
            if (!(c && (c as any).colSpan)) nonSubsCount++
          }
          return nonSubsCount % 2 === 1 ? COLOR_BG_LIGHT : null
        },
        hLineColor: (i: number, node: any) => {
          // Hide line below substitutes rows for cleaner look
          const cell = node.table.body[i]?.[0]
          if (cell && (cell as any).colSpan) return "white"
          return COLOR_BORDER
        },
        hLineWidth: () => 0.25,
        vLineColor: () => COLOR_BORDER,
        vLineWidth: () => 0.25,
        paddingTop: () => 4,
        paddingBottom: () => 4,
        paddingLeft: () => 4,
        paddingRight: () => 4,
      },
      margin: [0, 0, 0, 6],
    }

    supplierSections.push(supplierTable)
  }

  // === FOOTER NOTE ===
  const warnings = payload.shoppingList.filter((l) => l.warning)
  const footerNote: Content[] = []
  if (warnings.length > 0) {
    footerNote.push({
      text: `Warning: ${warnings.length} item(s) have unknown pack sizes - confirm with supplier before ordering.`,
      italics: true,
      color: COLOR_AMBER,
      fontSize: 8,
      margin: [0, 8, 0, 0],
    })
  }

  return {
    pageSize: "A4",
    pageMargins: [36, 36, 36, 36],
    defaultStyle: {
      font: "Helvetica",
      fontSize: 9,
      color: COLOR_STONE,
      lineHeight: 1.2,
    },
    content: [
      // Logo + tagline
      {
        columns: [
          { image: LOGO_MARK, width: 30, height: 30, margin: [0, 0, 9, 0] },
          {
            stack: [
              { text: "Flor by Maria", color: COLOR_ROSE, bold: true, fontSize: 20 },
              { text: "Lista de compras | Procurement sheet", italics: true, color: COLOR_STONE_LIGHT, fontSize: 9, margin: [0, 1, 0, 0] },
            ],
          },
        ],
        columnGap: 0,
        margin: [0, 0, 0, 10],
      },
      headerTable,
      ...supplierSections,
      ...footerNote,
    ],
    footer: (currentPage: number, pageCount: number): Content => ({
      stack: [
        {
          canvas: [
            { type: "line", x1: 0, y1: 0, x2: 595 - 36 - 36, y2: 0, lineWidth: 0.5, lineColor: COLOR_BORDER },
          ],
          margin: [0, 0, 0, 2],
        },
        {
          columns: [
            { text: `Flor by Maria | ${slNumber} | Lista de compras`, color: COLOR_STONE_LIGHT, fontSize: 8 },
            { text: `Generated ${genLabel} (GMT-6)`, color: COLOR_STONE_LIGHT, fontSize: 8, alignment: "right" },
          ],
        },
      ],
      margin: [36, 0, 36, 0],
    }),
    background: () => ({
      canvas: [
        { type: "rect", x: 0, y: 0, w: 595, h: 22, color: COLOR_ROSE },
      ],
    }),
  }
}

// === Public API ===

export async function generateShoppingListPdf(payload: ShoppingListPayload): Promise<Buffer> {
  const docDefinition = buildDocDefinition(payload)
  // Dynamically import pdfmake to avoid bundling issues at build time.
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
