"use client"

import { ReactNode } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog"

// ───────────────────────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────────────────────
type DateOrString = Date | string | null | undefined

export type PODetailLine = {
  id: string
  materialSku: string
  materialName: string
  qtyPacks: number
  costPerPack: number
  lineTotal: number
}

export type PODetailPO = {
  id: string
  poNumber: string
  supplier: string
  status: string
  totalCost: number
  notes: string | null
  createdAt: DateOrString
  updatedAt: DateOrString
  lines: PODetailLine[]
}

// ───────────────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────────────
function fmtMoney(n: number | null | undefined) {
  if (n === null || n === undefined) return "—"
  return "$" + n.toLocaleString("es-MX", { maximumFractionDigits: 2 })
}

function fmtDate(v: DateOrString) {
  if (!v) return "—"
  const d = v instanceof Date ? v : new Date(v)
  return d.toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

function fmtDateTime(v: DateOrString) {
  if (!v) return "—"
  const d = v instanceof Date ? v : new Date(v)
  return d.toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

const PO_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  approved: "Approved",
  sent: "Sent",
  received: "Received",
  cancelled: "Cancelled",
  partial: "Partial",
}

// ───────────────────────────────────────────────────────────────────────────
// Component
// ───────────────────────────────────────────────────────────────────────────
export function PODetailDialog({
  po,
  trigger,
}: {
  po: PODetailPO
  trigger: ReactNode
}) {
  const linesTotal = po.lines.reduce((s, l) => s + l.lineTotal, 0)
  const discrepancy = linesTotal - po.totalCost

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-[680px] max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="font-mono">{po.poNumber}</span>
            <span className={`fmd-status ${po.status}`}>
              {PO_STATUS_LABELS[po.status] ?? po.status}
            </span>
            <span className="text-xs text-stone-500 ml-2">
              🏭 {po.supplier}
            </span>
          </DialogTitle>
          <DialogDescription className="sr-only">
            Purchase order details for {po.poNumber}
          </DialogDescription>
        </DialogHeader>

        {/* ── Header summary grid ─────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="border border-stone-200 rounded-md p-3">
            <div className="text-[9px] uppercase tracking-wider text-stone-500 mb-2">
              Order info
            </div>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-stone-500">Created</span>
                <span>{fmtDate(po.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Last update</span>
                <span>{fmtDateTime(po.updatedAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Lines</span>
                <span>{po.lines.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Total packs</span>
                <span>
                  {po.lines.reduce((s, l) => s + l.qtyPacks, 0)}
                </span>
              </div>
            </div>
          </div>
          <div className="border border-stone-200 rounded-md p-3">
            <div className="text-[9px] uppercase tracking-wider text-stone-500 mb-2">
              Cost
            </div>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-stone-500">Σ Line totals</span>
                <span className="tabular-nums">
                  {fmtMoney(linesTotal)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">PO total (stored)</span>
                <span className="tabular-nums font-semibold">
                  {fmtMoney(po.totalCost)}
                </span>
              </div>
              {discrepancy !== 0 && (
                <div className="flex justify-between text-amber-700">
                  <span className="text-stone-500">Discrepancy</span>
                  <span className="tabular-nums">
                    {discrepancy > 0 ? "+" : "−"}
                    {fmtMoney(Math.abs(discrepancy))}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Line items table ─────────────────────────────────── */}
        <div className="border border-stone-200 rounded-md overflow-hidden">
          <div className="px-3 py-2 bg-stone-50 border-b border-stone-200 text-xs font-semibold text-stone-700">
            Line items ({po.lines.length})
          </div>
          {po.lines.length === 0 ? (
            <div className="p-4 text-center text-xs text-stone-400">
              No line items on this PO.
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-stone-50 text-stone-600">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Material</th>
                  <th className="text-left px-3 py-2 font-medium w-24">SKU</th>
                  <th className="text-right px-3 py-2 font-medium w-16">
                    Packs
                  </th>
                  <th className="text-right px-3 py-2 font-medium w-24">
                    Cost/pack
                  </th>
                  <th className="text-right px-3 py-2 font-medium w-24">
                    Line total
                  </th>
                </tr>
              </thead>
              <tbody>
                {po.lines.map((l) => (
                  <tr
                    key={l.id}
                    className="border-t border-stone-100"
                  >
                    <td className="px-3 py-2 font-medium text-stone-800">
                      {l.materialName}
                    </td>
                    <td className="px-3 py-2 font-mono text-[10px] text-stone-600">
                      {l.materialSku}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {l.qtyPacks}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {fmtMoney(l.costPerPack)}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">
                      {fmtMoney(l.lineTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Notes ────────────────────────────────────────────── */}
        {po.notes && (
          <div className="border border-amber-200 bg-amber-50 rounded-md p-3 text-xs text-amber-900">
            <div className="text-[9px] uppercase tracking-wider text-amber-700 mb-1">
              Notes
            </div>
            {po.notes}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
