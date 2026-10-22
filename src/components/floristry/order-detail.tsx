"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ArrowLeft,
  Trash2,
  Loader2,
  CalendarClock,
  User,
  Phone,
  Mail,
  MapPin,
  Package,
  Truck,
  DollarSign,
  CreditCard,
  CheckCircle2,
  ArrowRight,
  MessageCircle,
} from "lucide-react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog"

interface LineItem {
  id: string
  productSku: string
  productName: string
  productSize: string | null
  qty: number
  unitPrice: number
  lineTotal: number
}

interface Order {
  id: string
  orderNumber: string
  status: string
  customerId: string
  customerName: string | null
  customerPhone: string | null
  customerEmail: string | null
  customerAddress: string | null
  deliveryDate: string | null
  deliveryAddress: string | null
  cardMessage: string | null
  deliveryNotes: string | null
  internalNotes: string | null
  deliveryFee: number
  discount: number
  quoteSentAt: string | null
  quoteSentVia: string | null
  paymentMethod: string | null
  paymentOptionsSentAt: string | null
  paymentInstructionsSent: boolean
  paymentStatus: string
  paymentConfirmedAt: string | null
  paymentAmount: number | null
  paymentReference: string | null
  procurementStartedAt: string | null
  producedAt: string | null
  deliveredAt: string | null
  fulfilledAt: string | null
  cancelledAt: string | null
  lineItems: LineItem[]
  createdAt: string
  updatedAt: string
}

const PIPELINE_STAGES = [
  { key: "draft", label: "Draft", description: "Order captured, not sent to customer yet" },
  { key: "quote_sent", label: "Quote sent", description: "Customer received the order form" },
  { key: "awaiting_payment", label: "Awaiting payment", description: "Payment options shared, waiting" },
  { key: "payment_confirmed", label: "Payment confirmed", description: "🟢 Safe to buy stock" },
  { key: "procuring", label: "Procuring", description: "Buying materials from suppliers" },
  { key: "producing", label: "Producing", description: "Assembling the bouquet(s)" },
  { key: "delivered", label: "Delivered", description: "Out for delivery / delivered" },
  { key: "fulfilled", label: "Fulfilled", description: "Complete, archived" },
] as const

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-stone-100 text-stone-700 border-stone-200" },
  quote_sent: { label: "Quote sent", className: "bg-amber-100 text-amber-800 border-amber-200" },
  awaiting_payment: { label: "Awaiting payment", className: "bg-amber-100 text-amber-800 border-amber-200" },
  payment_confirmed: { label: "Payment confirmed", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  procuring: { label: "Procuring", className: "bg-blue-100 text-blue-800 border-blue-200" },
  producing: { label: "Producing", className: "bg-blue-100 text-blue-800 border-blue-200" },
  delivered: { label: "Delivered", className: "bg-purple-100 text-purple-800 border-purple-200" },
  fulfilled: { label: "Fulfilled", className: "bg-stone-200 text-stone-700 border-stone-300" },
  cancelled: { label: "Cancelled", className: "bg-red-100 text-red-800 border-red-200" },
}

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "spei", label: "SPEI (bank transfer)" },
  { value: "online_link", label: "Online link (Stripe/Mercado Pago)" },
  { value: "card", label: "Card (in-person terminal)" },
]

const QUOTE_VIAS = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "Email" },
  { value: "sms", label: "SMS" },
  { value: "in_person", label: "In person" },
]

