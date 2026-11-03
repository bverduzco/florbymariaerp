// src/app/quotes/[id]/page.tsx
//
// Quote detail page — shows full quote with line items, deposit, status timeline.
// Accessible by clicking a quote number from /quotes (once links are wired).

export const dynamic = "force-dynamic"

import { db as prisma } from "@/lib/db"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { StatusDropdown } from "@/components/status-dropdown"
import { QuotePdfButton } from "@/components/quote-pdf-button"
import { QuoteMessageButton } from "@/components/quote-message-button"
import { ConvertToOrderButton } from "@/components/convert-to-order-button"
import { DeleteQuoteButton } from "@/components/delete-quote-button"
import { QuoteRemindersSection } from "@/components/quote-reminders-section"
import { DiscountSection } from "@/components/discount-section"
import { ManageQuoteLines } from "./manage-quote-lines"
import { lookupPaymentRule } from "@/lib/payment-rules"
import { notFound } from "next/navigation"
import Link from "next/link"

async function getQuote(id: string) {
  return prisma.quote.findUnique({
    where: { id },
    include: {
      customer: { select: { id: true, name: true, phone: true, email: true, address: true } },
      order: { select: { id: true, orderNumber: true, status: true } },
      lines: {
        orderBy: { lineNumber: "asc" },
        include: {
          product: { select: { sku: true, name: true, cloudinaryPublicId: true } },
        },
      },
      reminders: {
        orderBy: { remindAt: "asc" },
      },
    },
  })
}

