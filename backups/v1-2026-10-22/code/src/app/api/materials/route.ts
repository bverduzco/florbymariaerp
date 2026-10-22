import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

/**
 * GET /api/materials
 * Returns all materials, optionally filtered by ?category=flower|foliage|packaging.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const category = searchParams.get("category")

  const materials = await db.material.findMany({
    where: category ? { category } : undefined,
    orderBy: [{ category: "asc" }, { name: "asc" }],
  })

  const payload = materials.map((m) => ({
    sku: m.sku,
    name: m.name,
    category: m.category,
    unit: m.unit,
    unitCost: m.unitCost,
    supplier: m.supplier ?? "",
    packPrice: m.packPrice,
    unitsPerPack: m.unitsPerPack,
    currentStockPacks: m.currentStockPacks,
    reorderLevelPacks: m.reorderLevelPacks,
    reorderQtyPacks: m.reorderQtyPacks,
    colors: m.colors ?? "",
    notes: m.notes ?? "",
  }))

  return NextResponse.json({ materials: payload, count: payload.length })
}
