import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

/**
 * POST /api/recipes
 * Body: { productId, materialId, qty, color?, notes? }
 * Creates a new recipe line (ingredient in a product's bill of materials).
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body?.productId || !body?.materialId || !body?.qty) {
    return NextResponse.json(
      { error: "Missing required fields: productId, materialId, qty" },
      { status: 400 }
    )
  }

  try {
    // Fetch the material to get its details
    const material = await db.material.findUnique({
      where: { id: body.materialId },
      select: { sku: true, name: true, unit: true, unitCost: true, category: true },
    })
    if (!material) {
      return NextResponse.json({ error: "Material not found" }, { status: 404 })
    }

    // Fetch the product to get its SKU
    const product = await db.product.findUnique({
      where: { id: body.productId },
      select: { sku: true },
    })
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 })
    }

    const qty = Number(body.qty)
    const unitCost = material.unitCost ?? 0
    const lineCost = qty * unitCost

    const recipeLine = await db.recipeLine.create({
      data: {
        productId: body.productId,
        productSku: product.sku,
        materialId: body.materialId,
        componentSku: material.sku,
        componentName: material.name,
        qty,
        unit: material.unit,
        unitCost,
        lineCost,
        category: material.category,
        color: body.color ?? null,
        notes: body.notes ?? null,
      },
    })
    return NextResponse.json({ recipeLine }, { status: 201 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
