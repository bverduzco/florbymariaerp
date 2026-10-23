"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
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
}

export function DashboardTab() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const [ordersRes, inventoryRes, customersRes] = await Promise.all([
          fetch("/api/orders", { cache: "no-store" }),
          fetch("/api/inventory", { cache: "no-store" }),
          fetch("/api/customers", { cache: "no-store" }),
        ])

        const ordersData = await ordersRes.json()
        const inventoryData = await inventoryRes.json()
        const customersData = await customersRes.json()

        const orders = ordersData.orders ?? []
        const materials = inventoryData.materials ?? []
        const customers = customersData.customers ?? []

        // Compute stats
        const totalRevenue = orders.reduce((s: number, o: OrderSummary) =>
          s + o.lineItems.reduce((ls: number, li) => ls + li.lineTotal, 0), 0)
        const totalCost = orders.reduce((s: number, o: OrderSummary) =>
          s + o.lineItems.reduce((ls: number, li) => ls + li.unitPrice * 0.3, 0), 0) // rough estimate

        const pendingPayments = orders.filter((o: OrderSummary) =>
          o.paymentStatus === "pending" || o.paymentStatus === "not_started").length
        const pendingPaymentAmount = orders
          .filter((o: OrderSummary) => o.paymentStatus === "pending" || o.paymentStatus === "not_started")
          .reduce((s: number, o: OrderSummary) =>
            s + o.lineItems.reduce((ls: number, li) => ls + li.lineTotal, 0), 0)

        const today = new Date().toISOString().split("T")[0]
        const upcomingDeliveries = orders.filter((o: OrderSummary) =>
          o.deliveryDate && o.deliveryDate >= today).length

        const lowStockCount = inventoryData.lowStockCount ?? 0
        const totalStockValue = inventoryData.totalStockValue ?? 0

        setData({
          totalOrders: orders.length,
          pendingPayments,
          pendingPaymentAmount,
          totalRevenue,
          totalCost,
          upcomingDeliveries,
          lowStockCount,
          customerCount: customers.length,
          totalStockValue,
          orders,
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
