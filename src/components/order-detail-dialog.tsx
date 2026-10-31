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
// Types — server components serialize orders/quotes to this shape
// (Dates → ISO strings so they cross the server/client boundary safely)
// ───────────────────────────────────────────────────────────────────────────
// Type alias: server components may pass either Prisma Date objects or
// ISO strings (when serialized). Both work in fmtDate/fmtDateTime.
type DateOrString = Date | string | null | undefined

export type OrderDetailLineItem = {
  id: string
  productSku: string
  productName: string
  productSize: string | null
  qty: number
  unitPrice: number
}

export type OrderDetailExecutionLog = {
  id: string
  executionNumber: string
  status: string
  executedAt: DateOrString
  actualCost: number | null
  lines: Array<{
    materialName: string
    qtyUsed: number
    unit: string
    lineCost: number
    type: string
  }>
}

export type OrderDetailOrder = {
  id: string
  orderNumber: string
  status: string
  customer: {
    name: string | null
    phone: string | null
    email: string | null
    address: string | null
  } | null
  event: {
    eventNumber: string
    name: string
    eventDate: DateOrString
  } | null
  deliveryDate: DateOrString
  deliveryAddress: string | null
  cardMessage: string | null
  deliveryNotes: string | null
  internalNotes: string | null
  deliveryFee: number
  discount: number
  paymentStatus: string
  paymentMethod: string | null
  paymentAmount: number | null
  paymentReference: string | null
  paymentConfirmedAt: DateOrString
  procurementStartedAt: DateOrString
  producedAt: DateOrString
  deliveredAt: DateOrString
  fulfilledAt: DateOrString
  lineItems: OrderDetailLineItem[]
  executionLogs: OrderDetailExecutionLog[]
}

export type OrderDetailQuote = {
  id: string
  quoteNumber: string
  quoteDate: DateOrString
  validUntil: DateOrString
  status: string
  eventType: string | null
  eventDate: DateOrString
  customerName: string | null
  subtotal: number
  iva: number
  total: number
  depositRequired: number
  leadSource: string | null
  lostReason: string | null
  notes: string | null
  lines: Array<{
    id: string
    productSku: string | null
    description: string
    qty: number
    unitPrice: number
  }>
}

// ───────────────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────────────
function fmtMoney(n: number | null | undefined) {
  if (n === null || n === undefined) return "—"
  return "$" + n.toLocaleString("es-MX", { maximumFractionDigits: 2 })
}

// Accept Date | string | null | undefined so server components can pass
// Prisma Date objects directly without manual .toISOString() conversion.
function toDate(v: string | Date | null | undefined): Date | null {
  if (v === null || v === undefined) return null
  return v instanceof Date ? v : new Date(v)
}

