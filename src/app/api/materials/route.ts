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

/**
 * POST /api/materials
 * Body: { sku, name, category, unit, packPrice?, unitsPerPack?, supplier?, colors?, notes? }
 * Creates a new material.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body?.sku || !body?.name || !body?.category) {
    return NextResponse.json(
      { error: "Missing required fields: sku, name, category" },
      { status: 400 }
    )
  }

  // Check for duplicate SKU
  const existing = await db.material.findUnique({ where: { sku: body.sku } })
  if (existing) {
    return NextResponse.json(
      { error: `SKU "${body.sku}" already exists` },
      { status: 409 }
    )
  }

  // Compute unitCost from packPrice / unitsPerPack
  const packPrice = body.packPrice ? Number(body.packPrice) : null
  const unitsPerPack = body.unitsPerPack ? Number(body.unitsPerPack) : null
  const unitCost = packPrice && unitsPerPack && unitsPerPack > 0
    ? packPrice / unitsPerPack
    : null

  try {
    const material = await db.material.create({
      data: {
        sku: body.sku,
        name: body.name,
        category: body.category,
        unit: body.unit ?? "stem",
        packPrice,
        unitsPerPack,
        unitCost,
        supplier: body.supplier ?? null,
        colors: body.colors ?? null,
        notes: body.notes ?? null,
        currentStockPacks: 0,
      },
    })
    return NextResponse.json({ material }, { status: 201 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
