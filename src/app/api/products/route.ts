import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

/**
 * GET /api/products
 * Returns all products.
 */
export async function GET() {
  const products = await db.product.findMany({
    orderBy: [{ sku: "asc" }],
    include: { _count: { select: { recipeLines: true } } },
  })
  return NextResponse.json({ products, count: products.length })
}

/**
 * POST /api/products
 * Body: { sku, name, category, size?, actualPriceBeforeIva?, description?, cloudinaryPublicId? }
 * Creates a new product. Suggested prices auto-calculated from Assumptions if not provided.
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
  const existing = await db.product.findUnique({ where: { sku: body.sku } })
  if (existing) {
    return NextResponse.json(
      { error: `SKU "${body.sku}" already exists` },
      { status: 409 }
    )
  }

  const actualPriceBeforeIva = body.actualPriceBeforeIva ? Number(body.actualPriceBeforeIva) : 0
  const ivaRate = 0.16
  const actualPriceWithIva = actualPriceBeforeIva * (1 + ivaRate)

  try {
    const product = await db.product.create({
      data: {
        sku: body.sku,
        name: body.name,
        category: body.category,
        size: body.size ?? null,
        actualPriceBeforeIva,
        actualPriceWithIva,
        description: body.description ?? null,
        cloudinaryPublicId: body.cloudinaryPublicId ?? null,
      },
    })
    return NextResponse.json({ product }, { status: 201 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
