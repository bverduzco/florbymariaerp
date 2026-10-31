// src/app/api/plan/pdf/route.ts — v1.8
//
// Streams the Shopping List PDF directly to the browser. No disk writes.
//
// Replaces the v1.7 version which:
//   1. Wrote payload JSON to /tmp/xxx.json
//   2. Called python3 scripts/generate_shopping_list_pdf.py
//   3. Saved PDF to /home/z/my-project/download/...
//   4. Returned JSON { fileName, slNumber, ... }
//   5. Client fetched /download/.../[filename] separately
//
// v1.8:
//   1. Generate PDF buffer in-process via pdfmake
//   2. Persist ShoppingList snapshot to Turso (same as v1.7)
//   3. Return Response with Content-Type: application/pdf
//   4. Browser downloads immediately — no disk, no second round-trip

import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import {
  generateShoppingListPdf,
  type ShoppingListPayload,
  type ShoppingListLine,
} from "@/lib/pdf/shopping-list"
import { nowGmtMinus6FileStamp, nowGmtMinus6Label } from "@/lib/pdf/utils"

export const dynamic = "force-dynamic"
export const maxDuration = 60

// Statuses considered "open" — POs that have been created but not yet received.
// These count against the "to buy" calculation.
const PO_OPEN_STATUSES = ["draft", "approved", "pending", "procured"]

interface PlanItem {
  productSku: string
  qty: number
  deliveryDate?: string | null
  customerName?: string | null
}

interface PlanRequest {
  items: PlanItem[]
  weekStartDate?: string
}

