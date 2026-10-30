// src/app/expenses/page.tsx
//
// Operating expenses tracker. Money out that does NOT affect inventory.
// Categories: gas, parking, software, utilities, labor, venue_fee, equipment_rental, market_run, other.

import { db as prisma } from "@/lib/db"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

async function getExpenses() {
  return prisma.expense.findMany({
    orderBy: { date: "desc" },
  })
}

const CATEGORY_META: Record<string, { emoji: string; color: string }> = {
  gas: { emoji: "⛽", color: "bg-red-50 text-red-700 border-red-300" },
  parking: { emoji: "🅿️", color: "bg-amber-50 text-amber-700 border-amber-300" },
  software: { emoji: "💻", color: "bg-blue-50 text-blue-700 border-blue-300" },
  utilities: { emoji: "💡", color: "bg-yellow-50 text-yellow-700 border-yellow-300" },
  labor: { emoji: "👤", color: "bg-violet-50 text-violet-700 border-violet-300" },
  venue_fee: { emoji: "🏛️", color: "bg-stone-100 text-stone-700 border-stone-300" },
  equipment_rental: { emoji: "🔧", color: "bg-stone-100 text-stone-700 border-stone-300" },
  market_run: { emoji: "🛒", color: "bg-emerald-50 text-emerald-700 border-emerald-300" },
  other: { emoji: "📦", color: "bg-stone-100 text-stone-700 border-stone-300" },
}

export default async function ExpensesPage() {
  const expenses = await getExpenses()

  // KPIs
  const total = expenses.length
  const totalAmount = expenses.reduce((s, e) => s + e.amount, 0)
  const monthStart = new Date("2026-10-01")
  const monthEnd = new Date("2026-10-31")
  const thisMonth = expenses.filter((e) => e.date >= monthStart && e.date <= monthEnd)
  const thisMonthTotal = thisMonth.reduce((s, e) => s + e.amount, 0)

  // By category
  const byCategory = expenses.reduce((acc, e) => {
    if (!acc[e.category]) acc[e.category] = { count: 0, total: 0 }
    acc[e.category].count++
    acc[e.category].total += e.amount
    return acc
  }, {} as Record<string, { count: number; total: number }>)

  return (
    <main className="min-h-screen bg-stone-50 px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-wrap justify-between items-start gap-4">
          <div>
            <div className="text-xs uppercase tracking-wider text-stone-500">
              Money out that doesn&apos;t affect inventory · v1.9
            </div>
            <h1 className="mt-1 text-3xl font-bold text-stone-900">Expenses</h1>
            <p className="mt-1 text-sm text-stone-600">
              Operating expenses: gas, parking, software, utilities, etc. For inventory purchases, use Purchase Orders or Ad-hoc Purchases.
            </p>
          </div>
          <button className="px-4 py-2 text-sm font-medium bg-stone-900 text-white rounded-md hover:bg-stone-800 transition">
            + Add Expense
          </button>
        </header>

        {/* KPI bar */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-0 mb-6 border border-stone-200 rounded-lg overflow-hidden bg-white">
          <KpiCell value={`${total}`} label="Total expenses" />
          <KpiCell
            value={`$${thisMonthTotal.toLocaleString("es-MX", { maximumFractionDigits: 0 })}`}
            label="This month (October)"
            color="red"
          />
          <KpiCell
            value={`$${totalAmount.toLocaleString("es-MX", { maximumFractionDigits: 0 })}`}
            label="All-time total"
            color="amber"
          />
        </div>

        {/* By category breakdown */}
        <Card className="mb-6 border-stone-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">By Category</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {Object.entries(byCategory).map(([cat, data]) => {
                const meta = CATEGORY_META[cat] ?? CATEGORY_META.other
                return (
                  <div
                    key={cat}
                    className={`p-3 rounded-md border ${meta.color}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-xs uppercase tracking-wider opacity-70">
                        {meta.emoji} {cat.replace(/_/g, " ")}
                      </div>
                      <div className="text-xs opacity-70">{data.count}x</div>
                    </div>
                    <div className="text-xl font-bold mt-1">
                      ${data.total.toLocaleString("es-MX", { maximumFractionDigits: 0 })}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Expenses table */}
        <Card className="border-stone-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">All Expenses ({expenses.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-200 text-stone-600 text-xs uppercase tracking-wider">
                    <th className="text-left py-2 px-3">Expense #</th>
                    <th className="text-left py-2 px-3">Date</th>
                    <th className="text-left py-2 px-3">Category</th>
                    <th className="text-left py-2 px-3">Description</th>
                    <th className="text-left py-2 px-3">Vendor</th>
                    <th className="text-left py-2 px-3">Method</th>
                    <th className="text-left py-2 px-3">Linked</th>
                    <th className="text-right py-2 px-3">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-stone-400">
                        No expenses logged yet.
                      </td>
                    </tr>
                  ) : (
                    expenses.map((e) => {
                      const meta = CATEGORY_META[e.category] ?? CATEGORY_META.other
                      return (
                        <tr key={e.id} className="border-b border-stone-100 hover:bg-stone-50">
                          <td className="py-2 px-3 font-mono text-xs text-stone-500">{e.expenseNumber}</td>
                          <td className="py-2 px-3 text-xs text-stone-700">
                            {e.date.toLocaleDateString("es-MX", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
                          </td>
                          <td className="py-2 px-3">
                            <Badge variant="outline" className={`text-xs ${meta.color}`}>
                              {meta.emoji} {e.category}
                            </Badge>
                          </td>
                          <td className="py-2 px-3">
                            <div className="text-stone-900">{e.description}</div>
                            {e.notes && (
                              <div className="text-xs text-stone-500 line-clamp-1 mt-0.5">{e.notes}</div>
                            )}
                          </td>
                          <td className="py-2 px-3 text-stone-700">{e.vendorPayee ?? "—"}</td>
                          <td className="py-2 px-3 text-xs capitalize text-stone-600">{e.paymentMethod ?? "—"}</td>
                          <td className="py-2 px-3 text-xs">
                            {e.linkedOrder && (
                              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">
                                {e.linkedOrder}
                              </Badge>
                            )}
                            {e.linkedEvent && (
                              <Badge variant="outline" className="bg-violet-50 text-violet-700 border-violet-300">
                                {e.linkedEvent}
                              </Badge>
                            )}
                            {!e.linkedOrder && !e.linkedEvent && (
                              <span className="text-stone-400">—</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-right font-bold text-red-700">
                            ${e.amount.toLocaleString("es-MX", { maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-stone-300 font-bold">
                    <td colSpan={7} className="py-3 px-3 text-right text-stone-600 text-xs uppercase tracking-wider">
                      Total:
                    </td>
                    <td className="py-3 px-3 text-right text-red-700">
                      ${totalAmount.toLocaleString("es-MX", { maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tfoot>
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
  color?: "default" | "red" | "amber"
}) {
  const colorMap = {
    default: "text-stone-900",
    red: "text-red-700",
    amber: "text-amber-700",
  }
  return (
    <div className="p-3 border-r border-stone-200 last:border-r-0">
      <div className={`text-xl font-bold ${colorMap[color]}`}>{value}</div>
      <div className="text-xs text-stone-500 mt-0.5">{label}</div>
    </div>
  )
}
