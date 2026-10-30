// src/app/quotes/page.tsx
//
// Quotes list screen — sales pipeline view.
// Pulls live data from Prisma (Quote + QuoteLine + Customer).
//
// Layout:
//   1. Screen header (title + subtitle + "New quote" button)
//   2. Pipeline KPI bar (5 KPIs: total quotes, accepted, sent, declined, conversion rate)
//   3. Quotes table (sortable by status, date, total)

import { db as prisma } from "@/lib/db"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

async function getQuotes() {
  return prisma.quote.findMany({
    include: {
      customer: { select: { id: true, name: true, phone: true } },
      lines: { select: { id: true, description: true, qty: true, lineTotal: true } },
    },
    orderBy: { quoteDate: "desc" },
  })
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-stone-100 text-stone-700 border-stone-300",
  sent: "bg-blue-50 text-blue-700 border-blue-300",
  viewed: "bg-indigo-50 text-indigo-700 border-indigo-300",
  negotiating: "bg-amber-50 text-amber-700 border-amber-300",
  accepted: "bg-emerald-50 text-emerald-700 border-emerald-300",
  declined: "bg-red-50 text-red-700 border-red-300",
  expired: "bg-stone-100 text-stone-500 border-stone-300",
}

const LOST_REASON_LABELS: Record<string, string> = {
  too_expensive: "Too expensive",
  went_elsewhere: "Went elsewhere",
  postponed: "Postponed",
  unresponsive: "Unresponsive",
  other: "Other",
}

export default async function QuotesPage() {
  const quotes = await getQuotes()

  // Compute KPIs
  const total = quotes.length
  const accepted = quotes.filter((q) => q.status === "accepted").length
  const sent = quotes.filter((q) => q.status === "sent" || q.status === "viewed").length
  const negotiating = quotes.filter((q) => q.status === "negotiating").length
  const declined = quotes.filter((q) => q.status === "declined").length
  const expired = quotes.filter((q) => q.status === "expired").length
  const totalValue = quotes
    .filter((q) => q.status === "accepted" || q.status === "sent" || q.status === "negotiating")
    .reduce((sum, q) => sum + q.total, 0)
  const conversionRate = total > 0 ? Math.round((accepted / total) * 100) : 0

  return (
    <main className="min-h-screen bg-stone-50 px-6 py-10">
      <div className="mx-auto max-w-6xl">
        {/* ─── Screen header ─── */}
        <header className="mb-6 flex flex-wrap justify-between items-start gap-4">
          <div>
            <div className="text-xs uppercase tracking-wider text-stone-500">
              Sales pipeline · v1.6 + v1.9
            </div>
            <h1 className="mt-1 text-3xl font-bold text-stone-900">Quotes</h1>
            <p className="mt-1 text-sm text-stone-600">
              Formal proposals sent to customers. Lifecycle: draft → sent → viewed → negotiating → accepted → declined → expired.
            </p>
          </div>
          <button className="px-4 py-2 text-sm font-medium bg-stone-900 text-white rounded-md hover:bg-stone-800 transition">
            + New Quote
          </button>
        </header>

        {/* ─── Pipeline KPI bar ─── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-0 mb-6 border border-stone-200 rounded-lg overflow-hidden bg-white">
          <KpiCell value={`${total}`} label="Total quotes" />
          <KpiCell value={`${accepted}`} label="Accepted" color="green" />
          <KpiCell value={`${sent + negotiating}`} label="In pipeline" color="blue" />
          <KpiCell value={`${declined + expired}`} label="Lost/expired" color="red" />
          <KpiCell value={`${conversionRate}%`} label="Conversion rate" color="purple" />
          <KpiCell
            value={`$${totalValue.toLocaleString("es-MX", { maximumFractionDigits: 0 })}`}
            label="Pipeline value"
            color="default"
          />
        </div>

        {/* ─── Quotes table ─── */}
        <Card className="border-stone-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">All Quotes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-200 text-stone-600 text-xs uppercase tracking-wider">
                    <th className="text-left py-2 px-3">Quote #</th>
                    <th className="text-left py-2 px-3">Customer</th>
                    <th className="text-left py-2 px-3">Type</th>
                    <th className="text-left py-2 px-3">Event date</th>
                    <th className="text-left py-2 px-3">Status</th>
                    <th className="text-right py-2 px-3">Items</th>
                    <th className="text-right py-2 px-3">Total</th>
                    <th className="text-left py-2 px-3">Notes / Lost reason</th>
                  </tr>
                </thead>
                <tbody>
                  {quotes.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-stone-400">
                        No quotes yet. Click "+ New Quote" to create one.
                      </td>
                    </tr>
                  ) : (
                    quotes.map((q) => {
                      const itemCount = q.lines.length
                      const isLost = q.status === "declined" || q.status === "expired"
                      return (
                        <tr key={q.id} className="border-b border-stone-100 hover:bg-stone-50">
                          <td className="py-3 px-3 font-mono text-xs">{q.quoteNumber}</td>
                          <td className="py-3 px-3">
                            <div className="font-medium text-stone-900">{q.customerName ?? "—"}</div>
                            <div className="text-xs text-stone-500">{q.customer?.phone}</div>
                          </td>
                          <td className="py-3 px-3 capitalize">{q.eventType ?? "—"}</td>
                          <td className="py-3 px-3">
                            {q.eventDate
                              ? q.eventDate.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })
                              : "—"}
                          </td>
                          <td className="py-3 px-3">
                            <Badge
                              variant="outline"
                              className={`text-xs ${STATUS_COLORS[q.status] ?? STATUS_COLORS.draft}`}
                            >
                              {q.status}
                            </Badge>
                          </td>
                          <td className="py-3 px-3 text-right text-stone-600">{itemCount}</td>
                          <td className="py-3 px-3 text-right font-medium">
                            ${q.total.toLocaleString("es-MX", { maximumFractionDigits: 0 })}
                          </td>
                          <td className="py-3 px-3 text-xs text-stone-500 max-w-xs">
                            {isLost && q.lostReason ? (
                              <span className="text-red-700">
                                Lost: {LOST_REASON_LABELS[q.lostReason] ?? q.lostReason}
                              </span>
                            ) : q.notes ? (
                              <span className="line-clamp-2">{q.notes}</span>
                            ) : (
                              <span className="text-stone-400">—</span>
                            )}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
            <div className="mt-3 text-xs text-stone-500">
              📊 {total} quotes total · {accepted} accepted ({conversionRate}% conversion) · ${totalValue.toLocaleString("es-MX", { maximumFractionDigits: 0 })} in active pipeline.
              <br />
              💡 Click a quote number to view full details (line items, deposit, linked order).
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
  color?: "default" | "green" | "blue" | "red" | "purple"
}) {
  const colorMap = {
    default: "text-stone-900",
    green: "text-emerald-700",
    blue: "text-blue-700",
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
