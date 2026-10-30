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
import {
  OrderDetailDialog,
  type OrderDetailOrder,
  type OrderDetailQuote,
} from "./order-detail-dialog"

// ───────────────────────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────────────────────
type DateOrString = Date | string | null | undefined

export type CustomerDetailCustomer = {
  id: string
  name: string
  phone: string | null
  email: string | null
  address: string | null
  notes: string | null
  status: string
  createdAt: DateOrString
  lifetimeValue: number
  orderCount: number
  quoteCount: number
  eventCount: number
  orders: OrderDetailOrder[]
  quotes: OrderDetailQuote[]
}

// ───────────────────────────────────────────────────────────────────────────
// Helpers (mirror order-detail-dialog)
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

const QUOTE_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  viewed: "Viewed",
  negotiating: "Negotiating",
  accepted: "Accepted",
  declined: "Declined",
  expired: "Expired",
}

const STATUS_LABELS: Record<string, string> = {
  lead: "Lead",
  prospect: "Prospect",
  customer: "Customer",
  inactive: "Inactive",
}

// ───────────────────────────────────────────────────────────────────────────
// Component
// ───────────────────────────────────────────────────────────────────────────
export function CustomerDetailDialog({
  customer,
  trigger,
}: {
  customer: CustomerDetailCustomer
  trigger: ReactNode
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-[820px] max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="font-semibold">{customer.name}</span>
            <span className={`fmd-status ${customer.status}`}>
              {STATUS_LABELS[customer.status] ?? customer.status}
            </span>
            <span className="text-xs text-stone-500 ml-2">
              since {fmtDate(customer.createdAt)}
            </span>
          </DialogTitle>
          <DialogDescription className="sr-only">
            Customer details for {customer.name}
          </DialogDescription>
        </DialogHeader>

        {/* ── Contact + summary grid ───────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="border border-stone-200 rounded-md p-3">
            <div className="text-[9px] uppercase tracking-wider text-stone-500 mb-2">
              Contact
            </div>
            <div className="space-y-1">
              {customer.phone && (
                <div className="text-stone-700">📞 {customer.phone}</div>
              )}
              {customer.email && (
                <div className="text-stone-700">✉️ {customer.email}</div>
              )}
              {customer.address && (
                <div className="text-stone-700">📍 {customer.address}</div>
              )}
              {!customer.phone && !customer.email && !customer.address && (
                <div className="text-stone-400 italic">No contact info</div>
              )}
            </div>
          </div>
          <div className="border border-stone-200 rounded-md p-3">
            <div className="text-[9px] uppercase tracking-wider text-stone-500 mb-2">
              Summary
            </div>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-stone-500">Lifetime value</span>
                <span className="font-semibold text-emerald-700">
                  {fmtMoney(customer.lifetimeValue)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Orders</span>
                <span>{customer.orderCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Quotes</span>
                <span>{customer.quoteCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Events</span>
                <span>{customer.eventCount}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Notes ────────────────────────────────────────────── */}
        {customer.notes && (
          <div className="border border-amber-200 bg-amber-50 rounded-md p-3 text-xs text-amber-900">
            <div className="text-[9px] uppercase tracking-wider text-amber-700 mb-1">
              Notes
            </div>
            {customer.notes}
          </div>
        )}

        {/* ── Orders section ───────────────────────────────────── */}
        <div className="border border-stone-200 rounded-md p-3">
          <div className="text-[9px] uppercase tracking-wider text-stone-500 mb-2">
            Orders ({customer.orders.length}) — click row for full details
          </div>
          {customer.orders.length === 0 ? (
            <div className="text-center py-4 text-stone-400 italic text-xs">
              No orders yet for this customer.
            </div>
          ) : (
            <div className="space-y-1">
              {customer.orders.map((o) => {
                const itemsTotal = o.lineItems.reduce(
                  (s, l) => s + l.unitPrice * l.qty,
                  0
                )
                const orderTotal = itemsTotal + o.deliveryFee - o.discount
                return (
                  <OrderDetailDialog
                    key={o.id}
                    order={o}
                    trigger={
                      <button
                        className="order-row-hover"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          padding: "6px 8px",
                          fontSize: "11px",
                          background: "#FAFAF9",
                          border: "1px solid #D6D3D1",
                          borderRadius: "4px",
                          color: "#44403C",
                          cursor: "pointer",
                          transition: "background 0.15s, border-color 0.15s",
                          textAlign: "left",
                          width: "100%",
                        }}
                        title={`View details for ${o.orderNumber}`}
                      >
                        <span
                          style={{
                            fontFamily: "monospace",
                            fontWeight: 600,
                            color: "#44403C",
                          }}
                        >
                          {o.orderNumber}
                        </span>
                        <span style={{ color: "#78716C" }}>·</span>
                        <span>
                          {fmtDate(o.deliveryDate ?? o.fulfilledAt)}
                        </span>
                        <span style={{ marginLeft: "auto", fontWeight: 600, color: "#BE185D" }}>
                          {fmtMoney(orderTotal)}
                        </span>
                        <span
                          className={`fmd-status ${o.status}`}
                          style={{ fontSize: "9px" }}
                        >
                          {o.status.replace(/_/g, " ")}
                        </span>
                      </button>
                    }
                  />
                )
              })}
            </div>
          )}
        </div>

        {/* ── Quotes section ────────────────────────────────────── */}
        <div className="border border-stone-200 rounded-md p-3">
          <div className="text-[9px] uppercase tracking-wider text-stone-500 mb-2">
            Quotes ({customer.quotes.length})
          </div>
          {customer.quotes.length === 0 ? (
            <div className="text-center py-4 text-stone-400 italic text-xs">
              No quotes yet for this customer.
            </div>
          ) : (
            <div className="space-y-2">
              {customer.quotes.map((q) => (
                <div
                  key={q.id}
                  className="border border-stone-100 rounded p-2 bg-stone-50 text-xs"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono font-semibold text-stone-800">
                      {q.quoteNumber}
                    </span>
                    <span className={`fmd-status ${q.status}`}>
                      {QUOTE_STATUS_LABELS[q.status] ?? q.status}
                    </span>
                    <span className="text-stone-500 ml-auto">
                      Quoted {fmtDate(q.quoteDate)}
                      {q.validUntil && ` · valid until ${fmtDate(q.validUntil)}`}
                    </span>
                  </div>
                  {q.lines.length > 0 && (
                    <div className="border border-stone-200 rounded overflow-hidden bg-white mb-2">
                      <table className="w-full text-[11px]">
                        <thead className="bg-stone-50 text-stone-600">
                          <tr>
                            <th className="text-left px-2 py-1 font-medium">
                              Item
                            </th>
                            <th className="text-right px-2 py-1 font-medium w-10">
                              Qty
                            </th>
                            <th className="text-right px-2 py-1 font-medium w-16">
                              Unit $
                            </th>
                            <th className="text-right px-2 py-1 font-medium w-20">
                              Line $
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {q.lines.map((l) => (
                            <tr
                              key={l.id}
                              className="border-t border-stone-100"
                            >
                              <td className="px-2 py-1">
                                <div className="font-medium text-stone-800">
                                  {l.description}
                                </div>
                                {l.productSku && (
                                  <div className="font-mono text-[9px] text-stone-500">
                                    {l.productSku}
                                  </div>
                                )}
                              </td>
                              <td className="px-2 py-1 text-right tabular-nums">
                                {l.qty}
                              </td>
                              <td className="px-2 py-1 text-right tabular-nums">
                                {fmtMoney(l.unitPrice)}
                              </td>
                              <td className="px-2 py-1 text-right font-semibold tabular-nums">
                                {fmtMoney(l.unitPrice * l.qty)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <div className="flex items-center gap-3 flex-wrap text-[10px]">
                    <span className="text-stone-500">
                      Subtotal:{" "}
                      <span className="font-semibold text-stone-800">
                        {fmtMoney(q.subtotal)}
                      </span>
                    </span>
                    <span className="text-stone-500">
                      IVA:{" "}
                      <span className="font-semibold text-stone-800">
                        {fmtMoney(q.iva)}
                      </span>
                    </span>
                    <span className="text-stone-500">
                      Total:{" "}
                      <span className="font-bold text-rose-900">
                        {fmtMoney(q.total)}
                      </span>
                    </span>
                    <span className="text-stone-500">
                      Deposit: {fmtMoney(q.depositRequired)}
                    </span>
                    {q.eventType && (
                      <span className="text-stone-500">
                        Event: {q.eventType}
                      </span>
                    )}
                    {q.eventDate && (
                      <span className="text-stone-500">
                        On: {fmtDate(q.eventDate)}
                      </span>
                    )}
                    {q.leadSource && (
                      <span className="text-stone-500">
                        Source: {q.leadSource}
                      </span>
                    )}
                    {q.lostReason && (
                      <span className="text-red-700">
                        Lost: {q.lostReason}
                      </span>
                    )}
                  </div>
                  {q.notes && (
                    <div className="mt-1 p-1.5 bg-white border border-stone-200 rounded text-stone-700 text-[11px]">
                      <span className="text-stone-500 text-[9px] uppercase tracking-wider mr-2">
                        Notes
                      </span>
                      {q.notes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
