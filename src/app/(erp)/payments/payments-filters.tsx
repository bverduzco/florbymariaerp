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
      <div style={{ overflowX: "auto" }}>
        <table className="fmd-table">
          <thead>
            <tr>
              <th>Payment #</th>
              <th>Date</th>
              <th>Direction</th>
              <th>Type</th>
              <th>Linked</th>
              <th>Method</th>
              <th>Status</th>
              <th style={{ textAlign: "right" }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: "center", padding: "24px", color: "#9CA3AF" }}>No payments in this view.</td></tr>
            ) : (
              filtered.map((p) => {
                const isInbound = p.direction === "inbound"
                return (
                  <tr key={p.id}>
                    <td style={{ fontFamily: "monospace", fontSize: "11px" }}>{p.paymentNumber}</td>
                    <td>{new Date(p.date).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}</td>
                    <td style={{ fontWeight: 600, color: isInbound ? "#047857" : "#991B1B" }}>{isInbound ? "→ In" : "← Out"}</td>
                    <td>{TYPE_LABELS[p.type] ?? p.type}</td>
                    <td>{p.linkedName ?? "—"}</td>
                    <td style={{ textTransform: "capitalize" }}>{p.method ?? "—"}</td>
                    <td><span className={`fmd-status ${p.status}`}>{p.status}</span></td>
                    <td style={{ textAlign: "right", fontWeight: 700, color: isInbound ? "#047857" : "#991B1B" }}>
                      {isInbound ? "+" : "-"}${p.amount.toLocaleString("es-MX", { maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
          <tfoot>
            <tr style={{ fontWeight: 700, borderTop: "2px solid #D6D3D1" }}>
              <td colSpan={7} style={{ textAlign: "right", fontSize: "10px", textTransform: "uppercase", color: "#78716C", padding: "12px 8px" }}>
                Total ({filter}):
              </td>
              <td style={{ textAlign: "right", padding: "12px 8px", color: "#44403C" }}>
                ${filtered.reduce((sum, p) => sum + p.amount, 0).toLocaleString("es-MX", { maximumFractionDigits: 2 })}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
