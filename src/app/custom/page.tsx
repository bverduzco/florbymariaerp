// src/app/custom/page.tsx
//
// Custom Bouquet Builder — pick individual materials to build a custom bouquet.
// Shows the catalogue of materials available for custom builds, organized by type.

import { db as prisma } from "@/lib/db"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

async function getCustomMaterials() {
  return prisma.customMaterial.findMany({
    orderBy: [{ type: "asc" }, { name: "asc" }],
  })
}

const TYPE_META: Record<string, { emoji: string; color: string }> = {
  flower: { emoji: "🌹", color: "bg-rose-50 text-rose-700 border-rose-300" },
  foliage: { emoji: "🌿", color: "bg-emerald-50 text-emerald-700 border-emerald-300" },
}

const CLASS_META: Record<string, string> = {
  wild: "bg-amber-50 text-amber-700 border-amber-300",
  garden: "bg-emerald-50 text-emerald-700 border-emerald-300",
  exotic: "bg-violet-50 text-violet-700 border-violet-300",
  romantic: "bg-pink-50 text-pink-700 border-pink-300",
}

const CONFIDENCE_META: Record<string, string> = {
  HIGH: "bg-emerald-50 text-emerald-700 border-emerald-300",
  MEDIUM: "bg-amber-50 text-amber-700 border-amber-300",
  LOW: "bg-orange-50 text-orange-700 border-orange-300",
  VERY_LOW: "bg-red-50 text-red-700 border-red-300",
  NO_MATCH: "bg-stone-100 text-stone-500 border-stone-300",
}

