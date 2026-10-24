import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

/**
 * GET /api/custom-recipes
 * Returns all saved custom recipes.
 */
export async function GET() {
  const recipes = await db.customRecipe.findMany({
    orderBy: [{ createdAt: "desc" }],
    include: { lines: { include: { customMaterial: true } } },
  })

  const payload = recipes.map((r) => ({
    id: r.id,
    name: r.name,
    size: r.size,
    description: r.description,
    flowersCost: r.flowersCost,
    otherMaterialsCost: r.otherMaterialsCost,
    totalCost: r.totalCost,
    suggestedPrice: r.suggestedPrice,
    actualPrice: r.actualPrice,
    erpProductSku: r.erpProductSku ?? "",
    createdAt: r.createdAt.toISOString(),
    lines: r.lines.map((l) => ({
      id: l.id,
      customMaterialId: l.customMaterialId,
      materialName: l.materialName,
      materialPrice: l.materialPrice,
      materialType: l.materialType,
      qty: l.qty,
    })),
  }))

  return NextResponse.json({ recipes: payload, count: payload.length })
}

/**
 * POST /api/custom-recipes
 * Body: {
 *   name: string,
 *   size?: string,
 *   description?: string,
 *   actualPrice?: number,  // user-set (defaults to suggested if omitted)
 *   lines: [{ customMaterialId, qty }]
 * }
 *
 * Computes cost using El Gato prices, applies ERP pricing rules to get suggested price,
 * ALSO creates a Product + RecipeLine in the ERP tables so it appears in Catalogue tab.
 */
