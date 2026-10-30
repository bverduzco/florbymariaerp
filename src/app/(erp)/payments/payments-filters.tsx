"use client"

// src/app/payments/payments-filters.tsx
//
// Client-side filterable payments table.
// Three filter tabs: All / Inbound / Outbound.
// Renders the same data passed from server, just filtered by direction.

import { useState } from "react"
import { Badge } from "@/components/ui/badge"

type PaymentLite = {
  id: string
  paymentNumber: string
  date: string
  direction: string
  type: string
  linkedId: string | null
  linkedName: string | null
  amount: number
  method: string | null
  reference: string | null
  status: string
  recordedBy: string | null
  notes: string | null
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

interface PaymentsFiltersProps {
  payments: PaymentLite[]
}

type FilterTab = "all" | "inbound" | "outbound"

export function PaymentsFilters({ payments }: PaymentsFiltersProps) {
  const [filter, setFilter] = useState<FilterTab>("all")

  const filtered = payments.filter((p) => {
    if (filter === "all") return true
    return p.direction === filter
  })

  const tabs: Array<{ key: FilterTab; label: string; count: number }> = [
    { key: "all", label: "All", count: payments.length },
    {
      key: "inbound",
      label: "In (customers)",
      count: payments.filter((p) => p.direction === "inbound").length,
    },
    {
      key: "outbound",
      label: "Out (suppliers)",
      count: payments.filter((p) => p.direction === "outbound").length,
    },
  ]

  return (
    <div>
      {/* Filter tabs */}
      <div className="flex gap-1 mb-4 border-b border-stone-200">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
              filter === tab.key
                ? "border-stone-900 text-stone-900"
                : "border-transparent text-stone-500 hover:text-stone-700"
            }`}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-200 text-stone-600 text-xs uppercase tracking-wider">
              <th className="text-left py-2 px-3">Payment #</th>
              <th className="text-left py-2 px-3">Date</th>
              <th className="text-left py-2 px-3">Direction</th>
              <th className="text-left py-2 px-3">Type</th>
              <th className="text-left py-2 px-3">Linked</th>
              <th className="text-left py-2 px-3">Method</th>
              <th className="text-left py-2 px-3">Status</th>
              <th className="text-right py-2 px-3">Amount</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-stone-400">
                  No payments in this view.
                </td>
              </tr>
            ) : (
              filtered.map((p) => {
                const isInbound = p.direction === "inbound"
                return (
                  <tr key={p.id} className="border-b border-stone-100 hover:bg-stone-50">
                    <td className="py-2 px-3 font-mono text-xs">{p.paymentNumber}</td>
                    <td className="py-2 px-3">
                      {new Date(p.date).toLocaleDateString("es-MX", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="py-2 px-3">
                      <span className={isInbound ? "text-emerald-700 font-medium" : "text-red-700 font-medium"}>
                        {isInbound ? "→ In" : "← Out"}
                      </span>
                    </td>
                    <td className="py-2 px-3">{TYPE_LABELS[p.type] ?? p.type}</td>
                    <td className="py-2 px-3">
                      <div>{p.linkedName ?? "—"}</div>
                      <div className="text-xs text-stone-500 font-mono">{p.linkedId ?? ""}</div>
                    </td>
                    <td className="py-2 px-3 capitalize">{p.method ?? "—"}</td>
                    <td className="py-2 px-3">
                      <Badge
                        variant="outline"
                        className={`text-xs ${STATUS_COLORS[p.status] ?? STATUS_COLORS.confirmed}`}
                      >
                        {p.status}
                      </Badge>
                    </td>
                    <td className={`py-2 px-3 text-right font-bold ${
                      isInbound ? "text-emerald-700" : "text-red-700"
                    }`}>
                      {isInbound ? "+" : "-"}${p.amount.toLocaleString("es-MX", { maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-stone-300 font-bold">
              <td colSpan={7} className="py-3 px-3 text-right text-stone-600 text-xs uppercase tracking-wider">
                Total ({filter === "all" ? "all" : filter}):
              </td>
              <td className="py-3 px-3 text-right">
                ${filtered.reduce((sum, p) => sum + p.amount, 0).toLocaleString("es-MX", { maximumFractionDigits: 2 })}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