function fmtDate(iso: string | Date | null | undefined) {
  const d = toDate(iso)
  if (!d) return "—"
  return d.toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

function fmtDateTime(iso: string | Date | null | undefined) {
  const d = toDate(iso)
  if (!d) return "—"
  return d.toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  quote_sent: "Quote sent",
  payment_confirmed: "Payment confirmed",
  procuring: "Procuring",
  producing: "Producing",
  delivered: "Delivered",
  fulfilled: "Fulfilled",
  cancelled: "Cancelled",
  awaiting_payment: "Awaiting payment",
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

// ───────────────────────────────────────────────────────────────────────────
// Component
// ───────────────────────────────────────────────────────────────────────────
export function OrderDetailDialog({
  order,
  quote,
  trigger,
}: {
  order: OrderDetailOrder
  quote?: OrderDetailQuote | null
  trigger: ReactNode
}) {
  const itemsSubtotal = order.lineItems.reduce(
    (s, l) => s + l.unitPrice * l.qty,
    0
  )
  const orderTotal = itemsSubtotal + order.deliveryFee - order.discount

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-[760px] max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="font-mono">{order.orderNumber}</span>
            <span className={`fmd-status ${order.status}`}>
              {STATUS_LABELS[order.status] ?? order.status}
            </span>
            {order.event && (
              <span className="text-xs text-stone-500 ml-2">
                🎉 {order.event.eventNumber} · {order.event.name}
              </span>
            )}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Order details for {order.orderNumber}
          </DialogDescription>
        </DialogHeader>

        {/* ── Customer + Delivery grid ─────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="border border-stone-200 rounded-md p-3">
            <div className="text-[9px] uppercase tracking-wider text-stone-500 mb-2">
              Customer
            </div>
            {order.customer ? (
              <div className="space-y-1">
                <div className="font-semibold text-stone-800">
                  {order.customer.name ?? "—"}
                </div>
                {order.customer.phone && (
                  <div className="text-stone-600">📞 {order.customer.phone}</div>
                )}
                {order.customer.email && (
                  <div className="text-stone-600">✉️ {order.customer.email}</div>
                )}
                {order.customer.address && (
                  <div className="text-stone-600">
                    📍 {order.customer.address}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-stone-400 italic">No customer linked</div>
            )}
          </div>
          <div className="border border-stone-200 rounded-md p-3">
            <div className="text-[9px] uppercase tracking-wider text-stone-500 mb-2">
              Delivery
            </div>
            <div className="space-y-1">
              <div>
                <span className="text-stone-500">Date:</span>{" "}
                <span className="font-medium text-stone-800">
                  {fmtDate(order.deliveryDate)}
                </span>
              </div>
              {order.deliveryAddress && (
                <div className="text-stone-600">📍 {order.deliveryAddress}</div>
              )}
              {order.cardMessage && (
                <div className="text-stone-600 italic">
                  💬 &ldquo;{order.cardMessage}&rdquo;
                </div>
              )}
              {order.deliveryNotes && (
                <div className="text-stone-600">
                  🚚 {order.deliveryNotes}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Timeline strip ────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-1 text-[10px] text-stone-600">
          <span
            className={`px-2 py-1 rounded ${order.procurementStartedAt ? "bg-amber-100 text-amber-800" : "bg-stone-100 text-stone-400"}`}
          >
            🚚 Procured{" "}
            {order.procurementStartedAt
              ? fmtDate(order.procurementStartedAt)
              : "—"}
          </span>
          <span className="text-stone-300">→</span>
          <span
            className={`px-2 py-1 rounded ${order.producedAt ? "bg-blue-100 text-blue-800" : "bg-stone-100 text-stone-400"}`}
          >
            🌷 Produced{" "}
            {order.producedAt ? fmtDate(order.producedAt) : "—"}
          </span>
          <span className="text-stone-300">→</span>
          <span
            className={`px-2 py-1 rounded ${order.deliveredAt ? "bg-purple-100 text-purple-800" : "bg-stone-100 text-stone-400"}`}
          >
            📦 Delivered{" "}
            {order.deliveredAt ? fmtDate(order.deliveredAt) : "—"}
          </span>
          <span className="text-stone-300">→</span>
          <span
            className={`px-2 py-1 rounded ${order.fulfilledAt ? "bg-emerald-100 text-emerald-800" : "bg-stone-100 text-stone-400"}`}
          >
            ✓ Fulfilled{" "}
            {order.fulfilledAt ? fmtDate(order.fulfilledAt) : "—"}
          </span>
        </div>

        {/* ── Line items table ─────────────────────────────────── */}
        <div className="border border-stone-200 rounded-md overflow-hidden">
          <div className="px-3 py-2 bg-stone-50 border-b border-stone-200 text-xs font-semibold text-stone-700">
            Line items ({order.lineItems.length})
          </div>
          {order.lineItems.length === 0 ? (
            <div className="p-4 text-center text-xs text-stone-400">
              No line items.
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-stone-50 text-stone-600">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Product</th>
                  <th className="text-left px-3 py-2 font-medium w-20">SKU</th>
                  <th className="text-right px-3 py-2 font-medium w-12">Qty</th>
                  <th className="text-right px-3 py-2 font-medium w-20">
                    Unit $
                  </th>
                  <th className="text-right px-3 py-2 font-medium w-24">
                    Line $
                  </th>
                </tr>
              </thead>
              <tbody>
                {order.lineItems.map((l) => (
                  <tr
                    key={l.id}
                    className="border-t border-stone-100"
                  >
                    <td className="px-3 py-2">
                      <div className="font-medium text-stone-800">
                        {l.productName}
                      </div>
                      {l.productSize && (
                        <div className="text-[10px] text-stone-500">
                          {l.productSize}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono text-[10px] text-stone-600">
                      {l.productSku}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {l.qty}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {fmtMoney(l.unitPrice)}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">
                      {fmtMoney(l.unitPrice * l.qty)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Totals + Payment ──────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          <div className="border border-stone-200 rounded-md p-3 text-xs">
            <div className="text-[9px] uppercase tracking-wider text-stone-500 mb-2">
              Totals
            </div>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-stone-500">Items subtotal</span>
                <span className="tabular-nums">
                  {fmtMoney(itemsSubtotal)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Delivery fee</span>
                <span className="tabular-nums">
                  {fmtMoney(order.deliveryFee)}
                </span>
              </div>
              {order.discount > 0 && (
                <div className="flex justify-between text-red-700">
                  <span className="text-stone-500">Discount</span>
                  <span className="tabular-nums">−{fmtMoney(order.discount)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-stone-200 mt-1 pt-1 font-semibold text-stone-800">
                <span>Total</span>
                <span className="tabular-nums">{fmtMoney(orderTotal)}</span>
              </div>
            </div>
          </div>
          <div className="border border-stone-200 rounded-md p-3 text-xs">
            <div className="text-[9px] uppercase tracking-wider text-stone-500 mb-2">
              Payment
            </div>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-stone-500">Status</span>
                <span className="font-medium">{order.paymentStatus}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Method</span>
                <span>{order.paymentMethod ?? "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Amount</span>
                <span className="tabular-nums">
                  {fmtMoney(order.paymentAmount)}
                </span>
              </div>
              {order.paymentReference && (
                <div className="flex justify-between">
                  <span className="text-stone-500">Reference</span>
                  <span className="font-mono text-[10px]">
                    {order.paymentReference}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-stone-500">Confirmed at</span>
                <span>{fmtDateTime(order.paymentConfirmedAt)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Internal notes ───────────────────────────────────── */}
        {order.internalNotes && (
          <div className="border border-amber-200 bg-amber-50 rounded-md p-3 text-xs text-amber-900">
            <div className="text-[9px] uppercase tracking-wider text-amber-700 mb-1">
              Internal notes
            </div>
            {order.internalNotes}
          </div>
        )}

        {/* ── Linked execution logs ────────────────────────────── */}
        {order.executionLogs.length > 0 && (
          <div className="border border-stone-200 rounded-md p-3 text-xs">
            <div className="text-[9px] uppercase tracking-wider text-stone-500 mb-2">
              Execution logs ({order.executionLogs.length})
            </div>
            <div className="space-y-2">
              {order.executionLogs.map((log) => (
                <div
                  key={log.id}
                  className="border border-stone-100 rounded p-2 bg-stone-50"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono font-semibold text-stone-800">
                      {log.executionNumber}
                    </span>
                    <span className={`fmd-status ${log.status}`}>
                      {log.status}
                    </span>
                    <span className="text-stone-500 ml-auto">
                      {fmtDate(log.executedAt)} · actual{" "}
                      <span className="font-semibold">
                        {fmtMoney(log.actualCost)}
                      </span>
                    </span>
                  </div>
                  {log.lines.length > 0 && (
                    <div className="text-[10px] text-stone-600">
                      {log.lines
                        .slice(0, 5)
                        .map(
                          (l) =>
                            `${l.materialName} ×${l.qtyUsed}${l.unit} (${l.type})`
                        )
                        .join(" · ")}
                      {log.lines.length > 5 &&
                        ` +${log.lines.length - 5} more`}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Linked quote (only when passed) ──────────────────── */}
        {quote !== undefined && (
          <div className="border-2 border-rose-200 bg-rose-50/30 rounded-md p-3 text-xs">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[9px] uppercase tracking-wider text-rose-700 font-semibold">
                Linked Quote
              </span>
              {quote ? (
                <>
                  <span className="font-mono font-semibold text-rose-900">
                    {quote.quoteNumber}
                  </span>
                  <span className={`fmd-status ${quote.status}`}>
                    {QUOTE_STATUS_LABELS[quote.status] ?? quote.status}
                  </span>
                </>
              ) : (
                <span className="text-stone-500 italic">
                  No linked quote (order was created standalone, or quote was
                  deleted)
                </span>
              )}
            </div>
            {quote && (
              <>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div>
                    <span className="text-stone-500">Quoted:</span>{" "}
                    {fmtDate(quote.quoteDate)}
                  </div>
                  <div>
                    <span className="text-stone-500">Valid until:</span>{" "}
                    {fmtDate(quote.validUntil)}
                  </div>
                  {quote.eventType && (
                    <div>
                      <span className="text-stone-500">Event type:</span>{" "}
                      {quote.eventType}
                    </div>
                  )}
                  {quote.eventDate && (
                    <div>
                      <span className="text-stone-500">Event date:</span>{" "}
                      {fmtDate(quote.eventDate)}
                    </div>
                  )}
                  {quote.leadSource && (
                    <div>
                      <span className="text-stone-500">Lead source:</span>{" "}
                      {quote.leadSource}
                    </div>
                  )}
                  {quote.lostReason && (
                    <div className="text-red-700">
                      <span className="text-stone-500">Lost reason:</span>{" "}
                      {quote.lostReason}
                    </div>
                  )}
                </div>
                {quote.lines.length > 0 && (
                  <div className="border border-stone-200 rounded overflow-hidden bg-white">
                    <table className="w-full text-xs">
                      <thead className="bg-stone-50 text-stone-600">
                        <tr>
                          <th className="text-left px-2 py-1 font-medium">
                            Product
                          </th>
                          <th className="text-right px-2 py-1 font-medium w-12">
                            Qty
                          </th>
                          <th className="text-right px-2 py-1 font-medium w-20">
                            Unit $
                          </th>
                          <th className="text-right px-2 py-1 font-medium w-24">
                            Line $
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {quote.lines.map((l) => (
                          <tr
                            key={l.id}
                            className="border-t border-stone-100"
                          >
                            <td className="px-2 py-1">
                              <div className="font-medium text-stone-800">
                                {l.description}
                              </div>
                              {l.productSku && (
                                <div className="font-mono text-[10px] text-stone-500">
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
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <div className="bg-white border border-stone-200 rounded p-2 text-center">
                    <div className="text-[9px] uppercase tracking-wider text-stone-500">
                      Subtotal
                    </div>
                    <div className="font-bold text-stone-800">
                      {fmtMoney(quote.subtotal)}
                    </div>
                  </div>
                  <div className="bg-white border border-stone-200 rounded p-2 text-center">
                    <div className="text-[9px] uppercase tracking-wider text-stone-500">
                      IVA
                    </div>
                    <div className="font-bold text-stone-800">
                      {fmtMoney(quote.iva)}
                    </div>
                  </div>
                  <div className="bg-white border border-stone-200 rounded p-2 text-center">
                    <div className="text-[9px] uppercase tracking-wider text-stone-500">
                      Total
                    </div>
                    <div className="font-bold text-rose-900">
                      {fmtMoney(quote.total)}
                    </div>
                  </div>
                </div>
                <div className="mt-2 text-stone-600">
                  <span className="text-stone-500">Deposit required:</span>{" "}
                  <span className="font-semibold">
                    {fmtMoney(quote.depositRequired)}
                  </span>
                </div>
                {quote.notes && (
                  <div className="mt-2 p-2 bg-white border border-stone-200 rounded text-stone-700">
                    <div className="text-[9px] uppercase tracking-wider text-stone-500 mb-1">
                      Quote notes
                    </div>
                    {quote.notes}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
