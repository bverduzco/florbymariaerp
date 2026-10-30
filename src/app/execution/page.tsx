// src/app/execution/page.tsx
//
// Execution logs — what was actually used for each bouquet/arrangement.
// Captures substitutions, additions, removals, qty adjustments from the recipe.

import { db as prisma } from "@/lib/db"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

async function getExecutionLogs() {
  return prisma.executionLog.findMany({
    orderBy: { executedAt: "desc" },
  })
}

const STATUS_COLORS: Record<string, string> = {
  planned: "bg-blue-50 text-blue-700 border-blue-300",
  executed: "bg-emerald-50 text-emerald-700 border-emerald-300",
  partial: "bg-amber-50 text-amber-700 border-amber-300",
  redone: "bg-violet-50 text-violet-700 border-violet-300",
  cancelled: "bg-red-50 text-red-700 border-red-300",
}

export default async function ExecutionPage() {
  const logs = await getExecutionLogs()

  // KPIs
  const total = logs.length
  const executed = logs.filter((l) => l.status === "executed").length
  const totalActualCost = logs.reduce((s, l) => s + (l.actualCost ?? 0), 0)
  const totalEstCost = logs.reduce((s, l) => s + (l.estimatedCost ?? 0), 0)
  const costVariance = totalActualCost - totalEstCost
  const paidJobs = logs.filter((l) => l.quotedPrice !== null)
  const totalQuotedRevenue = paidJobs.reduce((s, l) => s + (l.quotedPrice ?? 0), 0)
  const totalMargin = paidJobs.reduce((s, l) => s + (l.marginDollars ?? 0), 0)

  return (
    <main className="min-h-screen bg-stone-50 px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-wrap justify-between items-start gap-4">
          <div>
            <div className="text-xs uppercase tracking-wider text-stone-500">
              What was actually used · v1.9
            </div>
            <h1 className="mt-1 text-3xl font-bold text-stone-900">Execution Logs</h1>
            <p className="mt-1 text-sm text-stone-600">
              One row per execution event (one bouquet/arrangement being made). Captures substitutions, additions, removals, qty adjustments from the recipe.
            </p>
          </div>
          <button className="px-4 py-2 text-sm font-medium bg-stone-900 text-white rounded-md hover:bg-stone-800 transition">
            + Log Execution
          </button>
        </header>

        {/* KPI bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 mb-6 border border-stone-200 rounded-lg overflow-hidden bg-white">
          <KpiCell value={`${total}`} label="Total executions" />
          <KpiCell value={`${executed}`} label="Executed" color="green" />
          <KpiCell
            value={`$${totalActualCost.toLocaleString("es-MX", { maximumFractionDigits: 0 })}`}
            label="Actual cost"
            color="amber"
          />
          <KpiCell
            value={`${costVariance >= 0 ? "+" : "-"}$${Math.abs(costVariance).toLocaleString("es-MX", { maximumFractionDigits: 0 })}`}
            label="Cost variance"
            color={costVariance >= 0 ? "red" : "green"}
          />
        </div>

        {/* Execution log cards */}
        <div className="space-y-4">
          {logs.map((log) => {
            const isPaid = log.quotedPrice !== null
            const marginPctDisplay = log.marginPct !== null
              ? `${Math.round(log.marginPct * 100) / 100}%`
              : "—"
            const costVarianceLocal = (log.actualCost ?? 0) - (log.estimatedCost ?? 0)

            return (
              <Card key={log.id} className="border-stone-200 hover:shadow-sm transition">
                <CardContent className="pt-5">
                  {/* Header */}
                  <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <span className="font-mono text-sm font-bold text-stone-900">{log.executionNumber}</span>
                        <Badge
                          variant="outline"
                          className={`text-xs ${STATUS_COLORS[log.status] ?? STATUS_COLORS.executed}`}
                        >
                          {log.status}
                        </Badge>
                        {isPaid ? (
                          <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-300">
                            💵 Paid
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs bg-stone-100 text-stone-500 border-stone-300">
                            🎁 Unpaid demo
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-stone-600">
                        📅 {log.executedAt.toLocaleDateString("es-MX", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                        {log.eventLineItemKey && (
                          <>
                            <span className="text-stone-400 mx-2">·</span>
                            <span className="font-mono text-xs">{log.eventLineItemKey}</span>
                          </>
                        )}
                        <span className="text-stone-400 mx-2">·</span>
                        👤 {log.executedBy ?? "—"}
                      </div>
                    </div>
                  </div>

                  {/* Cost breakdown grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
                    <CostCell
                      label="Estimated cost"
                      value={log.estimatedCost}
                      color="default"
                    />
                    <CostCell
                      label="Actual cost"
                      value={log.actualCost}
                      color="amber"
                    />
                    {isPaid ? (
                      <>
                        <CostCell
                          label="Quoted price"
                          value={log.quotedPrice}
                          color="green"
                        />
                        <CostCell
                          label={`Margin (${marginPctDisplay})`}
                          value={log.marginDollars}
                          color="purple"
                        />
                      </>
                    ) : (
                      <>
                        <div className="p-3 rounded-md bg-stone-50 border border-stone-200">
                          <div className="text-stone-500 text-xs uppercase tracking-wider">Quoted price</div>
                          <div className="text-lg font-bold text-stone-400 mt-1">N/A</div>
                          <div className="text-xs text-stone-400 mt-0.5">unpaid event</div>
                        </div>
                        <div className="p-3 rounded-md bg-stone-50 border border-stone-200">
                          <div className="text-stone-500 text-xs uppercase tracking-wider">Margin</div>
                          <div className="text-lg font-bold text-stone-400 mt-1">N/A</div>
                          <div className="text-xs text-stone-400 mt-0.5">no revenue</div>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Variance indicator */}
                  {costVarianceLocal !== 0 && (
                    <div className={`mt-3 pt-3 border-t border-stone-100 text-xs ${
                      costVarianceLocal > 0 ? "text-red-700" : "text-emerald-700"
                    }`}>
                      {costVarianceLocal > 0 ? "⚠" : "✓"} Cost variance:{" "}
                      <strong>
                        {costVarianceLocal > 0 ? "+" : "-"}${Math.abs(costVarianceLocal).toLocaleString("es-MX", { maximumFractionDigits: 2 })}
                      </strong>{" "}
                      {costVarianceLocal > 0
                        ? "(actual cost was higher than estimated)"
                        : "(actual cost was lower than estimated)"}
                    </div>
                  )}

                  {/* Notes */}
                  {log.notes && (
                    <div className="mt-3 pt-3 border-t border-stone-100 text-sm text-stone-600">
                      📝 {log.notes}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
          {logs.length === 0 && (
            <Card className="border-dashed border-stone-300">
              <CardContent className="py-12 text-center text-stone-400">
                No execution logs yet. Click &quot;+ Log Execution&quot; to record one.
              </CardContent>
            </Card>
          )}
        </div>

        {/* Business rules */}
        <Card className="mt-6 border-stone-200 bg-stone-50/50">
          <CardContent className="pt-6 text-sm text-stone-700 space-y-2">
            <div className="font-semibold text-stone-900">How execution logs work</div>
            <ul className="list-disc list-inside ml-2 space-y-1 text-xs">
              <li><strong>One row per execution event</strong> — one bouquet/arrangement being made.</li>
              <li><strong>Links to Events</strong> (not Orders) — works for both paid events (weddings) AND unpaid (demos, photo shoots).</li>
              <li><strong>For unpaid events</strong>, Quoted Price / Margin columns are NULL — only Actual Cost is tracked.</li>
              <li><strong>Cost variance</strong> = Actual Cost − Estimated Cost. Positive = over budget (red). Negative = under budget (green).</li>
              <li><strong>Execution Log Lines</strong> (separate model) capture per-material breakdown with substitution type (recipe / addition / substitution / removal).</li>
              <li><strong>Pipeline:</strong> planned → executed → partial / redone / cancelled.</li>
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

function CostCell({
  label,
  value,
  color,
}: {
  label: string
  value: number | null
  color: "default" | "green" | "amber" | "purple"
}) {
  const colorMap = {
    default: "text-stone-900",
    green: "text-emerald-700",
    amber: "text-amber-700",
    purple: "text-violet-700",
  }
  const bgMap = {
    default: "bg-stone-50 border-stone-200",
    green: "bg-emerald-50 border-emerald-200",
    amber: "bg-amber-50 border-amber-200",
    purple: "bg-violet-50 border-violet-200",
  }
  return (
    <div className={`p-3 rounded-md border ${bgMap[color]}`}>
      <div className="text-stone-500 text-xs uppercase tracking-wider">{label}</div>
      <div className={`text-lg font-bold mt-1 ${colorMap[color]}`}>
        {value !== null ? `$${value.toLocaleString("es-MX", { maximumFractionDigits: 2 })}` : "—"}
      </div>
    </div>
  )
}
