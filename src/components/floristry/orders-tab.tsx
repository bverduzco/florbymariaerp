"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  ClipboardList,
  Truck,
  Loader2,
  ArrowLeft,
  Trash2,
  ChevronRight,
  CalendarClock,
  User,
  Package,
  DollarSign,
} from "lucide-react"
import { toast } from "sonner"
import { useNavStore } from "@/lib/nav-store"
import { OrderDetail } from "@/components/floristry/order-detail"

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

// Filter chips in canonical pipeline order
const STATUS_FILTERS: { key: string; label: string; color: string }[] = [
  { key: "all", label: "All", color: "bg-stone-100 text-stone-700" },
  { key: "draft", label: "Drafts", color: "bg-stone-100 text-stone-700" },
  { key: "quote_sent,awaiting_payment", label: "Awaiting payment", color: "bg-amber-100 text-amber-800" },
  { key: "payment_confirmed", label: "Ready to buy", color: "bg-emerald-100 text-emerald-800" },
  { key: "procuring,producing", label: "In production", color: "bg-blue-100 text-blue-800" },
  { key: "delivered", label: "Out for delivery", color: "bg-purple-100 text-purple-800" },
  { key: "fulfilled", label: "Fulfilled", color: "bg-stone-200 text-stone-700" },
  { key: "cancelled", label: "Cancelled", color: "bg-red-100 text-red-800" },
]

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

export function OrdersTab({ initialOrderId }: { initialOrderId?: string | null }) {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState("all")
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)

  // Read pendingOrderId from the shared nav store (set by Delivery View clicks)
  const pendingOrderId = useNavStore((s) => s.pendingOrderId)
  const setPendingOrderId = useNavStore((s) => s.setPendingOrderId)

  // Pick up orderId from either URL param (initialOrderId) or nav store (pendingOrderId)
  useEffect(() => {
    const id = initialOrderId || pendingOrderId
    if (id) {
      setSelectedOrderId(id)
      setPendingOrderId(null) // clear after consuming
    }
  }, [initialOrderId, pendingOrderId, setPendingOrderId])

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    try {
      const url = filter === "all"
        ? "/api/orders"
        : `/api/orders?status=${encodeURIComponent(filter)}`
      const res = await fetch(url, { cache: "no-store" })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setOrders(data.orders ?? [])
    } catch (e) {
      toast.error("Failed to load orders", {
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  // Compute counts for filter chips (must be before any early return — hooks order)
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: orders.length }
    for (const f of STATUS_FILTERS) {
      if (f.key === "all") continue
      const statuses = f.key.split(",")
      c[f.key] = orders.filter((o) => statuses.includes(o.status)).length
    }
    return c
  }, [orders])

  // Open detail view
  if (selectedOrderId) {
    const order = orders.find((o) => o.id === selectedOrderId)
    if (order) {
      return (
        <OrderDetail
          order={order}
          onBack={() => setSelectedOrderId(null)}
          onUpdated={(updated) => {
            setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)))
          }}
          onDeleted={() => {
            setOrders((prev) => prev.filter((o) => o.id !== order.id))
            setSelectedOrderId(null)
            toast.success(`Deleted order ${order.orderNumber}`)
          }}
        />
      )
    }
    // If orders haven't loaded yet, show loading instead of resetting
    if (loading) {
      return (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      )
    }
    // Orders loaded but order not found — clear selection
    setSelectedOrderId(null)
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="border-rose-200 bg-rose-50/40 p-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-rose-700" />
            <h2 className="text-lg font-semibold text-stone-800">Orders</h2>
            <Badge variant="outline" className="text-xs">{orders.length} total</Badge>
          </div>
        </div>

        {/* Filter chips */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                filter === f.key
                  ? `${f.color} border-transparent ring-2 ring-rose-300`
                  : "bg-white text-stone-600 border-stone-200 hover:bg-stone-50"
              }`}
            >
              {f.label}
              {counts[f.key] > 0 && (
                <span className="ml-1.5 text-[10px] opacity-70">({counts[f.key]})</span>
              )}
            </button>
          ))}
        </div>
      </Card>

      {/* Order list */}
      <Card className="bg-white p-4">
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-10">
            <ClipboardList className="h-10 w-10 mx-auto text-stone-300 mb-3" />
            <p className="text-stone-600 font-medium">No orders in this view</p>
            <p className="text-sm text-stone-400 mt-1">
              Go to the Order Intake tab to create a new order.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {orders.map((order) => (
              <OrderRow
                key={order.id}
                order={order}
                onClick={() => setSelectedOrderId(order.id)}
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

function OrderRow({ order, onClick }: { order: Order; onClick: () => void }) {
  const badge = STATUS_BADGES[order.status] ?? { label: order.status, className: "bg-stone-100" }
  const total = order.lineItems.reduce((s, li) => s + li.lineTotal, 0)
  const bouquets = order.lineItems.reduce((s, li) => s + li.qty, 0)

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-lg border border-stone-200 bg-white p-3 hover:border-rose-300 hover:shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-rose-300"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-stone-800">{order.orderNumber}</span>
            <Badge variant="outline" className={`text-[10px] ${badge.className}`}>{badge.label}</Badge>
          </div>
          <div className="mt-1 flex items-center gap-3 text-xs text-stone-600 flex-wrap">
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {order.customerName ?? "—"}
            </span>
            {order.deliveryDate && (
              <span className="flex items-center gap-1 text-rose-700">
                <CalendarClock className="h-3 w-3" />
                {new Date(order.deliveryDate + "T00:00:00").toLocaleDateString("es-MX", {
                  weekday: "short", day: "numeric", month: "short",
                })}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Package className="h-3 w-3" />
              {bouquets} bouquet{bouquets !== 1 ? "s" : ""}
            </span>
          </div>
          {/* Line item summary */}
          <div className="mt-2 text-xs text-stone-500">
            {order.lineItems.map((li, i) => (
              <span key={li.id}>
                {i > 0 && " · "}
                {li.productName}
                {li.productSize && ` (${li.productSize})`}
                <span className="text-rose-600"> ×{li.qty}</span>
              </span>
            ))}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-base font-bold text-stone-900">
            ${total.toLocaleString("es-MX")}
          </div>
          <div className="text-[10px] text-stone-500">pre-IVA</div>
          <ChevronRight className="h-4 w-4 text-stone-300 mt-1" />
        </div>
      </div>
    </button>
  )
}