export async function POST(request: Request) {
  let body: PlanRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  if (!body?.items || !Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: "Items array is required" }, { status: 400 })
  }

  const items = body.items
    .filter((i) => i && typeof i.productSku === "string" && typeof i.qty === "number" && i.qty > 0)
    .map((i) => ({
      productSku: i.productSku,
      qty: Math.floor(i.qty),
      deliveryDate: typeof i.deliveryDate === "string" ? i.deliveryDate : null,
      customerName: typeof i.customerName === "string" ? i.customerName : null,
    }))

  if (items.length === 0) {
    return NextResponse.json({ error: "No valid items in plan" }, { status: 400 })
  }

  // Fetch products + recipe lines
  const productSkus = items.map((i) => i.productSku)
  const products = await db.product.findMany({
    where: { sku: { in: productSkus } },
    include: { recipeLines: { include: { material: true } } },
  })
  const productBySku = new Map(products.map((p) => [p.sku, p]))

  // Fetch open PO quantities (same logic as v1.7 — needed for "to buy" delta)
  const poLines = await db.purchaseOrderLine.findMany({
    where: { po: { status: { in: PO_OPEN_STATUSES } } },
    include: { po: { select: { poNumber: true, supplier: true } } },
  })
  const openPOBySku = new Map<string, { totalPacks: number; poNumbers: Set<string> }>()
  const openPOBySupplier = new Map<string, Set<string>>()
  for (const line of poLines) {
    if (!openPOBySku.has(line.materialSku)) {
      openPOBySku.set(line.materialSku, { totalPacks: 0, poNumbers: new Set() })
    }
    const entry = openPOBySku.get(line.materialSku)!
    entry.totalPacks += line.qtyPacks
    entry.poNumbers.add(line.po.poNumber)
    const supplierName = line.po.supplier || "Unknown"
    if (!openPOBySupplier.has(supplierName)) {
      openPOBySupplier.set(supplierName, new Set())
    }
    openPOBySupplier.get(supplierName)!.add(line.po.poNumber)
  }

  function computeOrderedDelta(materialSku: string, packQtyRounded: number | null) {
    const alreadyOrderedPacks = openPOBySku.get(materialSku)?.totalPacks ?? 0
    if (packQtyRounded == null) {
      return { alreadyOrderedPacks, toBuyPacks: null }
    }
    return {
      alreadyOrderedPacks,
      toBuyPacks: Math.max(0, packQtyRounded - alreadyOrderedPacks),
    }
  }

  // Aggregate shopping list (same logic as v1.7)
  const shoppingByMaterialSku = new Map<string, ShoppingListLine>()
  let totalRevenue = 0
  let totalCost = 0
  let totalBouquets = 0

  for (const item of items) {
    const product = productBySku.get(item.productSku)

    // Custom bouquet branch (PRD-CUSTOM-*)
    if (!product && item.productSku.startsWith("PRD-CUSTOM-")) {
      const customRecipe = await db.customRecipe.findUnique({
        where: { erpProductSku: item.productSku },
        include: { lines: { include: { customMaterial: true } } },
      })
      if (!customRecipe) { totalBouquets += item.qty; continue }
      totalRevenue += customRecipe.actualPrice * item.qty
      totalBouquets += item.qty

      for (const crl of customRecipe.lines) {
        const erpSku = crl.customMaterial?.erpSku
        if (!erpSku) continue
        const m = await db.material.findUnique({ where: { sku: erpSku } })
        if (!m) continue

        const neededQty = crl.qty * item.qty
        const existing = shoppingByMaterialSku.get(m.sku)
        const productName = `Custom: ${customRecipe.name}`

        if (existing) {
          existing.totalQty += neededQty
          existing.totalCost += neededQty * (m.unitCost ?? 0)
          existing.usedBy.push({ productSku: item.productSku, productName, qty: item.qty, deliveryDate: item.deliveryDate ?? null, customerName: item.customerName ?? null })
        } else {
          const packPrice = m.packPrice
          const unitsPerPack = m.unitsPerPack
          const isPack = m.unit === "pack"
          let packsToBuy: number | null = null, packQtyRounded: number | null = null, totalPackCost: number | null = null, warning: string | null = null
          if (isPack) { packsToBuy = neededQty; packQtyRounded = Math.ceil(neededQty); totalPackCost = packQtyRounded * (packPrice ?? 0) }
          else if (unitsPerPack && unitsPerPack > 0) { packsToBuy = neededQty / unitsPerPack; packQtyRounded = Math.ceil(packsToBuy); totalPackCost = packQtyRounded * (packPrice ?? 0) }
          else { warning = "Pack size unknown — confirm with supplier before ordering" }

          shoppingByMaterialSku.set(m.sku, {
            materialSku: m.sku, materialName: m.name, category: m.category, supplier: m.supplier ?? "",
            unit: m.unit, totalQty: neededQty, unitCost: m.unitCost ?? 0, totalCost: neededQty * (m.unitCost ?? 0),
            packPrice: packPrice ?? null, unitsPerPack: unitsPerPack ?? null, packsToBuy, packQtyRounded, totalPackCost,
            ...computeOrderedDelta(m.sku, packQtyRounded),
            substitutes: m.substitutes ?? null,
            usedBy: [{ productSku: item.productSku, productName, qty: item.qty, deliveryDate: item.deliveryDate ?? null, customerName: item.customerName ?? null }],
            warning,
          })
        }
      }
      continue
    }

    if (!product) continue

    totalRevenue += product.actualPriceBeforeIva * item.qty
    totalCost += product.totalCost * item.qty
    totalBouquets += item.qty

    for (const line of product.recipeLines) {
      const m = line.material
      if (!m) continue
      const neededQty = line.qty * item.qty
      const existing = shoppingByMaterialSku.get(m.sku)
      const productName = `${product.name}${product.size ? ` (${product.size})` : ""}`

      if (existing) {
        existing.totalQty += neededQty
        existing.totalCost += neededQty * (m.unitCost ?? 0)
        existing.usedBy.push({ productSku: product.sku, productName, qty: item.qty, deliveryDate: item.deliveryDate ?? null, customerName: item.customerName ?? null })
      } else {
        const packPrice = m.packPrice
        const unitsPerPack = m.unitsPerPack
        const isPack = m.unit === "pack"
        let packsToBuy: number | null = null, packQtyRounded: number | null = null, totalPackCost: number | null = null, warning: string | null = null
        if (isPack) { packsToBuy = neededQty; packQtyRounded = Math.ceil(neededQty); totalPackCost = packQtyRounded * (packPrice ?? 0) }
        else if (unitsPerPack && unitsPerPack > 0) { packsToBuy = neededQty / unitsPerPack; packQtyRounded = Math.ceil(packsToBuy); totalPackCost = packQtyRounded * (packPrice ?? 0) }
        else { warning = "Pack size unknown — confirm with supplier before ordering" }

        shoppingByMaterialSku.set(m.sku, {
          materialSku: m.sku, materialName: m.name, category: m.category, supplier: m.supplier ?? "",
          unit: m.unit, totalQty: neededQty, unitCost: m.unitCost ?? 0, totalCost: neededQty * (m.unitCost ?? 0),
          packPrice: packPrice ?? null, unitsPerPack: unitsPerPack ?? null, packsToBuy, packQtyRounded, totalPackCost,
          ...computeOrderedDelta(m.sku, packQtyRounded),
          substitutes: m.substitutes ?? null,
          usedBy: [{ productSku: product.sku, productName, qty: item.qty, deliveryDate: item.deliveryDate ?? null, customerName: item.customerName ?? null }],
          warning,
        })
      }
    }
  }

  const shoppingList = Array.from(shoppingByMaterialSku.values()).sort((a, b) => {
    if (a.supplier !== b.supplier) return a.supplier.localeCompare(b.supplier)
    if (a.category !== b.category) return a.category.localeCompare(b.category)
    return a.materialName.localeCompare(b.materialName)
  })

  // Group by supplier (same as v1.7)
  const bySupplier: ShoppingListPayload["bySupplier"] = {}
  for (const line of shoppingList) {
    const supplier = line.supplier || "Unknown"
    if (!bySupplier[supplier]) {
      bySupplier[supplier] = { lines: [], totalPackCost: 0, lineCount: 0, openPOs: [] }
    }
    bySupplier[supplier].lines.push(line)
    bySupplier[supplier].lineCount += 1
    bySupplier[supplier].totalPackCost += line.totalPackCost ?? 0
  }
  for (const supplier of Object.keys(bySupplier)) {
    const poNumbers = openPOBySupplier.get(supplier) ?? new Set<string>()
    bySupplier[supplier].openPOs = Array.from(poNumbers).sort().map((poNumber) => ({ poNumber }))
  }

  // === Generate the SL-NNNN identifier (same as v1.7) ===
  const lastSL = await db.shoppingList.findFirst({ orderBy: { slNumber: "desc" } })
  let nextSLNum = 1
  if (lastSL?.slNumber) {
    const match = /^SL-(\d+)$/.exec(lastSL.slNumber)
    if (match) nextSLNum = parseInt(match[1], 10) + 1
  }
  const slNumber = `SL-${String(nextSLNum).padStart(4, "0")}`

  const itemsToBuyCount = shoppingList.filter((l) => (l.toBuyPacks ?? 0) > 0).length
  const totalToBuyPacks = shoppingList.reduce((s, l) => s + (l.toBuyPacks ?? 0), 0)
  const status: "pending" | "complete" = itemsToBuyCount === 0 ? "complete" : "pending"

  // Persist ShoppingList snapshot to DB (same as v1.7)
  await db.shoppingList.create({
    data: {
      slNumber,
      weekStartDate: body.weekStartDate ?? null,
      status,
      itemsToBuyCount,
      totalToBuyPacks,
      totalCost: shoppingList.reduce((s, l) => s + (l.totalPackCost ?? 0), 0),
      materialCount: shoppingList.length,
      supplierCount: Object.keys(bySupplier).length,
    },
  })

  // === Build the payload ===
  const generatedAtLabel = nowGmtMinus6Label()
  const pdfPayload: ShoppingListPayload = {
    weekStartDate: body.weekStartDate ?? null,
    slNumber,
    status,
    itemsToBuyCount,
    totalToBuyPacks,
    generatedAt: generatedAtLabel,
    planSummary: {
      totalBouquets, totalRevenue, totalCost,
      estimatedProfit: totalRevenue - totalCost,
      marginPct: totalRevenue > 0 ? ((totalRevenue - totalCost) / totalRevenue) * 100 : 0,
      distinctMaterials: shoppingList.length,
      distinctSuppliers: Object.keys(bySupplier).length,
    },
    shoppingList,
    bySupplier,
  }

  // === Generate PDF in-process (NEW in v1.8) ===
  const pdfBuffer = await generateShoppingListPdf(pdfPayload)

  // File name includes SL number + GMT-6 date AND time (same as v1.7)
  const fileName = `Shopping List ${slNumber} (${nowGmtMinus6FileStamp()}).pdf`

  return new Response(pdfBuffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
      "Content-Length": String(pdfBuffer.length),
      "Cache-Control": "no-store",
      // Optional metadata in headers — useful for the client toast:
      "X-SL-Number": slNumber,
      "X-SL-Status": status,
      "X-Items-To-Buy": String(itemsToBuyCount),
    },
  })
}
