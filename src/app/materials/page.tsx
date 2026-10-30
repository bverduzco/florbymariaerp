// src/app/materials/page.tsx
//
// Materials inventory grid. Lists every material with stock, pack price, status.
// Searchable client-side.

import { db as prisma } from "@/lib/db"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { MaterialSearch } from "./material-search"

async function getMaterials() {
  return prisma.material.findMany({
    select: {
      id: true,
      sku: true,
      name: true,
      category: true,
      unit: true,
      unitCost: true,
      supplier: true,
      currentStockPacks: true,
      reorderLevelPacks: true,
      packPrice: true,
      unitsPerPack: true,
      colors: true,
      notes: true,
    },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  })
}

export default async function MaterialsPage() {
  const materials = await getMaterials()

  // KPIs
  const total = materials.length
  const inStock = materials.filter((m) => (m.currentStockPacks ?? 0) > 0).length
  const outOfStock = materials.filter((m) => (m.currentStockPacks ?? 0) === 0).length
  const needsReorder = materials.filter(
    (m) => m.reorderLevelPacks && (m.currentStockPacks ?? 0) <= m.reorderLevelPacks
  ).length
  const totalInventoryValue = materials.reduce(
    (sum, m) => sum + (m.currentStockPacks ?? 0) * (m.packPrice ?? 0),
    0
  )

  // By category
  const byCategory = materials.reduce((acc, m) => {
    acc[m.category] = (acc[m.category] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <main className="min-h-screen bg-stone-50 px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-wrap justify-between items-start gap-4">
          <div>
            <div className="text-xs uppercase tracking-wider text-stone-500">
              Flowers, foliage &amp; packaging · v1.9
            </div>
            <h1 className="mt-1 text-3xl font-bold text-stone-900">Materials</h1>
            <p className="mt-1 text-sm text-stone-600">
              Every item Maria buys. Prices come from suppliers; stock is counted in packs.
            </p>
          </div>
          <button className="px-4 py-2 text-sm font-medium bg-stone-900 text-white rounded-md hover:bg-stone-800 transition">
            + Add Material
          </button>
        </header>

        {/* KPI bar */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-0 mb-6 border border-stone-200 rounded-lg overflow-hidden bg-white">
          <KpiCell value={`${total}`} label="Total materials" />
          <KpiCell value={`${inStock}`} label="In stock" color="green" />
          <KpiCell value={`${outOfStock}`} label="Out of stock" color="amber" />
          <KpiCell value={`${needsReorder}`} label="Needs reorder" color="red" />
          <KpiCell
            value={`$${totalInventoryValue.toLocaleString("es-MX", { maximumFractionDigits: 0 })}`}
            label="Inventory value"
            color="purple"
          />
        </div>

        {/* Category breakdown */}
        <Card className="mb-6 border-stone-200">
          <CardContent className="pt-5">
            <div className="text-stone-500 text-xs uppercase tracking-wider mb-3">By category</div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(byCategory).map(([cat, count]) => {
                const colors: Record<string, string> = {
                  flower: "bg-rose-50 text-rose-700 border-rose-300",
                  foliage: "bg-emerald-50 text-emerald-700 border-emerald-300",
                  packaging: "bg-amber-50 text-amber-700 border-amber-300",
                  other: "bg-stone-100 text-stone-700 border-stone-300",
                }
                return (
                  <Badge
                    key={cat}
                    variant="outline"
                    className={`text-xs ${colors[cat] ?? colors.other}`}
                  >
                    {cat}: {count}
                  </Badge>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Materials table with search */}
        <Card className="border-stone-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">All Materials ({materials.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <MaterialSearch materials={materials} />
          </CardContent>
        </Card>
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
  color?: "default" | "green" | "amber" | "red" | "purple"
}) {
  const colorMap = {
    default: "text-stone-900",
    green: "text-emerald-700",
    amber: "text-amber-700",
    red: "text-red-700",
    purple: "text-violet-700",
  }
  return (
    <div className="p-3 border-r border-stone-200 last:border-r-0 min-w-[120px]">
      <div className={`text-xl font-bold ${colorMap[color]}`}>{value}</div>
      <div className="text-xs text-stone-500 mt-0.5">{label}</div>
    </div>
  )
}