export function OrderDetail({
  order,
  onBack,
  onUpdated,
  onDeleted,
}: {
  order: Order
  onBack: () => void
  onUpdated: (updated: Order) => void
  onDeleted: () => void
}) {
  const [advancing, setAdvancing] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Editable fields
  const [deliveryFee, setDeliveryFee] = useState(order.deliveryFee)
  const [discount, setDiscount] = useState(order.discount)
  const [paymentMethod, setPaymentMethod] = useState(order.paymentMethod ?? "")
  const [paymentReference, setPaymentReference] = useState(order.paymentReference ?? "")
  const [quoteSentVia, setQuoteSentVia] = useState(order.quoteSentVia ?? "whatsapp")

  // Subtotals
  const subtotal = order.lineItems.reduce((s, li) => s + li.lineTotal, 0)
  const iva = subtotal * 0.16
  const total = subtotal + iva + (deliveryFee || 0) - (discount || 0)

  // Find current pipeline stage
  const currentStageIdx = PIPELINE_STAGES.findIndex((s) => s.key === order.status)
  const isCancelled = order.status === "cancelled"
  const isFulfilled = order.status === "fulfilled"

  async function advancePipeline() {
    setAdvancing(true)
    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          advancePipeline: true,
          quoteSentVia: quoteSentVia || undefined,
          paymentMethod: paymentMethod || undefined,
          paymentReference: paymentReference || undefined,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${res.status}`)
      }
      const data = await res.json()
      onUpdated(data.order)
      toast.success(`Advanced to: ${STATUS_BADGES[data.order.status]?.label ?? data.order.status}`)
    } catch (e) {
      toast.error("Failed to advance", { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setAdvancing(false)
    }
  }

  async function cancelOrder() {
    setCancelling(true)
    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cancel: true }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${res.status}`)
      }
      const data = await res.json()
      onUpdated(data.order)
      toast.success(`Order ${order.orderNumber} cancelled`)
    } catch (e) {
      toast.error("Failed to cancel", { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setCancelling(false)
    }
  }

  async function savePaymentDetails() {
    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deliveryFee: deliveryFee ?? 0,
          discount: discount ?? 0,
          paymentMethod: paymentMethod || null,
          paymentReference: paymentReference || null,
          quoteSentVia: quoteSentVia || null,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${res.status}`)
      }
      const data = await res.json()
      onUpdated(data.order)
      toast.success("Saved payment details")
    } catch (e) {
      toast.error("Failed to save", { description: e instanceof Error ? e.message : String(e) })
    }
  }

  async function markQuoteSent() {
    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "quote_sent", quoteSentVia: quoteSentVia || "whatsapp" }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      onUpdated(data.order)
      toast.success("Marked quote as sent")
    } catch (e) {
      toast.error("Failed", { description: e instanceof Error ? e.message : String(e) })
    }
  }

  async function markPaymentOptionsSent() {
    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "awaiting_payment",
          paymentOptionsSentAt: new Date().toISOString(),
          paymentMethod: paymentMethod || null,
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      onUpdated(data.order)
      toast.success("Marked payment options as sent")
    } catch (e) {
      toast.error("Failed", { description: e instanceof Error ? e.message : String(e) })
    }
  }

  async function markPaymentConfirmed() {
    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "payment_confirmed",
          paymentStatus: "confirmed",
          paymentConfirmedAt: new Date().toISOString(),
          paymentMethod: paymentMethod || null,
          paymentReference: paymentReference || null,
          paymentAmount: total,
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      onUpdated(data.order)
      toast.success("✅ Payment confirmed — safe to buy stock")
    } catch (e) {
      toast.error("Failed", { description: e instanceof Error ? e.message : String(e) })
    }
  }

  async function deleteOrder() {
    setDeleting(true)
    try {
      const res = await fetch(`/api/orders/${order.id}`, { method: "DELETE" })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${res.status}`)
      }
      onDeleted()
    } catch (e) {
      toast.error("Failed to delete", { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setDeleting(false)
    }
  }

  const badge = STATUS_BADGES[order.status] ?? { label: order.status, className: "bg-stone-100" }

  return (
    <div className="space-y-4">
      {/* Top bar: back + actions */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" />
          Back to orders
        </Button>
        <div className="flex items-center gap-2">
          {!isCancelled && !isFulfilled && (
            <Button
              variant="outline"
              size="sm"
              onClick={cancelOrder}
              disabled={cancelling}
              className="text-amber-700 hover:bg-amber-50"
            >
              {cancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Cancel order
            </Button>
          )}
          <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-rose-700 hover:bg-rose-50">
                <Trash2 className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Delete order?</DialogTitle>
                <DialogDescription>
                  This permanently deletes {order.orderNumber} and its line items.
                  This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={deleteOrder}
                  disabled={deleting}
                  className="gap-1.5"
                >
                  {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Delete permanently
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Order header */}
      <Card className="border-rose-200 bg-rose-50/40 p-5">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold text-stone-800">{order.orderNumber}</h2>
              <Badge variant="outline" className={badge.className}>{badge.label}</Badge>
            </div>
            <p className="text-xs text-stone-500 mt-0.5">
              Created {new Date(order.createdAt).toLocaleString("es-MX")}
            </p>
          </div>
          {order.deliveryDate && (
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wide text-stone-500">Delivery date</div>
              <div className="text-sm font-semibold text-rose-700 flex items-center gap-1.5 justify-end">
                <CalendarClock className="h-4 w-4" />
                {new Date(order.deliveryDate + "T00:00:00").toLocaleDateString("es-MX", {
                  weekday: "long", day: "numeric", month: "long", year: "numeric",
                })}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Sales pipeline visualization */}
      {!isCancelled && (
        <Card className="bg-white p-4">
          <h3 className="text-sm font-semibold text-stone-800 mb-3">Sales pipeline</h3>
          <div className="flex items-center gap-1 overflow-x-auto pb-2">
            {PIPELINE_STAGES.map((stage, i) => {
              const isPast = i < currentStageIdx
              const isCurrent = i === currentStageIdx
              const isFuture = i > currentStageIdx
              return (
                <div key={stage.key} className="flex items-center shrink-0">
                  <div
                    className={`flex flex-col items-center text-center px-2 py-1.5 rounded-md transition-colors ${
                      isCurrent
                        ? "bg-rose-100 ring-2 ring-rose-300"
                        : isPast
                          ? "bg-emerald-50 text-emerald-800"
                          : "bg-stone-50 text-stone-400"
                    }`}
                    title={stage.description}
                  >
                    <div className="text-[10px] font-medium">{stage.label}</div>
                    {isPast && <CheckCircle2 className="h-3 w-3 mt-0.5" />}
                    {isCurrent && <div className="text-[9px] mt-0.5">you are here</div>}
                  </div>
                  {i < PIPELINE_STAGES.length - 1 && (
                    <ArrowRight className="h-3 w-3 text-stone-300 mx-0.5" />
                  )}
                </div>
              )
            })}
          </div>

          {/* Big action button: advance pipeline */}
          {!isFulfilled && (
            <div className="mt-3 pt-3 border-t border-stone-200">
              <Button
                onClick={advancePipeline}
                disabled={advancing}
                className="w-full bg-rose-600 hover:bg-rose-700 text-white gap-2"
              >
                {advancing && <Loader2 className="h-4 w-4 animate-spin" />}
                Advance to next stage
                {!advancing && <ArrowRight className="h-4 w-4" />}
              </Button>
              <p className="text-[10px] text-stone-500 text-center mt-1.5">
                Or use the specific buttons below for payment milestones
              </p>
            </div>
          )}
        </Card>
      )}

      {/* Customer info */}
      <Card className="bg-white p-4">
        <h3 className="text-sm font-semibold text-stone-800 mb-3 flex items-center gap-1.5">
          <User className="h-4 w-4 text-stone-400" />
          Customer
        </h3>
        <div className="grid sm:grid-cols-2 gap-3 text-sm">
          <div>
            <div className="font-medium text-stone-800">{order.customerName ?? "—"}</div>
          </div>
          {order.customerPhone && (
            <div className="flex items-center gap-1.5 text-stone-600">
              <Phone className="h-3 w-3 text-stone-400" />
              {order.customerPhone}
            </div>
          )}
          {order.customerEmail && (
            <div className="flex items-center gap-1.5 text-stone-600">
              <Mail className="h-3 w-3 text-stone-400" />
              {order.customerEmail}
            </div>
          )}
          {(order.deliveryAddress ?? order.customerAddress) && (
            <div className="flex items-start gap-1.5 text-stone-600 sm:col-span-2">
              <MapPin className="h-3 w-3 text-stone-400 mt-0.5" />
              {order.deliveryAddress ?? order.customerAddress}
            </div>
          )}
        </div>
      </Card>

      {/* Line items */}
      <Card className="bg-white p-4">
        <h3 className="text-sm font-semibold text-stone-800 mb-3 flex items-center gap-1.5">
          <Package className="h-4 w-4 text-stone-400" />
          Line items ({order.lineItems.length})
        </h3>
        <div className="space-y-1.5">
          {order.lineItems.map((li) => (
            <div
              key={li.id}
              className="flex justify-between items-start gap-2 rounded-md border border-stone-200 px-3 py-2 text-sm"
            >
              <div className="min-w-0 flex-1">
                <div className="font-medium text-stone-800">
                  {li.productName}
                  {li.productSize && (
                    <Badge variant="outline" className="ml-1.5 text-[10px] py-0">{li.productSize}</Badge>
                  )}
                </div>
                <div className="text-xs text-stone-500">×{li.qty} @ ${li.unitPrice.toLocaleString("es-MX")}</div>
              </div>
              <div className="font-semibold text-stone-900 shrink-0">
                ${li.lineTotal.toLocaleString("es-MX")}
              </div>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="mt-3 pt-3 border-t border-stone-200 space-y-1 text-sm">
          <div className="flex justify-between text-stone-600">
            <span>Subtotal (pre-IVA)</span>
            <span className="font-medium">${subtotal.toLocaleString("es-MX")}</span>
          </div>
          <div className="flex justify-between text-stone-600">
            <span>IVA (16%)</span>
            <span className="font-medium">${Math.round(iva).toLocaleString("es-MX")}</span>
          </div>
          <div className="flex justify-between text-stone-600">
            <span>Delivery fee</span>
            <span className="font-medium">${(deliveryFee || 0).toLocaleString("es-MX")}</span>
          </div>
          <div className="flex justify-between text-stone-600">
            <span>Discount</span>
            <span className="font-medium text-rose-700">−${(discount || 0).toLocaleString("es-MX")}</span>
          </div>
          <div className="flex justify-between pt-1.5 border-t border-stone-200">
            <span className="font-semibold text-stone-800">Total due</span>
            <span className="text-lg font-bold text-stone-900">
              ${Math.round(total).toLocaleString("es-MX")}
            </span>
          </div>
        </div>
      </Card>

      {/* Payment panel */}
      {!isCancelled && (
        <Card className="bg-white p-4">
          <h3 className="text-sm font-semibold text-stone-800 mb-3 flex items-center gap-1.5">
            <CreditCard className="h-4 w-4 text-stone-400" />
            Payment
          </h3>

          <div className="space-y-3">
            {/* Payment status banner */}
            <div className={`rounded-md p-2.5 text-xs ${
              order.paymentStatus === "confirmed"
                ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                : order.paymentStatus === "pending"
                  ? "bg-amber-50 border border-amber-200 text-amber-800"
                  : "bg-stone-50 border border-stone-200 text-stone-600"
            }`}>
              {order.paymentStatus === "confirmed" ? (
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Payment confirmed
                  {order.paymentConfirmedAt && (
                    <span className="opacity-70">
                      · {new Date(order.paymentConfirmedAt).toLocaleDateString("es-MX")}
                    </span>
                  )}
                </div>
              ) : order.paymentStatus === "pending" ? (
                <div>⏳ Payment pending — DO NOT buy stock yet</div>
              ) : (
                <div>No payment activity yet</div>
              )}
            </div>

            {/* Method + reference + via */}
            <div className="grid sm:grid-cols-2 gap-2">
              <div>
                <Label htmlFor="method" className="text-xs">Payment method</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger id="method"><SelectValue placeholder="Select method" /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="via" className="text-xs">Quote sent via</Label>
                <Select value={quoteSentVia} onValueChange={setQuoteSentVia}>
                  <SelectTrigger id="via"><SelectValue placeholder="Select channel" /></SelectTrigger>
                  <SelectContent>
                    {QUOTE_VIAS.map((v) => (
                      <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="ref" className="text-xs">Payment reference (SPEI #, charge ID, etc.)</Label>
                <Input
                  id="ref"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  placeholder="e.g. SPEI-12345 or ch_3abc..."
                />
              </div>
              <div>
                <Label htmlFor="fee" className="text-xs">Delivery fee (MXN)</Label>
                <Input
                  id="fee"
                  type="number"
                  value={deliveryFee}
                  onChange={(e) => setDeliveryFee(parseFloat(e.target.value) || 0)}
                />
              </div>
              <div>
                <Label htmlFor="disc" className="text-xs">Discount (MXN)</Label>
                <Input
                  id="disc"
                  type="number"
                  value={discount}
                  onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>

            <Button variant="outline" size="sm" onClick={savePaymentDetails} className="w-full">
              Save payment details
            </Button>

            {/* Quick-action buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-stone-200">
              {order.status === "draft" && (
                <Button variant="outline" size="sm" onClick={markQuoteSent} className="gap-1.5">
                  <MessageCircle className="h-3.5 w-3.5" />
                  Mark quote sent
                </Button>
              )}
              {(order.status === "quote_sent" || order.status === "draft") && (
                <Button variant="outline" size="sm" onClick={markPaymentOptionsSent} className="gap-1.5">
                  <CreditCard className="h-3.5 w-3.5" />
                  Sent payment options
                </Button>
              )}
              {(order.status === "quote_sent" || order.status === "awaiting_payment") && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={markPaymentConfirmed}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 sm:col-span-1"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Mark payment confirmed
                </Button>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Notes */}
      <Card className="bg-white p-4">
        <h3 className="text-sm font-semibold text-stone-800 mb-3 flex items-center gap-1.5">
          <MessageCircle className="h-4 w-4 text-stone-400" />
          Notes
        </h3>
        <div className="space-y-2 text-sm">
          {order.cardMessage && (
            <div>
              <div className="text-[10px] uppercase tracking-wide text-rose-600">Card message</div>
              <div className="rounded-md bg-rose-50 border border-rose-100 px-3 py-1.5 italic">
                &ldquo;{order.cardMessage}&rdquo;
              </div>
            </div>
          )}
          {order.deliveryNotes && (
            <div>
              <div className="text-[10px] uppercase tracking-wide text-stone-500 flex items-center gap-1">
                <Truck className="h-3 w-3" /> Delivery notes
              </div>
              <div className="rounded-md bg-stone-50 border border-stone-200 px-3 py-1.5">
                {order.deliveryNotes}
              </div>
            </div>
          )}
          {order.internalNotes && (
            <div>
              <div className="text-[10px] uppercase tracking-wide text-amber-700">Internal notes</div>
              <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-1.5 text-amber-900">
                {order.internalNotes}
              </div>
            </div>
          )}
          {!order.cardMessage && !order.deliveryNotes && !order.internalNotes && (
            <p className="text-xs text-stone-400 italic">No notes on this order.</p>
          )}
        </div>
      </Card>
    </div>
  )
}