export default async function CustomPage() {
  const materials = await getCustomMaterials()

  // KPIs
  const total = materials.length
  const flowers = materials.filter((m) => m.type === "flower").length
  const foliage = materials.filter((m) => m.type === "foliage").length
  const withErpMatch = materials.filter((m) => m.erpSku).length
  const avgPrice = total > 0
    ? materials.reduce((s, m) => s + m.pricePerStem, 0) / total
    : 0

  // Group by type then by class
  const byType = materials.reduce((acc, m) => {
    if (!acc[m.type]) acc[m.type] = {}
    const cls = m.class ?? "other"
    if (!acc[m.type][cls]) acc[m.type][cls] = []
    acc[m.type][cls].push(m)
    return acc
  }, {} as Record<string, Record<string, typeof materials>>)

  return (
    <main className="min-h-screen bg-stone-50 px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-wrap justify-between items-start gap-4">
          <div>
            <div className="text-xs uppercase tracking-wider text-stone-500">
              Build your own bouquet · v1.9
            </div>
            <h1 className="mt-1 text-3xl font-bold text-stone-900">Custom Bouquet Builder</h1>
            <p className="mt-1 text-sm text-stone-600">
              Pick individual flowers and foliage to build a custom arrangement. Each item has a per-stem price; the total is computed as you build.
            </p>
          </div>
          <button className="px-4 py-2 text-sm font-medium bg-stone-900 text-white rounded-md hover:bg-stone-800 transition">
            + New Custom Bouquet
          </button>
        </header>

        {/* KPI bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 mb-6 border border-stone-200 rounded-lg overflow-hidden bg-white">
          <KpiCell value={`${total}`} label="Available materials" />
          <KpiCell value={`${flowers}🌹 / ${foliage}🌿`} label="Flowers / Foliage" color="purple" />
          <KpiCell value={`${withErpMatch}`} label="ERP SKU matched" color="green" />
          <KpiCell
            value={`$${avgPrice.toLocaleString("es-MX", { maximumFractionDigits: 2 })}`}
            label="Avg price/stem"
            color="amber"
          />
        </div>

        {/* Materials by type and class */}
        {Object.keys(byType).length === 0 ? (
          <Card className="border-dashed border-stone-300">
            <CardContent className="py-12 text-center text-stone-400">
              No custom materials loaded. Run the seed script to load sample materials from external catalogues.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            {Object.entries(byType).map(([type, byClass]) => {
              const typeMeta = TYPE_META[type] ?? TYPE_META.flower
              const count = Object.values(byClass).reduce((s, arr) => s + arr.length, 0)
              return (
                <div key={type}>
                  <h2 className="text-xl font-bold text-stone-900 mb-4 flex items-center gap-2">
                    <span className="text-2xl">{typeMeta.emoji}</span>
                    <span className="capitalize">{type}s</span>
                    <Badge variant="outline" className={`text-xs ${typeMeta.color}`}>{count}</Badge>
                  </h2>
                  <div className="space-y-4">
                    {Object.entries(byClass).map(([cls, items]) => (
                      <Card key={cls} className="border-stone-200">
                        <CardHeader className="pb-3">
                          <div className="flex items-center gap-3">
                            <CardTitle className="text-sm capitalize">{cls}</CardTitle>
                            <Badge
                              variant="outline"
                              className={`text-xs ${CLASS_META[cls] ?? "bg-stone-100 text-stone-700 border-stone-300"}`}
                            >
                              {items.length}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {items.map((m) => (
                              <div
                                key={m.id}
                                className="p-3 border border-stone-200 rounded-md hover:border-stone-400 hover:shadow-sm transition cursor-pointer bg-white"
                              >
                                <div className="flex items-start justify-between gap-2 mb-2">
                                  <div className="font-medium text-stone-900 text-sm">{m.name}</div>
                                  <div className="text-sm font-bold text-rose-700">
                                    ${m.pricePerStem.toFixed(2)}
                                  </div>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {m.erpSku ? (
                                    <>
                                      <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-300">
                                        ✓ {m.erpSku}
                                      </Badge>
                                      {m.matchConfidence && (
                                        <Badge
                                          variant="outline"
                                          className={`text-xs ${CONFIDENCE_META[m.matchConfidence] ?? CONFIDENCE_META.MEDIUM}`}
                                        >
                                          {m.matchConfidence.replace(/_/g, " ")}
                                        </Badge>
                                      )}
                                    </>
                                  ) : (
                                    <Badge variant="outline" className="text-xs bg-stone-100 text-stone-500 border-stone-300">
                                      no ERP match
                                    </Badge>
                                  )}
                                  <Badge variant="outline" className="text-xs bg-stone-50 text-stone-600 border-stone-300">
                                    {m.source}
                                  </Badge>
                                </div>
                                {m.erpName && m.erpName !== m.name && (
                                  <div className="text-xs text-stone-500 mt-2 italic">
                                    → {m.erpName}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Business rules */}
        <Card className="mt-6 border-stone-200 bg-stone-50/50">
          <CardContent className="pt-6 text-sm text-stone-700 space-y-2">
            <div className="font-semibold text-stone-900">How custom bouquets work</div>
            <ul className="list-disc list-inside ml-2 space-y-1 text-xs">
              <li><strong>Each material has a per-stem price</strong> from an external catalogue (e.g. El Gato price list).</li>
              <li><strong>Match score &amp; confidence</strong> show how well the external item matches an ERP SKU (for inventory tracking).</li>
              <li><strong>When saved</strong>, the custom recipe creates a Product + RecipeLine in the ERP tables so it appears in the Catalogue tab.</li>
              <li><strong>Hidden recipes</strong> are saved for reference but NOT created as ERP Products (used by &quot;Create Order&quot; flow — order line item carries the breakdown instead).</li>
              <li><strong>Pricing</strong> uses the same rules as standard products: flowers × 2.5, other materials × 2, + 40% labor &amp; design, + 16% IVA.</li>
            </ul>
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
  color?: "default" | "purple" | "green" | "amber"
}) {
  const colorMap = {
    default: "text-stone-900",
    purple: "text-violet-700",
    green: "text-emerald-700",
    amber: "text-amber-700",
  }
  return (
    <div className="p-3 border-r border-stone-200 last:border-r-0 min-w-[120px]">
      <div className={`text-xl font-bold ${colorMap[color]}`}>{value}</div>
      <div className="text-xs text-stone-500 mt-0.5">{label}</div>
    </div>
  )
}