export async function POST(request: Request) {
  let body: {
    name?: string
    size?: string
    description?: string
    actualPrice?: number
    hidden?: boolean
    lines?: { customMaterialId: string; qty: number }[]
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  if (!body.name || typeof body.name !== "string" || body.name.trim().length === 0) {
    return NextResponse.json({ error: "Recipe name is required" }, { status: 400 })
  }
  if (!body.lines || !Array.isArray(body.lines) || body.lines.length === 0) {
    return NextResponse.json({ error: "At least one line item is required" }, { status: 400 })
  }

  // Fetch the custom materials + their linked ERP materials
  const materialIds = body.lines.map((l) => l.customMaterialId)
  const customMats = await db.customMaterial.findMany({
    where: { id: { in: materialIds } },
  })
  const matById = new Map(customMats.map((m) => [m.id, m]))

  // Validate
  for (const line of body.lines) {
    if (!matById.has(line.customMaterialId)) {
      return NextResponse.json({ error: `Custom material not found: ${line.customMaterialId}` }, { status: 404 })
    }
    if (typeof line.qty !== "number" || line.qty < 1) {
      return NextResponse.json({ error: `Invalid qty: ${line.qty}` }, { status: 400 })
    }
  }

  // Compute costs using El Gato prices
  let flowersCost = 0
  let otherMaterialsCost = 0
  const lineItems = body.lines.map((l) => {
    const m = matById.get(l.customMaterialId)!
    const lineCost = m.pricePerStem * l.qty
    if (m.type === "flower") {
      flowersCost += lineCost
    } else {
      otherMaterialsCost += lineCost
    }
    return {
      customMaterialId: l.customMaterialId,
      qty: l.qty,
      materialName: m.name,
      materialPrice: m.pricePerStem,
      materialType: m.type,
    }
  })

  const totalCost = flowersCost + otherMaterialsCost

  // Apply ERP pricing rules (from Assumptions tab in v1.2):
  //   Price before IVA = (flowers × 2.5 + other materials × 2) × (1 + 40% labor)
  //   IVA = 16%
  const flowersMultiplier = 2.5
  const otherMultiplier = 2.0
  const laborSurcharge = 0.40
  const iva = 0.16

  const subtotal = flowersCost * flowersMultiplier + otherMaterialsCost * otherMultiplier
  const withLabor = subtotal * (1 + laborSurcharge)
  const suggestedPrice = withLabor // before IVA
  const suggestedPriceWithIva = withLabor * (1 + iva)

  const actualPrice = typeof body.actualPrice === "number" && body.actualPrice > 0
    ? body.actualPrice
    : Math.round(suggestedPrice / 5) * 5 // round to nearest $5
  const actualPriceWithIva = actualPrice * (1 + iva)

  // Generate consecutive SKU: PRD-CUSTOM-0001, PRD-CUSTOM-0002, ...
  const lastCustom = await db.customRecipe.findFirst({
    where: { erpProductSku: { startsWith: "PRD-CUSTOM-" } },
    orderBy: { erpProductSku: "desc" },
  })
  let nextNum = 1
  if (lastCustom?.erpProductSku) {
    const match = /^PRD-CUSTOM-(\d+)$/.exec(lastCustom.erpProductSku)
    if (match) nextNum = parseInt(match[1]) + 1
  }
  const sku = `PRD-CUSTOM-${String(nextNum).padStart(4, "0")}`

  const isHidden = body.hidden === true

  // Create the CustomRecipe + lines
  const recipe = await db.customRecipe.create({
    data: {
      name: body.name.trim(),
      size: body.size ?? null,
      description: body.description ?? null,
      flowersCost,
      otherMaterialsCost,
      totalCost,
      suggestedPrice,
      actualPrice,
      erpProductSku: sku,
      hidden: isHidden,
      lines: {
        create: lineItems.map((li) => ({
          customMaterialId: li.customMaterialId,
          qty: li.qty,
          materialName: li.materialName,
          materialPrice: li.materialPrice,
          materialType: li.materialType,
        })),
      },
    },
    include: { lines: true },
  })

  // Only create ERP Product + RecipeLines when NOT hidden (visible in Catalogue)
  if (!isHidden) {
    // Check SKU doesn't already exist in Product table
    const existing = await db.product.findUnique({ where: { sku } })
    if (existing) {
      return NextResponse.json(
        { error: `A product with SKU ${sku} already exists.` },
        { status: 409 },
      )
    }

    const marginPct = actualPrice > 0 ? (actualPrice - totalCost) / actualPrice : 0
    const product = await db.product.create({
      data: {
        sku,
        name: body.name.trim(),
        category: "Custom",
        size: body.size ?? null,
        flowersCost,
        otherMaterialsCost,
        totalCost,
        suggestedPriceBeforeIva: suggestedPrice,
        suggestedPriceWithIva: suggestedPriceWithIva,
        actualPriceBeforeIva: actualPrice,
        actualPriceWithIva: actualPriceWithIva,
        marginPct,
        linesToReview: 0,
        description: body.description ?? `Custom bouquet · ${lineItems.length} materials · El Gato pricing`,
      },
    })

    // Create RecipeLine entries linking the new product to the matched ERP materials
    for (const li of lineItems) {
      const customMat = matById.get(li.customMaterialId)!
      if (!customMat.erpSku) continue
      const erpMat = await db.material.findUnique({ where: { sku: customMat.erpSku } })
      if (!erpMat) continue
      await db.recipeLine.create({
        data: {
          productSku: sku,
          productId: product.id,
          componentSku: customMat.erpSku,
          materialId: erpMat.id,
          componentName: erpMat.name,
          qty: li.qty,
          unit: "stem",
          unitCost: erpMat.unitCost ?? 0,
          lineCost: (erpMat.unitCost ?? 0) * li.qty,
          category: erpMat.category,
          color: null,
          check: "OK",
          notes: `Custom recipe line — from El Gato "${customMat.name}"`,
        },
      })
    }
  }

  return NextResponse.json(
    {
      recipe: {
        id: recipe.id,
        name: recipe.name,
        size: recipe.size,
        erpProductSku: sku,
        flowersCost,
        otherMaterialsCost,
        totalCost,
        suggestedPrice,
        suggestedPriceWithIva,
        actualPrice,
        actualPriceWithIva,
        marginPct,
        lineCount: lineItems.length,
      },
    },
    { status: 201 },
  )
}
