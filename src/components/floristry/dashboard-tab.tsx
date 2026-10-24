"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import {
  TrendingUp,
  Package,
  DollarSign,
  Clock,
  AlertTriangle,
  Truck,
  Users,
  ShoppingBag,
  Loader2,
  ClipboardCheck,
  ChevronDown,
  ChevronUp,
  X,
} from "lucide-react"

interface OrderSummary {
  id: string
  orderNumber: string
  status: string
  customerName: string | null
  deliveryDate: string | null
  lineItems: { productName: string; qty: number; unitPrice: number; lineTotal: number }[]
  paymentStatus: string
  paymentMethod: string | null
  createdAt: string
}

interface PurchaseOrder {
  id: string
  poNumber: string
  supplier: string
  status: string
  totalCost: number
  lineCount: number
  createdAt: string
  lines: {
    id: string
    materialSku: string
    materialName: string
    qtyPacks: number
    costPerPack: number
    lineTotal: number
  }[]
}

interface DashboardData {
  totalOrders: number
  pendingPayments: number
  pendingPaymentAmount: number
  totalRevenue: number
  totalCost: number
  upcomingDeliveries: number
  lowStockCount: number
  customerCount: number
  totalStockValue: number
  orders: OrderSummary[]
  purchaseOrders: PurchaseOrder[]
  poTotalCost: number
  poPending: number
}

const PO_STATUS_BADGES: Record<string, string> = {
  draft: "bg-stone-100 text-stone-600 border-stone-200",
  approved: "bg-indigo-100 text-indigo-700 border-indigo-200",
  pending: "bg-blue-100 text-blue-700 border-blue-200",
  procured: "bg-amber-100 text-amber-800 border-amber-200",
  received: "bg-emerald-100 text-emerald-700 border-emerald-200",
  cancelled: "bg-red-100 text-red-700 border-red-200",
}

// Ordered workflow: each step advances to the next status.
const PO_WORKFLOW: { key: string; label: string; next: string }[] = [
  { key: "draft", label: "Draft", next: "approved" },
  { key: "approved", label: "Approved", next: "pending" },
  { key: "pending", label: "Pending", next: "procured" },
  { key: "procured", label: "Procured", next: "received" },
  { key: "received", label: "Received", next: "" },
]

// Statuses considered "not yet received" (i.e. still incoming).
const PO_INCOMING_STATUSES = ["draft", "approved", "pending", "procured"]

