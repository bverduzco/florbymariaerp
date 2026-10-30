// src/app/losses/page.tsx
//
// Tracks damaged, broken, spoiled, or otherwise lost inventory.

import { db as prisma } from "@/lib/db"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { LogLossDialog } from "./log-loss-dialog"

async function getLosses() {
  return prisma.loss.findMany({
    orderBy: { date: "desc" },
  })
}

async function getMaterials() {
  return prisma.material.findMany({
    where: { packPrice: { gt: 0 } },
    select: { sku: true, name: true, packPrice: true },
    orderBy: { name: "asc" },
  })
}

const REASON_META: Record<string, { emoji: string; color: string; label: string }> = {
  damaged: { emoji: "🔧", color: "bg-amber-50 text-amber-700 border-amber-300", label: "Damaged" },
  spoiled: { emoji: "🥀", color: "bg-red-50 text-red-700 border-red-300", label: "Spoiled" },
  broken: { emoji: "💔", color: "bg-stone-100 text-stone-700 border-stone-300", label: "Broken" },
  expired: { emoji: "⏰", color: "bg-orange-50 text-orange-700 border-orange-300", label: "Expired" },
  lost: { emoji: "❓", color: "bg-stone-100 text-stone-700 border-stone-300", label: "Lost" },
  stolen: { emoji: "🚨", color: "bg-red-100 text-red-800 border-red-400", label: "Stolen" },
  other: { emoji: "📦", color: "bg-stone-100 text-stone-700 border-stone-300", label: "Other" },
}

export default async function LossesPage() {
  const [losses, materials] = await Promise.all([getLosses(), getMaterials()])

  // KPIs
  const total = losses.length
  const totalPacksLost = losses.reduce((s, l) => s + l.qtyLostPacks, 0)
  const totalCostImpact = losses.reduce((s, l) => s + (l.costImpact ?? 0), 0)

  // By reason
  const byReason = losses.reduce((acc, l) => {
    if (!acc[l.reason]) acc[l.reason] = { count: 0, packs: 0, cost: 0 }
    acc[l.reason].count++
    acc[l.reason].packs += l.qtyLostPacks
    acc[l.reason].cost += l.costImpact ?? 0
    return acc
  }, {} as Record<string, { count: number; packs: number; cost: number }>)

  return (
    <main className="min-h-screen bg-stone-50 px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-wrap justify-between items-start gap-4">
          <div>
            <div className="text-xs uppercase tracking-wider text-stone-500">
              Damaged, spoiled &amp; lost inventory · v1.9
            </div>
            <h1 className="mt-1 text-3xl font-bold text-stone-900">Losses</h1>
            <p className="mt-1 text-sm text-stone-600">
              Tracks every loss event. Each row auto-creates a negative entry in Stock Movements (reason=&quot;loss&quot;).
            </p>
          </div>
          <LogLossDialog materials={materials} />
        </header>

        {/* KPI bar */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-0 mb-6 border border-stone-200 rounded-lg overflow-hidden bg-white">
          <KpiCell value={`${total}`} label="Loss events" />
          <KpiCell value={`${totalPacksLost}`} label="Packs lost" color="amber" />
          <KpiCell
            value={`$${totalCostImpact.toLocaleString("es-MX", { maximumFractionDigits: 0 })}`}
            label="Cost impact"
            color="red"
          />
        </div>

        {/* By reason breakdown */}
        {Object.keys(byReason).length > 0 && (
          <Card className="mb-6 border-stone-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">By Reason</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {Object.entries(byReason).map(([reason, data]) => {
                  const meta = REASON_META[reason] ?? REASON_META.other
                  return (
                    <div key={reason} className={`p-3 rounded-md border ${meta.color}`}>
                      <div className="flex items-center justify-between">
                        <div className="text-xs uppercase tracking-wider opacity-70">
                          {meta.emoji} {meta.label}
                        </div>
                        <div className="text-xs opacity-70">{data.count}x</div>
                      </div>
                      <div className="text-xl font-bold mt-1">
                        ${data.cost.toLocaleString("es-MX", { maximumFractionDigits: 0 })}
                      </div>
                      <div className="text-xs opacity-70 mt-0.5">{data.packs} packs lost</div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Losses table */}
        <Card className="border-stone-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">All Loss Events ({losses.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-200 text-stone-600 text-xs uppercase tracking-wider">
                    <th className="text-left py-2 px-3">Loss #</th>
                    <th className="text-left py-2 px-3">Date</th>
                    <th className="text-left py-2 px-3">Material</th>
                    <th className="text-right py-2 px-3">Qty lost (packs)</th>
                    <th className="text-left py-2 px-3">Reason</th>
                    <th className="text-left py-2 px-3">Discovered by</th>
                    <th className="text-right py-2 px-3">Cost impact</th>
                    <th className="text-left py-2 px-3">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {losses.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-stone-400">
                        No losses logged yet. Hopefully it stays this way! 🌸
                      </td>
                    </tr>
                  ) : (
                    losses.map((l) => {
                      const meta = REASON_META[l.reason] ?? REASON_META.other
                      return (
                        <tr key={l.id} className="border-b border-stone-100 hover:bg-stone-50">
                          <td className="py-3 px-3 font-mono text-xs text-stone-500">{l.lossNumber}</td>
                          <td className="py-3 px-3 text-xs text-stone-700">
                            {l.date.toLocaleDateString("es-MX", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
                          </td>
                          <td className="py-3 px-3">
                            <div className="font-mono text-xs text-stone-500">{l.materialSku}</div>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <span className="font-bold text-red-700">-{l.qtyLostPacks}</span>
                          </td>
                          <td className="py-3 px-3">
                            <Badge variant="outline" className={`text-xs ${meta.color}`}>
                              {meta.emoji} {meta.label}
                            </Badge>
                          </td>
                          <td className="py-3 px-3 text-stone-700">{l.discoveredBy ?? "—"}</td>
                          <td className="py-3 px-3 text-right font-medium text-red-700">
                            ${l.costImpact?.toLocaleString("es-MX", { maximumFractionDigits: 2 }) ?? "—"}
                          </td>
                          <td className="py-3 px-3 text-xs text-stone-500 max-w-xs">
                            {l.notes ? (
                              <span className="line-clamp-2">{l.notes}</span>
                            ) : (
                              <span className="text-stone-400">—</span>
                            )}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
                {losses.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-stone-300 font-bold">
                      <td colSpan={3} className="py-3 px-3 text-right text-stone-600 text-xs uppercase tracking-wider">
                        Total:
                      </td>
                      <td className="py-3 px-3 text-right text-red-700">
                        -{totalPacksLost} packs
                      </td>
                      <td colSpan={2}></td>
                      <td className="py-3 px-3 text-right text-red-700">
                        ${totalCostImpact.toLocaleString("es-MX", { maximumFractionDigits: 2 })}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
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
  color?: "default" | "amber" | "red"
}) {
  const colorMap = {
    default: "text-stone-900",
    amber: "text-amber-700",
    red: "text-red-700",
  }
  return (
    <div className="p-3 border-r border-stone-200 last:border-r-0">
      <div className={`text-xl font-bold ${colorMap[color]}`}>{value}</div>
      <div className="text-xs text-stone-500 mt-0.5">{label}</div>
    </div>
  )
}
