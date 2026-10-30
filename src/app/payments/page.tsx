// src/app/payments/page.tsx
//
// Payments ledger screen — unified money in/out view.
// Pulls live data from Prisma (Payment model, all rows).
//
// Layout:
//   1. Screen header (title + subtitle)
//   2. Money flow KPI bar (in this month, out this month, net, pending)
//   3. Filters (direction toggle: All / In / Out)
//   4. Payments table (sortable by date, amount, status)

import { db as prisma } from "@/lib/db"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PaymentsFilters } from "./payments-filters"
import { LogPaymentDialog } from "./log-payment-dialog"

async function getPayments() {
  return prisma.payment.findMany({
    orderBy: { date: "desc" },
  })
}

const TYPE_LABELS: Record<string, string> = {
  order_full: "Order (full)",
  event_deposit: "Event deposit",
  event_final: "Event final",
  po: "Supplier PO",
  expense: "Expense",
  other: "Other",
}

const STATUS_COLORS: Record<string, string> = {
  confirmed: "bg-emerald-50 text-emerald-700 border-emerald-300",
  pending: "bg-amber-50 text-amber-700 border-amber-300",
  refunded: "bg-stone-100 text-stone-700 border-stone-300",
  failed: "bg-red-50 text-red-700 border-red-300",
}

export default async function PaymentsPage() {
  const payments = await getPayments()

  // Compute KPIs (this month = October 2026 since that's when the demo data is dated)
  const now = new Date("2026-10-31")
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)

  const inThisMonth = payments
    .filter((p) => p.direction === "inbound" && p.date >= monthStart && p.date <= monthEnd && p.status === "confirmed")
    .reduce((sum, p) => sum + p.amount, 0)
  const outThisMonth = payments
    .filter((p) => p.direction === "outbound" && p.date >= monthStart && p.date <= monthEnd && p.status === "confirmed")
    .reduce((sum, p) => sum + p.amount, 0)
  const netThisMonth = inThisMonth - outThisMonth
  const pending = payments
    .filter((p) => p.status === "pending")
    .reduce((sum, p) => sum + p.amount, 0)

  // Serialize for client component (Date objects can't cross server→client boundary)
  const serializedPayments = payments.map((p) => ({
    id: p.id,
    paymentNumber: p.paymentNumber,
    date: p.date.toISOString(),
    direction: p.direction,
    type: p.type,
    linkedId: p.linkedId,
    linkedName: p.linkedName,
    amount: p.amount,
    method: p.method,
    reference: p.reference,
    status: p.status,
    recordedBy: p.recordedBy,
    notes: p.notes,
  }))

  return (
    <main className="min-h-screen bg-stone-50 px-6 py-10">
      <div className="mx-auto max-w-6xl">
        {/* ─── Screen header ─── */}
        <header className="mb-6 flex flex-wrap justify-between items-start gap-4">
          <div>
            <div className="text-xs uppercase tracking-wider text-stone-500">
              Unified money ledger · v1.7 + v1.9
            </div>
            <h1 className="mt-1 text-3xl font-bold text-stone-900">Payments</h1>
            <p className="mt-1 text-sm text-stone-600">
              All money flowing in (customers → Maria) and out (Maria → suppliers). One row per payment event.
            </p>
          </div>
          <LogPaymentDialog />
        </header>

        {/* ─── Money flow KPI bar ─── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 mb-6 border border-stone-200 rounded-lg overflow-hidden bg-white">
          <KpiCell
            value={`+$${inThisMonth.toLocaleString("es-MX", { maximumFractionDigits: 0 })}`}
            label="In this month"
            color="green"
          />
          <KpiCell
            value={`-$${outThisMonth.toLocaleString("es-MX", { maximumFractionDigits: 0 })}`}
            label="Out this month"
            color="red"
          />
          <KpiCell
            value={`${netThisMonth >= 0 ? "+" : "-"}$${Math.abs(netThisMonth).toLocaleString("es-MX", { maximumFractionDigits: 0 })}`}
            label="Net this month"
            color={netThisMonth >= 0 ? "green" : "red"}
          />
          <KpiCell
            value={`$${pending.toLocaleString("es-MX", { maximumFractionDigits: 0 })}`}
            label="Pending"
            color="amber"
          />
        </div>

        {/* ─── Payments table with filters ─── */}
        <Card className="border-stone-200">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base">All Payments ({payments.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <PaymentsFilters payments={serializedPayments} />
            <div className="mt-3 text-xs text-stone-500">
              💡 <strong>Business rules:</strong> Small orders = 100% prepay. Events = 50% deposit + 50% balance 14 days before.
              <br />
              All suppliers are COD (full payment upfront, no credit terms).
            </div>
          </CardContent>
        </Card>

        {/* ─── Recent payments detail ─── */}
        <Card className="mt-6 border-stone-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Recent Activity (last 10)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {payments.slice(0, 10).map((p) => {
                const isInbound = p.direction === "inbound"
                return (
                  <div
                    key={p.id}
                    className="flex items-center justify-between py-3 px-4 rounded-md border border-stone-100 bg-white hover:bg-stone-50"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                          isInbound ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                        }`}
                      >
                        {isInbound ? "→" : "←"}
                      </div>
                      <div>
                        <div className="font-medium text-stone-900">
                          {p.linkedName ?? "—"}
                          <span className="ml-2 text-xs text-stone-500 font-mono">{p.paymentNumber}</span>
                        </div>
                        <div className="text-xs text-stone-500">
                          {p.date.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}
                          {" · "}
                          {TYPE_LABELS[p.type] ?? p.type}
                          {p.method && ` · ${p.method}`}
                          {p.reference && ` · ref: ${p.reference}`}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge
                        variant="outline"
                        className={`text-xs ${STATUS_COLORS[p.status] ?? STATUS_COLORS.confirmed}`}
                      >
                        {p.status}
                      </Badge>
                      <div
                        className={`text-lg font-bold ${
                          isInbound ? "text-emerald-700" : "text-red-700"
                        }`}
                      >
                        {isInbound ? "+" : "-"}${p.amount.toLocaleString("es-MX", { maximumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>
                )
              })}
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
  color?: "default" | "green" | "red" | "amber"
}) {
  const colorMap = {
    default: "text-stone-900",
    green: "text-emerald-700",
    red: "text-red-700",
    amber: "text-amber-700",
  }
  return (
    <div className="p-4 border-r border-stone-200 last:border-r-0 min-w-[140px]">
      <div className={`text-xl font-bold ${colorMap[color]}`}>{value}</div>
      <div className="text-xs text-stone-500 mt-0.5">{label}</div>
    </div>
  )
}