export function DashboardTab() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [poExpanded, setPoExpanded] = useState(false)
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null)

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const [ordersRes, inventoryRes, customersRes, poRes] = await Promise.all([
          fetch("/api/orders", { cache: "no-store" }),
          fetch("/api/inventory", { cache: "no-store" }),
          fetch("/api/customers", { cache: "no-store" }),
          fetch("/api/purchase-orders", { cache: "no-store" }),
        ])

        const ordersData = await ordersRes.json()
        const inventoryData = await inventoryRes.json()
        const customersData = await customersRes.json()
        const poData = await poRes.json()

        const orders = ordersData.orders ?? []
        const materials = inventoryData.materials ?? []
        const customers = customersData.customers ?? []
        const purchaseOrders = poData.purchaseOrders ?? []

        const totalRevenue = orders.reduce((s: number, o: OrderSummary) =>
          s + o.lineItems.reduce((ls: number, li) => ls + li.lineTotal, 0), 0)
        const totalCost = orders.reduce((s: number, o: OrderSummary) =>
          s + o.lineItems.reduce((ls: number, li) => ls + li.unitPrice * 0.3, 0), 0)

        const pendingPayments = orders.filter((o: OrderSummary) =>
          o.paymentStatus === "pending" || o.paymentStatus === "not_started").length
        const pendingPaymentAmount = orders
          .filter((o: OrderSummary) => o.paymentStatus === "pending" || o.paymentStatus === "not_started")
          .reduce((s: number, o: OrderSummary) =>
            s + o.lineItems.reduce((ls: number, li) => ls + li.lineTotal, 0), 0)

        const today = new Date().toISOString().split("T")[0]
        const upcomingDeliveries = orders.filter((o: OrderSummary) =>
          o.deliveryDate && o.deliveryDate >= today).length

        const poTotalCost = purchaseOrders.reduce((s: number, po: PurchaseOrder) => s + po.totalCost, 0)
        const poPending = purchaseOrders.filter((po: PurchaseOrder) =>
          PO_INCOMING_STATUSES.includes(po.status)).length

        setData({
          totalOrders: orders.length,
          pendingPayments,
          pendingPaymentAmount,
          totalRevenue,
          totalCost,
          upcomingDeliveries,
          lowStockCount: inventoryData.lowStockCount ?? 0,
          customerCount: customers.length,
          totalStockValue: inventoryData.totalStockValue ?? 0,
          orders,
          purchaseOrders,
          poTotalCost,
          poPending,
        })
      } catch (e) {
        console.error("Dashboard fetch error:", e)
      } finally {
        setLoading(false)
      }
    }
    fetchDashboard()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-rose-600" />
      </div>
    )
  }

  if (!data) {
    return (
      <Card className="p-8 text-center text-stone-500">
        <p>Failed to load dashboard data</p>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <StatCard
          label="Total Orders"
          value={String(data.totalOrders)}
          icon={<Package className="h-4 w-4 text-stone-400" />}
        />
        <StatCard
          label="Revenue (pre-IVA)"
          value={`$${Math.round(data.totalRevenue).toLocaleString("es-MX")}`}
          icon={<DollarSign className="h-4 w-4 text-emerald-500" />}
          valueClassName="text-emerald-700"
        />
        <StatCard
          label="Pending Payments"
          value={String(data.pendingPayments)}
          sublabel={`$${Math.round(data.pendingPaymentAmount).toLocaleString("es-MX")} outstanding`}
          icon={<Clock className="h-4 w-4 text-amber-500" />}
          valueClassName={data.pendingPayments > 0 ? "text-amber-700" : ""}
        />
        <StatCard
          label="Upcoming Deliveries"
          value={String(data.upcomingDeliveries)}
          icon={<Truck className="h-4 w-4 text-blue-500" />}
        />
        <StatCard
          label="Customers"
          value={String(data.customerCount)}
          icon={<Users className="h-4 w-4 text-stone-400" />}
        />
        <StatCard
          label="Stock Value"
          value={`$${Math.round(data.totalStockValue).toLocaleString("es-MX")}`}
          icon={<ShoppingBag className="h-4 w-4 text-stone-400" />}
        />
        <StatCard
          label="Low Stock Items"
          value={String(data.lowStockCount)}
          icon={<AlertTriangle className="h-4 w-4 text-amber-500" />}
          valueClassName={data.lowStockCount > 0 ? "text-amber-700" : ""}
        />
        <StatCard
          label="Est. Profit"
          value={`$${Math.round(data.totalRevenue - data.totalCost).toLocaleString("es-MX")}`}
          icon={<TrendingUp className="h-4 w-4 text-emerald-500" />}
          valueClassName="text-emerald-700"
        />
      </div>

      {/* Recent orders */}
      <Card className="bg-white p-4">
        <h3 className="text-sm font-semibold text-stone-800 mb-3">Recent Orders</h3>
        {data.orders.length === 0 ? (
          <p className="text-sm text-stone-400 text-center py-4">No orders yet. Create one from the New Order tab.</p>
        ) : (
          <div className="space-y-1.5">
            {data.orders.slice(0, 5).map((o) => {
              const total = o.lineItems.reduce((s, li) => s + li.lineTotal, 0)
              return (
                <div
                  key={o.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-stone-200 px-3 py-2 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-stone-800">{o.orderNumber}</span>
                      <Badge
                        variant="outline"
                        className={`text-[10px] py-0 ${
                          o.status === "payment_confirmed" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                          o.status === "draft" ? "bg-stone-100 text-stone-600 border-stone-200" :
                          o.status === "delivered" || o.status === "fulfilled" ? "bg-purple-50 text-purple-700 border-purple-200" :
                          "bg-amber-50 text-amber-700 border-amber-200"
                        }`}
                      >
                        {o.status.replace(/_/g, " ")}
                      </Badge>
                    </div>
                    <div className="text-xs text-stone-500 mt-0.5">
                      {o.customerName ?? "—"}
                      {o.deliveryDate && ` · deliver ${new Date(o.deliveryDate + "T00:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short" })}`}
                    </div>
                  </div>
                  <div className="font-semibold text-stone-800 shrink-0">
                    ${total.toLocaleString("es-MX")}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* Purchase Orders */}
      <Card className="bg-white p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-emerald-600" />
            <h3 className="text-sm font-semibold text-stone-800">Purchase Orders</h3>
            <Badge variant="outline" className="text-[10px]">
              {data.purchaseOrders.length} total
            </Badge>
            {data.poPending > 0 && (
              <Badge className="text-[10px] bg-amber-100 text-amber-800 border border-amber-200">
                {data.poPending} pending
              </Badge>
            )}
            <span className="text-xs text-stone-500">
              ${Math.round(data.poTotalCost).toLocaleString("es-MX")} total
            </span>
          </div>
          {data.purchaseOrders.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPoExpanded(!poExpanded)}
              className="text-xs gap-1"
            >
              {poExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              {poExpanded ? "Hide" : "Show all"}
            </Button>
          )}
        </div>

        {data.purchaseOrders.length === 0 ? (
          <p className="text-sm text-stone-400 text-center py-4">
            No POs yet. Generate one from the Shopping List panel.
          </p>
        ) : (
          <div className="space-y-1.5">
            {(poExpanded ? data.purchaseOrders : data.purchaseOrders.slice(0, 3)).map((po) => (
              <button
                key={po.id}
                onClick={() => setSelectedPO(po)}
                className="w-full text-left flex items-center justify-between gap-2 rounded-md border border-stone-200 px-3 py-2 text-sm hover:border-emerald-300 hover:bg-emerald-50/30 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-stone-800">{po.poNumber}</span>
                    <Badge
                      variant="outline"
                      className={`text-[10px] py-0 ${PO_STATUS_BADGES[po.status] ?? ""}`}
                    >
                      {po.status}
                    </Badge>
                  </div>
                  <div className="text-xs text-stone-500 mt-0.5">
                    {po.supplier} · {po.lineCount} line{po.lineCount !== 1 ? "s" : ""}
                    {" · "}
                    {new Date(po.createdAt).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })}
                  </div>
                </div>
                <div className="font-semibold text-stone-800 shrink-0">
                  ${po.totalCost.toLocaleString("es-MX")}
                </div>
              </button>
            ))}
          </div>
        )}
      </Card>

      {/* PO detail dialog */}
      <Dialog open={!!selectedPO} onOpenChange={(o) => !o && setSelectedPO(null)}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedPO?.poNumber}
              {selectedPO && (
                <Badge
                  variant="outline"
                  className={`text-[10px] py-0 ${PO_STATUS_BADGES[selectedPO.status] ?? ""}`}
                >
                  {selectedPO.status}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          {selectedPO && (
            <div className="space-y-3">
              <div className="text-xs text-stone-500">
                <span className="font-medium text-stone-700">{selectedPO.supplier}</span>
                {" · "}
                {new Date(selectedPO.createdAt).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })}
              </div>

              {/* Line items */}
              <div className="space-y-1">
                <div className="text-[10px] uppercase tracking-wide text-stone-400 mb-1">Materials</div>
                {selectedPO.lines.map((l) => (
                  <div
                    key={l.id}
                    className="flex items-center justify-between gap-2 rounded-md border border-stone-200 px-2.5 py-1.5 text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-stone-800 truncate">{l.materialName}</div>
                      <div className="text-[10px] text-stone-400">{l.materialSku}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-stone-700">{l.qtyPacks} packs @ ${l.costPerPack}</div>
                      <div className="font-semibold text-stone-800">${l.lineTotal.toLocaleString("es-MX")}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Total */}
              <div className="flex items-center justify-between pt-2 border-t border-stone-200">
                <span className="font-semibold text-stone-800">Total</span>
                <span className="text-lg font-bold text-emerald-700">
                  ${selectedPO.totalCost.toLocaleString("es-MX")}
                </span>
              </div>

              {/* Status workflow */}
              <POStatusActions po={selectedPO} onUpdated={(updated) => setSelectedPO(updated)} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function StatCard({
  label,
  value,
  sublabel,
  icon,
  valueClassName = "",
}: {
  label: string
  value: string
  sublabel?: string
  icon?: React.ReactNode
  valueClassName?: string
}) {
  return (
    <div className="rounded-lg bg-white border border-stone-200 p-3">
      <div className="text-[10px] uppercase tracking-wide text-stone-500 flex items-center gap-1">
        {icon}
        {label}
      </div>
      <div className={`text-lg font-bold text-stone-800 mt-1 ${valueClassName}`}>{value}</div>
      {sublabel && <div className="text-[10px] text-stone-400 mt-0.5">{sublabel}</div>}
    </div>
  )
}

// Button labels for each "advance to next status" action.
const PO_ADVANCE_LABEL: Record<string, string> = {
  approved: "Approve",
  pending: "Mark as Pending",
  procured: "Mark as Procured",
  received: "Mark as Received",
}

const PO_NEXT_HINT: Record<string, string> = {
  draft: "Approve this PO to lock it in.",
  approved: "Mark as Pending when you've sent it to the supplier.",
  pending: "Mark as Procured when the supplier confirms the order.",
  procured: "Mark as Received when the flowers physically arrive — stock will be auto-updated.",
}

function POStatusActions({
  po,
  onUpdated,
}: {
  po: PurchaseOrder
  onUpdated: (updated: PurchaseOrder) => void
}) {
  const [updating, setUpdating] = useState(false)

  if (po.status === "received") {
    return (
      <div className="text-xs text-emerald-700 bg-emerald-50 rounded-md p-2.5 border border-emerald-200 flex items-start gap-2">
        <ClipboardCheck className="h-4 w-4 shrink-0 mt-0.5" />
        <div>
          <div className="font-medium">Received</div>
          <div className="mt-0.5">
            Stock levels were automatically updated when this PO was marked as received.
          </div>
        </div>
      </div>
    )
  }

  if (po.status === "cancelled") {
    return (
      <div className="text-xs text-red-700 bg-red-50 rounded-md p-2.5 border border-red-200">
        This PO was cancelled.
      </div>
    )
  }

  const step = PO_WORKFLOW.find((s) => s.key === po.status)
  const nextLabel = step?.next ? PO_ADVANCE_LABEL[step.next] : null

  async function advance(toStatus: string) {
    setUpdating(true)
    try {
      const res = await fetch(`/api/purchase-orders/${po.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: toStatus }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${res.status}`)
      }
      const data = await res.json()
      onUpdated(data.purchaseOrder)
      if (toStatus === "received") {
        toast.success(`${po.poNumber} received`, {
          description: "Stock levels have been updated automatically.",
        })
      } else {
        toast.success(`${po.poNumber} → ${toStatus}`)
      }
    } catch (e) {
      toast.error("Failed to update PO status", {
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setUpdating(false)
    }
  }

  return (
    <div className="space-y-2">
      {/* Status progression indicator */}
      <div className="flex items-center gap-1 text-[10px]">
        {PO_WORKFLOW.map((s, idx) => {
          const isActive = s.key === po.status
          const isPast =
            PO_WORKFLOW.findIndex((w) => w.key === po.status) > idx
          return (
            <div key={s.key} className="flex items-center">
              <div
                className={`px-2 py-0.5 rounded-full border ${
                  isActive
                    ? PO_STATUS_BADGES[s.key]
                    : isPast
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-stone-50 text-stone-400 border-stone-200"
                }`}
              >
                {s.label}
              </div>
              {idx < PO_WORKFLOW.length - 1 && (
                <span className="text-stone-300 mx-0.5">→</span>
              )}
            </div>
          )
        })}
      </div>

      {/* Hint */}
      {nextLabel && (
        <div className="text-xs text-stone-500 bg-stone-50 rounded-md p-2 border border-stone-200">
          {PO_NEXT_HINT[po.status]}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        {nextLabel && (
          <Button
            size="sm"
            onClick={() => advance(step!.next)}
            disabled={updating}
            className="gap-1.5 bg-rose-600 hover:bg-rose-700 text-white"
          >
            {updating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {nextLabel}
          </Button>
        )}
        {po.status !== "draft" && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => advance("received")}
            disabled={updating}
            className="gap-1.5 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
          >
            Skip to Received
          </Button>
        )}
        {po.status === "draft" && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => advance("cancelled")}
            disabled={updating}
            className="gap-1.5 border-red-200 text-red-600 hover:bg-red-50"
          >
            Cancel PO
          </Button>
        )}
      </div>
    </div>
  )
}
