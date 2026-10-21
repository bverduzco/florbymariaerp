import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

/**
 * POST /api/plan
 * Body: { items: [{ productSku: string, qty: number }], weekStartDate?: string }
 *
 * Returns:
 *   - planSummary: total bouquets, total revenue, total cost
 *   - shoppingList: aggregated by material, with pack-quantity calculation
 *   - bySupplier: grouped by supplier (for purchase orders)
 *   - byCategory: grouped by category (flowers / foliage / packaging)
 */

type PlanItem = { productSku: string; qty: number }

interface PlanRequest {
  items: PlanItem[]
  weekStartDate?: string
}

interface ShoppingLine {
  materialSku: string
  materialName: string
  category: string
  supplier: string
  unit: string // stem / pack / wrap / piece / meter
  totalQty: number // total units needed (stems, wraps, etc.)
  unitCost: number
  totalCost: number
  packPrice: number | null
  unitsPerPack: number | null
  packsToBuy: number | null // null if pack size unknown
  packQtyRounded: number | null // ceil(packsToBuy)
  totalPackCost: number | null
  usedBy: { productSku: string; productName: string; qty: number }[]
  warning: string | null
}

export async function POST(request: Request) {
  let body: PlanRequest
  try {
    body = (await request.json()) as PlanRequest
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  if (!body?.items || !Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: "Items array is required" }, { status: 400 })
  }

  // Validate qty
  const items = body.items
    .filter((i) => i && typeof i.productSku === "string" && typeof i.qty === "number" && i.qty > 0)
    .map((i) => ({ productSku: i.productSku, qty: Math.floor(i.qty) }))

  if (items.length === 0) {
    return NextResponse.json({ error: "No valid items in plan" }, { status: 400 })
  }

  // Fetch products + their recipe lines + materials
  const productSkus = items.map((i) => i.productSku)
  const products = await db.product.findMany({
    where: { sku: { in: productSkus } },
    include: {
      recipeLines: {
        include: { material: true },
      },
    },
  })

  const productBySku = new Map(products.map((p) => [p.sku, p]))

  // Aggregation: for each material, sum qty across all plan items
  const shoppingByMaterialSku = new Map<string, ShoppingLine>()

  let totalRevenue = 0
  let totalCost = 0
  let totalBouquets = 0

  for (const item of items) {
    const product = productBySku.get(item.productSku)
    if (!product) {
      return NextResponse.json(
        { error: `Product not found: ${item.productSku}` },
        { status: 404 },
      )
    }

    totalRevenue += product.actualPriceBeforeIva * item.qty
    totalCost += product.totalCost * item.qty
    totalBouquets += item.qty

    for (const line of product.recipeLines) {
      const m = line.material
      if (!m) continue

      const neededQty = line.qty * item.qty
      const existing = shoppingByMaterialSku.get(m.sku)

      if (existing) {
        existing.totalQty += neededQty
        existing.totalCost += neededQty * (m.unitCost ?? 0)
        existing.usedBy.push({
          productSku: product.sku,
          productName: `${product.name}${product.size ? ` (${product.size})` : ""}`,
          qty: item.qty,
        })
      } else {
        const packPrice = m.packPrice
        const unitsPerPack = m.unitsPerPack
        const isStem = m.unit === "stem"
        const isPack = m.unit === "pack"

        // Calculate packs to buy
        let packsToBuy: number | null = null
        let packQtyRounded: number | null = null
        let totalPackCost: number | null = null
        let warning: string | null = null

        if (isPack) {
          // Unit is "pack" already → qty IS packs
          packsToBuy = neededQty
          packQtyRounded = Math.ceil(neededQty)
          totalPackCost = packQtyRounded * (packPrice ?? 0)
        } else if (unitsPerPack && unitsPerPack > 0) {
          // Stems / wraps etc. → divide by pack size
          packsToBuy = neededQty / unitsPerPack
          packQtyRounded = Math.ceil(packsToBuy)
          totalPackCost = packQtyRounded * (packPrice ?? 0)
        } else {
          warning = "Pack size unknown — confirm with supplier before ordering"
        }

        shoppingByMaterialSku.set(m.sku, {
          materialSku: m.sku,
          materialName: m.name,
          category: m.category,
          supplier: m.supplier ?? "",
          unit: m.unit,
          totalQty: neededQty,
          unitCost: m.unitCost ?? 0,
          totalCost: neededQty * (m.unitCost ?? 0),
          packPrice: packPrice ?? null,
          unitsPerPack: unitsPerPack ?? null,
          packsToBuy,
          packQtyRounded,
          totalPackCost,
          usedBy: [
            {
              productSku: product.sku,
              productName: `${product.name}${product.size ? ` (${product.size})` : ""}`,
              qty: item.qty,
            },
          ],
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

  // Group by supplier
  const bySupplier: Record<
    string,
    { lines: ShoppingLine[]; totalPackCost: number; lineCount: number }
  > = {}
  for (const line of shoppingList) {
    const supplier = line.supplier || "Unknown"
    if (!bySupplier[supplier]) {
      bySupplier[supplier] = { lines: [], totalPackCost: 0, lineCount: 0 }
    }
    bySupplier[supplier].lines.push(line)
    bySupplier[supplier].lineCount += 1
    bySupplier[supplier].totalPackCost += line.totalPackCost ?? 0
  }

  // Group by category
  const byCategory: Record<string, { lines: ShoppingLine[]; totalCost: number }> = {}
  for (const line of shoppingList) {
    const cat = line.category || "other"
    if (!byCategory[cat]) {
      byCategory[cat] = { lines: [], totalCost: 0 }
    }
    byCategory[cat].lines.push(line)
    byCategory[cat].totalCost += line.totalCost
  }

  return NextResponse.json({
    planSummary: {
      weekStartDate: body.weekStartDate ?? null,
      totalBouquets,
      totalRevenue,
      totalCost,
      estimatedProfit: totalRevenue - totalCost,
      marginPct: totalRevenue > 0 ? ((totalRevenue - totalCost) / totalRevenue) * 100 : 0,
      distinctMaterials: shoppingList.length,
      distinctSuppliers: Object.keys(bySupplier).length,
    },
    shoppingList,
    bySupplier,
    byCategory,
  })
}
