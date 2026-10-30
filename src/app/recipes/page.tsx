// src/app/recipes/page.tsx
//
// Bill of Materials — what goes into each product. One row per ingredient.

import { db as prisma } from "@/lib/db"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

async function getRecipes() {
  const products = await prisma.product.findMany({
    include: {
      recipeLines: {
        include: {
          material: {
            select: { sku: true, name: true, currentStockPacks: true, packPrice: true },
          },
        },
        orderBy: [{ category: "asc" }, { lineCost: "desc" }],
      },
    },
    orderBy: [{ sku: "asc" }],
  })
  return products
}

const CATEGORY_COLORS: Record<string, string> = {
  flower: "bg-rose-50 text-rose-700 border-rose-300",
  foliage: "bg-emerald-50 text-emerald-700 border-emerald-300",
  packaging: "bg-amber-50 text-amber-700 border-amber-300",
  other: "bg-stone-100 text-stone-700 border-stone-300",
}

const CHECK_COLORS: Record<string, string> = {
  OK: "bg-emerald-50 text-emerald-700 border-emerald-300",
  "NO COST": "bg-red-50 text-red-700 border-red-300",
  "NO QTY": "bg-amber-50 text-amber-700 border-amber-300",
  "ASSUMED PACK": "bg-amber-50 text-amber-700 border-amber-300",
  "SET PACK SIZE": "bg-amber-50 text-amber-700 border-amber-300",
  "SKU NOT FOUND": "bg-red-50 text-red-700 border-red-300",
}