export default async function QuoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const quote = await getQuote(id)

  if (!quote) notFound()

  const depositPaid = quote.depositRequired ?? 0
  const balanceDue = quote.total - depositPaid
  const ruleInfo = lookupPaymentRule(quote.paymentRule)
  const isOverride = quote.paymentRule === "event_declined_too_close"
  const isLegacy = !quote.paymentRule
  // Compute discount amount for display
  const discountAmount = quote.discountType === "percentage"
    ? quote.subtotal * (quote.discount / 100)
    : quote.discount
  const effectiveSubtotal = Math.max(0, quote.subtotal - discountAmount)
  const deliveryFee = quote.deliveryFee ?? 100

  return (
    <main className="min-h-screen bg-stone-50 px-6 py-10">
      <div className="mx-auto max-w-4xl">
        {/* Breadcrumb */}
        <div className="mb-4 text-sm">
          <Link href="/quotes" className="text-stone-500 hover:text-stone-900 underline">
            ← Back to Quotes
          </Link>
        </div>

        {/* Header */}
        <header className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold text-stone-900">{quote.quoteNumber}</h1>
            <StatusDropdown
              entityId={quote.id}
              currentStatus={quote.status}
              statuses={[
                { value: "draft", label: "Draft" },
                { value: "sent", label: "Sent" },
                { value: "viewed", label: "Viewed" },
                { value: "negotiating", label: "Negotiating" },
                { value: "accepted", label: "Accepted" },
                { value: "declined", label: "Declined" },
                { value: "expired", label: "Expired" },
              ]}
              apiPath="/api/quotes/{id}"
            />
          </div>
          <div className="text-sm text-stone-600">
            {quote.customerName ?? "No customer linked"}
            {quote.customer?.phone && <span className="ml-2 text-stone-500">· {quote.customer.phone}</span>}
          </div>

          {/* Customer-facing actions */}
          <div className="flex flex-wrap items-center gap-2 mt-4">
            <QuotePdfButton quoteId={quote.id} variant="button" />
            <QuoteMessageButton quoteId={quote.id} variant="button" />
            <ConvertToOrderButton
              quoteId={quote.id}
              alreadyLinkedOrderId={quote.order?.id ?? null}
              alreadyLinkedOrderNumber={quote.order?.orderNumber ?? null}
            />
            <DeleteQuoteButton quoteId={quote.id} quoteNumber={quote.quoteNumber} hasOrder={!!quote.orderId} />
          </div>
        </header>

        {/* Quote meta grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <MetaCard label="Quote date" value={quote.quoteDate.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })} />
          <MetaCard label="Event date" value={quote.eventDate ? quote.eventDate.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" }) : "—"} />
          <MetaCard label="Valid until" value={quote.validUntil ? quote.validUntil.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" }) : "—"} />
          <MetaCard label="Event type" value={quote.eventType ?? "—"} className="capitalize" />
        </div>

        {/* Line items */}
        <Card className="mb-6 border-stone-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Line Items ({quote.lines.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {quote.lines.length === 0 ? (
              <div className="py-8 text-center text-stone-400 text-sm">
                No line items. Add products from the{" "}
                <Link href="/catalogue" className="text-stone-600 underline">Catalogue</Link>.
              </div>
            ) : (
              <>
                {/* ── Desktop: table view ───────────────────────── */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-stone-200 text-stone-600 text-xs uppercase tracking-wider">
                        <th className="text-left py-2 px-3">#</th>
                        <th className="text-left py-2 px-3">Description</th>
                        <th className="text-left py-2 px-3">Product</th>
                        <th className="text-right py-2 px-3">Qty</th>
                        <th className="text-right py-2 px-3">Unit price</th>
                        <th className="text-right py-2 px-3">Line total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {quote.lines.map((line) => (
                        <tr key={line.id} className="border-b border-stone-100 hover:bg-stone-50">
                          <td className="py-3 px-3 text-stone-400 text-xs">{line.lineNumber}</td>
                          <td className="py-3 px-3">
                            <div className="font-medium text-stone-900">{line.description}</div>
                            {line.notes && <div className="text-xs text-stone-500 mt-0.5">{line.notes}</div>}
                          </td>
                          <td className="py-3 px-3">
                            {line.productSku ? (
                              <span className="font-mono text-xs text-stone-500">{line.productSku}</span>
                            ) : (
                              <span className="text-stone-400 text-xs">custom</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right">{line.qty}</td>
                          <td className="py-3 px-3 text-right text-stone-700">
                            ${line.unitPrice.toLocaleString("es-MX", { maximumFractionDigits: 2 })}
                          </td>
                          <td className="py-3 px-3 text-right font-medium">
                            ${line.lineTotal.toLocaleString("es-MX", { maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-stone-300">
                        <td colSpan={5} className="py-3 px-3 text-right text-stone-600 text-xs uppercase tracking-wider">
                          Subtotal (before IVA):
                        </td>
                        <td className="py-3 px-3 text-right font-bold">
                          ${quote.subtotal.toLocaleString("es-MX", { maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                      {discountAmount > 0 && (
                        <tr>
                          <td colSpan={5} className="py-1 px-3 text-right text-rose-600 text-xs">
                            Discount ({quote.discountType === "percentage" ? `${quote.discount}%` : "flat"}):
                          </td>
                          <td className="py-1 px-3 text-right text-rose-700">
                            −${discountAmount.toLocaleString("es-MX", { maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      )}
                      {deliveryFee > 0 && (
                        <tr>
                          <td colSpan={5} className="py-1 px-3 text-right text-stone-500 text-xs">
                            🚚 Delivery:
                          </td>
                          <td className="py-1 px-3 text-right text-stone-700">
                            ${deliveryFee.toLocaleString("es-MX", { maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      )}
                      <tr>
                        <td colSpan={5} className="py-1 px-3 text-right text-stone-500 text-xs">
                          IVA (16%):
                        </td>
                        <td className="py-1 px-3 text-right text-stone-700">
                          ${quote.iva.toLocaleString("es-MX", { maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                      <tr className="border-t border-stone-200">
                        <td colSpan={5} className="py-3 px-3 text-right text-stone-900 font-bold">
                          Total:
                        </td>
                        <td className="py-3 px-3 text-right text-lg font-bold text-stone-900">
                          ${quote.total.toLocaleString("es-MX", { maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

                {/* ── Mobile: stacked card view ──────────────────── */}
                <div className="sm:hidden space-y-2">
                  {quote.lines.map((line) => (
                    <div
                      key={line.id}
                      className="border border-stone-200 rounded-lg p-3 bg-stone-50"
                    >
                      {/* Top: line number + description */}
                      <div className="flex items-start gap-2">
                        <span className="text-stone-400 text-xs font-mono">{line.lineNumber}.</span>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-stone-900 text-sm">{line.description}</div>
                          {line.productSku && (
                            <span className="font-mono text-xs text-stone-500">{line.productSku}</span>
                          )}
                          {line.notes && (
                            <div className="text-xs text-stone-500 mt-0.5">{line.notes}</div>
                          )}
                        </div>
                      </div>
                      {/* Bottom: qty × unit price = line total */}
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-stone-200">
                        <span className="text-xs text-stone-600">
                          {line.qty} × ${line.unitPrice.toLocaleString("es-MX", { maximumFractionDigits: 2 })}
                        </span>
                        <span className="text-sm font-semibold text-stone-900">
                          ${line.lineTotal.toLocaleString("es-MX", { maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  ))}
                  {/* Totals (mobile) */}
                  <div className="border-t-2 border-stone-300 pt-3 mt-3 space-y-1">
                    <div className="flex justify-between text-xs text-stone-600">
                      <span>Subtotal (before IVA)</span>
                      <span className="font-semibold">${quote.subtotal.toLocaleString("es-MX", { maximumFractionDigits: 2 })}</span>
                    </div>
                    {discountAmount > 0 && (
                      <div className="flex justify-between text-xs text-rose-600">
                        <span>Discount ({quote.discountType === "percentage" ? `${quote.discount}%` : "flat"})</span>
                        <span>−${discountAmount.toLocaleString("es-MX", { maximumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    {deliveryFee > 0 && (
                      <div className="flex justify-between text-xs text-stone-500">
                        <span>🚚 Delivery</span>
                        <span>${deliveryFee.toLocaleString("es-MX", { maximumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-xs text-stone-500">
                      <span>IVA (16%)</span>
                      <span>${quote.iva.toLocaleString("es-MX", { maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold text-stone-900 pt-1 border-t border-stone-200">
                      <span>Total</span>
                      <span>${quote.total.toLocaleString("es-MX", { maximumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </div>
              </>
            )}
            <ManageQuoteLines
              quoteId={quote.id}
              lines={quote.lines.map((l) => ({
                id: l.id,
                lineNumber: l.lineNumber,
                description: l.description,
                productSku: l.productSku,
                qty: l.qty,
                unitPrice: l.unitPrice,
                lineTotal: l.lineTotal,
                notes: l.notes,
              }))}
            />
          </CardContent>
        </Card>

        {/* Discount */}
        <DiscountSection
          quoteId={quote.id}
          discount={quote.discount}
          discountType={quote.discountType}
          subtotal={quote.subtotal}
        />

        {/* Payment terms banner — customer-facing rule explanation */}
        <Card className={`mb-4 ${isOverride ? "border-amber-300 bg-amber-50" : "border-stone-200"}`}>
          <CardContent className="pt-5">
            <div className="flex items-start gap-3">
              <div className="text-2xl">
                {isOverride ? "⚠️" : isLegacy ? "📜" : "💰"}
              </div>
              <div className="flex-1">
                <div className="text-xs uppercase tracking-wider text-stone-500">
                  Payment rule applied
                </div>
                <div className={`text-sm font-semibold mt-0.5 ${isOverride ? "text-amber-900" : "text-stone-900"}`}>
                  {ruleInfo.label}
                </div>
                {isOverride && (
                  <div className="text-xs text-amber-800 mt-1">
                    ⚠ This quote was created with an override — the event date was
                    less than 2 weeks away when the quote was made. Check the
                    notes for the override audit log.
                  </div>
                )}
                {isLegacy && (
                  <div className="text-xs text-stone-500 mt-1">
                    Legacy quote — payment rule was not recorded at creation.
                    Deposit shown below assumes 50%.
                  </div>
                )}
                <div className="text-xs text-stone-500 mt-1">
                  Stored rule:{" "}
                  <code className="px-1 py-0.5 bg-stone-100 rounded text-stone-700">
                    {quote.paymentRule ?? "(null — legacy)"}
                  </code>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payment summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <Card className="border-emerald-200 bg-emerald-50/50">
            <CardContent className="pt-5">
              <div className="text-xs uppercase tracking-wider text-stone-500">
                {ruleInfo.shortLabel}
              </div>
              <div className="text-2xl font-bold text-emerald-700 mt-1">
                ${depositPaid.toLocaleString("es-MX", { maximumFractionDigits: 0 })}
              </div>
              {ruleInfo.depositPct < 1.0 && (
                <div className="text-[10px] text-stone-500 mt-0.5">
                  ({Math.round(ruleInfo.depositPct * 100)}% of total)
                </div>
              )}
            </CardContent>
          </Card>
          <Card className="border-stone-200">
            <CardContent className="pt-5">
              <div className="text-xs uppercase tracking-wider text-stone-500">Balance due</div>
              <div className="text-2xl font-bold text-stone-900 mt-1">
                ${balanceDue.toLocaleString("es-MX", { maximumFractionDigits: 0 })}
              </div>
              {ruleInfo.depositPct < 1.0 ? (
                <div className="text-[10px] text-stone-500 mt-0.5">
                  (on delivery / pickup)
                </div>
              ) : (
                <div className="text-[10px] text-stone-500 mt-0.5">
                  (paid in full upfront — COD)
                </div>
              )}
            </CardContent>
          </Card>
          <Card className="border-stone-200">
            <CardContent className="pt-5">
              <div className="text-xs uppercase tracking-wider text-stone-500">Linked order</div>
              <div className="text-lg font-bold text-stone-900 mt-1">
                {quote.order ? (
                  <Link
                    href={`/orders?highlight=${quote.order.id}`}
                    className="font-mono hover:text-rose-700 hover:underline transition"
                    title={`View ${quote.order.orderNumber} on Orders tab (status: ${quote.order.status})`}
                  >
                    {quote.order.orderNumber}
                  </Link>
                ) : quote.linkedOrderId ? (
                  <span
                    className="text-amber-700 font-semibold"
                    title={`Legacy ref: ${quote.linkedOrderId} (no matching Order — possibly deleted)`}
                  >
                    ⚠ {quote.linkedOrderId}
                    <span className="block text-xs font-normal text-amber-600 mt-1">
                      (orphan — order not found)
                    </span>
                  </span>
                ) : (
                  <span className="text-stone-400">None yet</span>
                )}
              </div>
              {quote.order && (
                <div className="mt-1">
                  <Badge variant="outline" className="text-xs">
                    {quote.order.status.replace(/_/g, " ")}
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Notes */}
        {quote.notes && (
          <Card className="border-stone-200">
            <CardContent className="pt-5">
              <div className="text-xs uppercase tracking-wider text-stone-500 mb-2">Notes</div>
              <div className="text-sm text-stone-700">{quote.notes}</div>
            </CardContent>
          </Card>
        )}

        {/* Reminders */}
        <QuoteRemindersSection
          quoteId={quote.id}
          reminders={quote.reminders.map((r) => ({
            id: r.id,
            remindAt: r.remindAt.toISOString(),
            note: r.note,
            done: r.done,
            createdAt: r.createdAt.toISOString(),
          }))}
        />

        {/* Lost reason (if declined) */}
        {quote.status === "declined" && quote.lostReason && (
          <Card className="mt-4 border-red-200 bg-red-50/50">
            <CardContent className="pt-5">
              <div className="text-xs uppercase tracking-wider text-red-600 mb-1">Lost reason</div>
              <div className="text-sm font-medium text-red-700">{quote.lostReason.replace(/_/g, " ")}</div>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  )
}

function MetaCard({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return (
    <Card className="border-stone-200">
      <CardContent className="pt-4 pb-4">
        <div className="text-xs uppercase tracking-wider text-stone-500">{label}</div>
        <div className={`text-sm font-medium text-stone-900 mt-1 ${className}`}>{value}</div>
      </CardContent>
    </Card>
  )
}
