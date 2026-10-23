import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

/**
 * GET /api/inventory
 * Returns all materials with their current stock (from Excel seed) + UI adjustments.
 * Stock = (Excel currentStockPacks) + SUM(StockAdjustment.deltaPacks)
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const category = searchParams.get("category")

  const materials = await db.material.findMany({
    where: category ? { category } : undefined,
    orderBy: [{ category: "asc" }, { name: "asc" }],
    include: {
      stockAdjustments: {
        orderBy: { createdAt: "desc" },
        take: 10, // last 10 adjustments per material
      },
    },
  })

  const payload = materials.map((m) => {
    const excelStock = m.currentStockPacks ?? 0
    const adjustmentSum = m.stockAdjustments.reduce((s, a) => s + a.deltaPacks, 0)
    const currentStock = excelStock + adjustmentSum
    const isTracked = m.currentStockPacks !== null || m.stockAdjustments.length > 0

    return {
      sku: m.sku,
      name: m.name,
      category: m.category,
      unit: m.unit,
      supplier: m.supplier ?? "",
      packPrice: m.packPrice ?? null,
      unitsPerPack: m.unitsPerPack ?? null,
      excelStockPacks: m.currentStockPacks,
      adjustmentPacks: adjustmentSum,
      currentStockPacks: currentStock,
      isTracked,
      reorderLevel: m.reorderLevelPacks ?? null,
      stockValue: currentStock * (m.packPrice ?? 0),
      recentAdjustments: m.stockAdjustments.map((a) => ({
        id: a.id,
        deltaPacks: a.deltaPacks,
        reason: a.reason,
        notes: a.notes ?? "",
        createdAt: a.createdAt.toISOString(),
      })),
    }
  })

  const totalValue = payload.reduce((s, m) => s + m.stockValue, 0)
  const lowStock = payload.filter((m) => m.reorderLevel !== null && m.currentStockPacks <= (m.reorderLevel ?? 0))

  return NextResponse.json({
    materials: payload,
    count: payload.length,
    totalStockValue: totalValue,
    lowStockCount: lowStock.length,
    lowStock: lowStock.map((m) => ({ sku: m.sku, name: m.name, current: m.currentStockPacks, reorder: m.reorderLevel })),
  })
}