export default async function RecipesPage() {
  const products = await getRecipes()

  // KPIs
  const totalProducts = products.length
  const totalLines = products.reduce((s, p) => s + p.recipeLines.length, 0)
  const issues = products.reduce(
    (s, p) => s + p.recipeLines.filter((l) => l.check !== "OK" && l.check !== null).length,
    0
  )
  const productsWithIssues = products.filter((p) => p.linesToReview > 0).length

  return (
    <main className="min-h-screen bg-stone-50 px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6">
          <div className="text-xs uppercase tracking-wider text-stone-500">
            Bill of Materials · v1.9
          </div>
          <h1 className="mt-1 text-3xl font-bold text-stone-900">Recipes</h1>
          <p className="mt-1 text-sm text-stone-600">
            What goes into each product. One row per ingredient. Check column flags lines that need attention (no cost, no qty, assumed pack size, etc.).
          </p>
        </header>

        {/* KPI bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 mb-6 border border-stone-200 rounded-lg overflow-hidden bg-white">
          <KpiCell value={`${totalProducts}`} label="Products with recipes" />
          <KpiCell value={`${totalLines}`} label="Total recipe lines" color="purple" />
          <KpiCell value={`${productsWithIssues}`} label="Products w/ issues" color="amber" />
          <KpiCell value={`${issues}`} label="Lines to review" color="red" />
        </div>

        {/* Per-product recipe cards */}
        <div className="space-y-6">
          {products.map((product) => {
            const totalCost = product.recipeLines.reduce((s, l) => s + l.lineCost, 0)
            const flowersCost = product.recipeLines
              .filter((l) => l.category === "flower")
              .reduce((s, l) => s + l.lineCost, 0)
            const foliageCost = product.recipeLines
              .filter((l) => l.category === "foliage")
              .reduce((s, l) => s + l.lineCost, 0)
            const packagingCost = product.recipeLines
              .filter((l) => l.category === "packaging")
              .reduce((s, l) => s + l.lineCost, 0)

            return (
              <Card key={product.id} className="border-stone-200">
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-3">
                        <CardTitle className="text-base">{product.name}</CardTitle>
                        {product.size && <Badge variant="outline">{product.size}</Badge>}
                        {product.linesToReview > 0 && (
                          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300">
                            ⚠ {product.linesToReview} to review
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-stone-500 font-mono mt-1">{product.sku}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-stone-500 uppercase tracking-wider">Recipe cost</div>
                      <div className="text-2xl font-bold text-stone-900">
                        ${totalCost.toLocaleString("es-MX", { maximumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-stone-200 text-stone-600 text-xs uppercase tracking-wider">
                          <th className="text-left py-2 px-2">Component</th>
                          <th className="text-left py-2 px-2">Category</th>
                          <th className="text-left py-2 px-2">Color</th>
                          <th className="text-right py-2 px-2">Qty</th>
                          <th className="text-right py-2 px-2">Unit cost</th>
                          <th className="text-right py-2 px-2">Line cost</th>
                          <th className="text-left py-2 px-2">Check</th>
                          <th className="text-left py-2 px-2">Stock</th>
                        </tr>
                      </thead>
                      <tbody>
                        {product.recipeLines.map((line) => {
                          const checkStatus = line.check ?? "OK"
                          return (
                            <tr key={line.id} className="border-b border-stone-50 hover:bg-stone-50">
                              <td className="py-2 px-2">
                                <div className="font-medium text-stone-900">{line.componentName}</div>
                                <div className="text-xs text-stone-500 font-mono">{line.componentSku}</div>
                              </td>
                              <td className="py-2 px-2">
                                <Badge
                                  variant="outline"
                                  className={`text-xs ${CATEGORY_COLORS[line.category] ?? CATEGORY_COLORS.other}`}
                                >
                                  {line.category}
                                </Badge>
                              </td>
                              <td className="py-2 px-2 text-xs text-stone-700">{line.color ?? "—"}</td>
                              <td className="py-2 px-2 text-right">
                                {line.qty} <span className="text-xs text-stone-500">{line.unit}</span>
                              </td>
                              <td className="py-2 px-2 text-right text-stone-700">
                                {line.unitCost > 0
                                  ? `$${line.unitCost.toLocaleString("es-MX", { maximumFractionDigits: 2 })}`
                                  : <span className="text-red-600">—</span>}
                              </td>
                              <td className="py-2 px-2 text-right font-medium text-stone-900">
                                {line.lineCost > 0
                                  ? `$${line.lineCost.toLocaleString("es-MX", { maximumFractionDigits: 2 })}`
                                  : <span className="text-red-600">—</span>}
                              </td>
                              <td className="py-2 px-2">
                                <Badge
                                  variant="outline"
                                  className={`text-xs ${CHECK_COLORS[checkStatus] ?? CHECK_COLORS.OK}`}
                                >
                                  {checkStatus}
                                </Badge>
                              </td>
                              <td className="py-2 px-2 text-xs text-stone-500">
                                {line.material?.currentStockPacks ?? 0} packs
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-stone-300 font-bold">
                          <td colSpan={5} className="py-2 px-2 text-right text-stone-600 text-xs uppercase tracking-wider">
                            Total recipe cost:
                          </td>
                          <td className="py-2 px-2 text-right text-stone-900">
                            ${totalCost.toLocaleString("es-MX", { maximumFractionDigits: 2 })}
                          </td>
                          <td colSpan={2} className="py-2 px-2 text-xs text-stone-500">
                            Flowers: ${flowersCost.toFixed(0)} · Foliage: ${foliageCost.toFixed(0)} · Pkg: ${packagingCost.toFixed(0)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                  {/* First line's notes as a hint, if any */}
                  {product.recipeLines[0]?.notes && (
                    <div className="mt-2 text-xs text-stone-500 italic">
                      💡 {product.recipeLines[0].notes}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </main>
  )
}

function KpiCell({
  value,
  label,
  color = "default",
}: {
  value: string
  label: string
  color?: "default" | "purple" | "amber" | "red"
}) {
  const colorMap = {
    default: "text-stone-900",
    purple: "text-violet-700",
    amber: "text-amber-700",
    red: "text-red-700",
  }
  return (
    <div className="p-3 border-r border-stone-200 last:border-r-0 min-w-[120px]">
      <div className={`text-xl font-bold ${colorMap[color]}`}>{value}</div>
      <div className="text-xs text-stone-500 mt-0.5">{label}</div>
    </div>
  )
}
