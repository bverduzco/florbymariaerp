import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

/**
 * GET /api/catalogue
 * Returns the list of products with their recipe (bill of materials).
 * Each product includes:
 *   - sku, name, category, size, description
 *   - actualPriceBeforeIva, totalCost, marginPct
 *   - recipeLines[]: { componentSku, componentName, qty, unit, color, category }
 */
export async function GET() {
  const products = await db.product.findMany({
    orderBy: [{ name: "asc" }, { size: "asc" }],
    include: {
      recipeLines: {
        orderBy: { category: "asc" },
      },
    },
  })

  const payload = products.map((p) => ({
    sku: p.sku,
    name: p.name,
    category: p.category,
    size: p.size ?? "",
    description: p.description ?? "",
    actualPriceBeforeIva: p.actualPriceBeforeIva,
    totalCost: p.totalCost,
    marginPct: p.marginPct,
    linesToReview: p.linesToReview,
    recipeLines: p.recipeLines.map((r) => ({
      componentSku: r.componentSku,
      componentName: r.componentName,
      qty: r.qty,
      unit: r.unit,
      color: r.color ?? "",
      category: r.category,
    })),
  }))

  return NextResponse.json({ products: payload })
}
