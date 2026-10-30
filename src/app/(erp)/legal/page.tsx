// src/app/legal/page.tsx
//
// Legal & business document templates. Each template contains [PLACEHOLDERS]
// that the UI substitutes at render time.

import { db as prisma } from "@/lib/db"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

async function getLegalData() {
  const [templates, variables] = await Promise.all([
    prisma.legalTemplate.findMany({ orderBy: { templateNumber: "asc" } }),
    prisma.templateVariable.findMany({ orderBy: { placeholder: "asc" } }),
  ])
  return { templates, variables }
}

const APPLIES_TO_META: Record<string, { emoji: string; color: string; label: string }> = {
  all_quotes: { emoji: "📝", color: "bg-blue-50 text-blue-700 border-blue-300", label: "All quotes" },
  small_orders: { emoji: "📦", color: "bg-amber-50 text-amber-700 border-amber-300", label: "Small orders" },
  event_quotes: { emoji: "💒", color: "bg-violet-50 text-violet-700 border-violet-300", label: "Event quotes" },
  all_customers: { emoji: "👥", color: "bg-emerald-50 text-emerald-700 border-emerald-300", label: "All customers" },
}

export default async function LegalPage() {
  const { templates, variables } = await getLegalData()

  return (
    <main className="min-h-screen bg-stone-50 px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6">
          <div className="text-xs uppercase tracking-wider text-stone-500">
            Legal &amp; business document templates · v1.9
          </div>
          <h1 className="mt-1 text-3xl font-bold text-stone-900">Legal Templates</h1>
          <p className="mt-1 text-sm text-stone-600">
            Structured templates with [PLACEHOLDERS] for dynamic substitution. UI does string replacement at render time.
          </p>
        </header>

        {/* KPI bar */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-0 mb-6 border border-stone-200 rounded-lg overflow-hidden bg-white">
          <KpiCell value={`${templates.length}`} label="Templates" />
          <KpiCell value={`${variables.length}`} label="Placeholders" color="purple" />
          <KpiCell
            value={`${variables.filter((v) => v.cellOrField?.includes("new field")).length}`}
            label="Need new fields"
            color="amber"
          />
        </div>

        {/* Templates list */}
        <div className="space-y-6 mb-6">
          {templates.map((t) => {
            const meta = APPLIES_TO_META[t.appliesTo] ?? { emoji: "📄", color: "bg-stone-100 text-stone-700 border-stone-300", label: t.appliesTo }
            const placeholders = t.placeholdersNeeded?.split(",").map((p) => p.trim()).filter(Boolean) ?? []
            return (
              <Card key={t.id} className="border-stone-200">
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <span className="font-mono text-xs text-stone-500">{t.templateNumber}</span>
                        <Badge variant="outline" className={`text-xs ${meta.color}`}>
                          {meta.emoji} {meta.label}
                        </Badge>
                        <Badge variant="outline" className="text-xs bg-stone-100 text-stone-700 border-stone-300">
                          {t.version}
                        </Badge>
                      </div>
                      <CardTitle className="text-base">{t.name}</CardTitle>
                      <div className="text-xs text-stone-500 mt-1">📍 {t.trigger}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-stone-500">Last updated</div>
                      <div className="text-sm font-medium text-stone-700">
                        {t.lastUpdated.toLocaleDateString("es-MX", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Template text preview (truncated) */}
                  <div className="bg-stone-50 border border-stone-200 rounded-md p-3 mb-3 max-h-48 overflow-y-auto">
                    <pre className="text-xs text-stone-700 whitespace-pre-wrap font-sans">
                      {t.templateText.slice(0, 600)}
                      {t.templateText.length > 600 && (
                        <span className="text-stone-400 italic">... ({t.templateText.length - 600} more chars)</span>
                      )}
                    </pre>
                  </div>
                  {/* Placeholders needed */}
                  {placeholders.length > 0 && (
                    <div className="pt-3 border-t border-stone-100">
                      <div className="text-xs text-stone-500 uppercase tracking-wider mb-2">
                        Placeholders ({placeholders.length})
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {placeholders.map((p) => (
                          <Badge
                            key={p}
                            variant="outline"
                            className="text-xs bg-violet-50 text-violet-700 border-violet-300 font-mono"
                          >
                            [{p}]
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Template Variables reference table */}
        <Card className="border-stone-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Template Variables — Placeholder → Data Source Mapping</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-200 text-stone-600 text-xs uppercase tracking-wider">
                    <th className="text-left py-2 px-3">Placeholder</th>
                    <th className="text-left py-2 px-3">Data source</th>
                    <th className="text-left py-2 px-3">Sheet</th>
                    <th className="text-left py-2 px-3">Cell / Field</th>
                    <th className="text-left py-2 px-3">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {variables.map((v) => (
                    <tr key={v.id} className="border-b border-stone-100 hover:bg-stone-50">
                      <td className="py-2 px-3 font-mono text-xs text-violet-700">{v.placeholder}</td>
                      <td className="py-2 px-3 text-stone-700">{v.dataSource}</td>
                      <td className="py-2 px-3 text-stone-700">{v.sheet ?? "—"}</td>
                      <td className="py-2 px-3 font-mono text-xs text-stone-600">
                        {v.cellOrField}
                        {v.cellOrField?.includes("new field") && (
                          <Badge variant="outline" className="ml-2 text-xs bg-amber-50 text-amber-700 border-amber-300">
                            needed
                          </Badge>
                        )}
                      </td>
                      <td className="py-2 px-3 text-xs text-stone-500 max-w-xs">{v.notes ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 text-xs text-stone-500">
              💡 The UI reads a template, finds all [PLACEHOLDERS], looks up each in this table to find its data source, retrieves the value, and replaces the placeholder.
              <br />
              ⚠️ Variables marked &quot;needed&quot; require adding rows to the Assumptions sheet or a future Workbook Settings key.
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
  color?: "default" | "purple" | "amber"
}) {
  const colorMap = {
    default: "text-stone-900",
    purple: "text-violet-700",
    amber: "text-amber-700",
  }
  return (
    <div className="p-3 border-r border-stone-200 last:border-r-0">
      <div className={`text-xl font-bold ${colorMap[color]}`}>{value}</div>
      <div className="text-xs text-stone-500 mt-0.5">{label}</div>
    </div>
  )
}
