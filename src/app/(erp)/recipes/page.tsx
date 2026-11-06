export const dynamic = "force-dynamic"

import { db as prisma } from "@/lib/db"
import { AddIngredientDialog } from "./add-ingredient-dialog"
import { RecipeFilter } from "./recipe-filter"

async function getRecipes() {
  return prisma.product.findMany({
    include: {
      recipeLines: {
        include: {
          material: { select: { sku: true, name: true, currentStockPacks: true } },
        },
        orderBy: [{ category: "asc" }, { lineCost: "desc" }],
      },
    },
    orderBy: [{ sku: "asc" }],
  })
}

async function getMaterials() {
  return prisma.material.findMany({
    where: { unitCost: { gt: 0 } },
    select: { id: true, sku: true, name: true, unitCost: true },
    orderBy: { name: "asc" },
  })
}

async function getRecipeVersions() {
  return prisma.recipeVersion.findMany({
    include: { product: { select: { sku: true, name: true } } },
    orderBy: [{ productSku: "asc" }, { version: "asc" }],
  })
}

const CAT_COLOR: Record<string, string> = {
  flower: "#D1FAE5:#065F46",
  foliage: "#EFF6FF:#1E40AF",
  packaging: "#FEF3C7:#92400E",
  other: "#F3F4F6:#44403C",
}

export default async function RecipesPage() {
  const [products, materials, versions] = await Promise.all([getRecipes(), getMaterials(), getRecipeVersions()])
  const totalLines = products.reduce((s, p) => s + p.recipeLines.length, 0)
  const issues = products.reduce((s, p) => s + p.recipeLines.filter((l) => l.check !== "OK" && l.check !== null).length, 0)

  // Group versions by product
  const versionsByProduct = versions.reduce((acc, v) => {
    if (!acc[v.productSku]) acc[v.productSku] = []
    acc[v.productSku].push(v)
    return acc
  }, {} as Record<string, typeof versions>)

  return (
    <div>
      <div className="fmd-screen-header">
        <div><h1>Recipes</h1><div className="fmd-subtitle">Bill of materials per product — what goes into each bouquet</div></div>
      </div>

      <div className="fmd-kpi-bar">
        <div className="fmd-kpi-cell"><div className="fmd-kpi-value" style={{ color: "#44403C" }}>{products.length}</div><div className="fmd-kpi-label">Products</div></div>
        <div className="fmd-kpi-cell"><div className="fmd-kpi-value" style={{ color: "#BE185D" }}>{totalLines}</div><div className="fmd-kpi-label">Recipe lines</div></div>
        <div className="fmd-kpi-cell"><div className="fmd-kpi-value" style={{ color: "#D97706" }}>{issues}</div><div className="fmd-kpi-label">Lines to review</div></div>
        <div className="fmd-kpi-cell"><div className="fmd-kpi-value" style={{ color: "#047857" }}>{versions.length}</div><div className="fmd-kpi-label">Recipe versions</div></div>
      </div>

      {products.length === 0 ? (
        <div className="fmd-box" style={{ textAlign: "center", padding: "32px" }}>
          <div style={{ fontSize: "13px", color: "#78716C" }}>No products with recipes yet. Add products and recipe lines to get started.</div>
        </div>
      ) : (
        <RecipeFilter
        products={products.map((p) => ({
          id: p.id,
          sku: p.sku,
          name: p.name,
          size: p.size,
          linesToReview: p.linesToReview,
          recipeLines: p.recipeLines.map((line) => ({
            id: line.id,
            componentSku: line.componentSku,
            componentName: line.componentName,
            qty: line.qty,
            unit: line.unit,
            unitCost: line.unitCost,
            lineCost: line.lineCost,
            category: line.category,
            color: line.color,
            check: line.check,
            material: line.material ? { sku: line.material.sku, name: line.material.name, currentStockPacks: line.material.currentStockPacks } : null,
          })),
        }))}
        materials={materials}
        versionsByProduct={versionsByProduct}
      />
      )}
    </div>
  )
}
