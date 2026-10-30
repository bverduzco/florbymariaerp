// src/app/orders/page.tsx
//
// Orders list with payment status pipeline.
// Shows all orders, color-coded by status + payment status.

import { db as prisma } from "@/lib/db"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { NewOrderDialog } from "./new-order-dialog"

async function getOrders() {
  return prisma.order.findMany({
    include: {
      customer: { select: { name: true, phone: true } },
      lineItems: {
        select: {
          productName: true,
          productSize: true,
          qty: true,
          unitPrice: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  })
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-stone-100 text-stone-700 border-stone-300",
  quote_sent: "bg-blue-50 text-blue-700 border-blue-300",
  awaiting_payment: "bg-amber-50 text-amber-700 border-amber-300",
  payment_confirmed: "bg-emerald-50 text-emerald-700 border-emerald-300",
  procuring: "bg-indigo-50 text-indigo-700 border-indigo-300",
  producing: "bg-violet-50 text-violet-700 border-violet-300",
  delivered: "bg-emerald-100 text-emerald-800 border-emerald-400",
  fulfilled: "bg-emerald-100 text-emerald-800 border-emerald-400",
  cancelled: "bg-red-50 text-red-700 border-red-300",
}

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  not_started: "bg-stone-100 text-stone-600 border-stone-300",
  pending: "bg-amber-50 text-amber-700 border-amber-300",
  confirmed: "bg-emerald-50 text-emerald-700 border-emerald-300",
  refunded: "bg-stone-100 text-stone-700 border-stone-300",
  failed: "bg-red-50 text-red-700 border-red-300",
}

export default async function OrdersPage() {
  const [orders, customers, products] = await Promise.all([
    getOrders(),
    prisma.customer.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.product.findMany({
      where: { actualPriceBeforeIva: { gt: 0 } },
      orderBy: [{ name: "asc" }, { size: "asc" }],
      select: { sku: true, name: true, size: true, actualPriceBeforeIva: true },
    }),
  ])

  // Compute KPIs
  const total = orders.length
  const fulfilled = orders.filter((o) => o.status === "fulfilled" || o.status === "delivered").length
  const inProgress = orders.filter((o) =>
    ["procuring", "producing", "payment_confirmed"].includes(o.status)
  ).length
  const awaitingPayment = orders.filter((o) => o.status === "awaiting_payment").length
  const cancelled = orders.filter((o) => o.status === "cancelled").length

  // Total order value (sum of line items + delivery)
  const totalRevenue = orders.reduce((sum, o) => {
    const itemsTotal = o.lineItems.reduce((s, l) => s + l.unitPrice * l.qty, 0)
    return sum + itemsTotal + o.deliveryFee
  }, 0)

  return (
    <main className="min-h-screen bg-stone-50 px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-wrap justify-between items-start gap-4">
          <div>
            <div className="text-xs uppercase tracking-wider text-stone-500">
              Sales orders · v1.9
            </div>
            <h1 className="mt-1 text-3xl font-bold text-stone-900">Orders</h1>
            <p className="mt-1 text-sm text-stone-600">
              Everyday sales tracked through the pipeline: draft → quote sent → payment → production → delivery.
            </p>
          </div>
          <NewOrderDialog customers={customers} products={products} />
        </header>

        {/* KPI bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 mb-6 border border-stone-200 rounded-lg overflow-hidden bg-white">
          <KpiCell value={`${total}`} label="Total orders" />
          <KpiCell value={`${fulfilled}`} label="Fulfilled" color="green" />
          <KpiCell value={`${inProgress + awaitingPayment}`} label="In progress" color="amber" />
          <KpiCell
            value={`$${totalRevenue.toLocaleString("es-MX", { maximumFractionDigits: 0 })}`}
            label="Total revenue"
            color="purple"
          />
        </div>

        {/* Orders table */}
        <Card className="border-stone-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">All Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-200 text-stone-600 text-xs uppercase tracking-wider">
                    <th className="text-left py-2 px-3">Order #</th>
                    <th className="text-left py-2 px-3">Customer</th>
                    <th className="text-left py-2 px-3">Items</th>
                    <th className="text-left py-2 px-3">Delivery date</th>
                    <th className="text-left py-2 px-3">Status</th>
                    <th className="text-left py-2 px-3">Payment</th>
                    <th className="text-right py-2 px-3">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-stone-400">
                        No orders yet. Click &quot;+ New Order&quot; to create one.
                      </td>
                    </tr>
                  ) : (
                    orders.map((o) => {
                      const itemsCount = o.lineItems.reduce((s, l) => s + l.qty, 0)
                      const itemsTotal = o.lineItems.reduce((s, l) => s + l.unitPrice * l.qty, 0)
                      const total = itemsTotal + o.deliveryFee
                      return (
                        <tr key={o.id} className="border-b border-stone-100 hover:bg-stone-50">
                          <td className="py-3 px-3 font-mono text-xs">{o.orderNumber}</td>
                          <td className="py-3 px-3">
                            <div className="font-medium text-stone-900">{o.customer.name}</div>
                            {o.customer.phone && (
                              <div className="text-xs text-stone-500">{o.customer.phone}</div>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            <div className="text-xs text-stone-700">
                              {o.lineItems.length} product{o.lineItems.length !== 1 ? "s" : ""} · {itemsCount} item{itemsCount !== 1 ? "s" : ""}
                            </div>
                            <div className="text-xs text-stone-500 line-clamp-1 mt-0.5">
                              {o.lineItems.map((l) => `${l.productName}${l.productSize ? ` (${l.productSize})` : ""} ×${l.qty}`).join(", ")}
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            {o.deliveryDate
                              ? o.deliveryDate.toLocaleDateString("es-MX", {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                })
                              : <span className="text-stone-400 text-xs">—</span>}
                          </td>
                          <td className="py-3 px-3">
                            <Badge
                              variant="outline"
                              className={`text-xs ${STATUS_COLORS[o.status] ?? STATUS_COLORS.draft}`}
                            >
                              {o.status.replace(/_/g, " ")}
                            </Badge>
                          </td>
                          <td className="py-3 px-3">
                            <Badge
                              variant="outline"
                              className={`text-xs ${PAYMENT_STATUS_COLORS[o.paymentStatus] ?? PAYMENT_STATUS_COLORS.not_started}`}
                            >
                              {o.paymentStatus.replace(/_/g, " ")}
                            </Badge>
                          </td>
                          <td className="py-3 px-3 text-right font-medium">
                            ${total.toLocaleString("es-MX", { maximumFractionDigits: 0 })}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
            <div className="mt-3 text-xs text-stone-500">
              📊 {total} orders · {fulfilled} fulfilled · {inProgress + awaitingPayment} in progress · {cancelled} cancelled
              <br />
              💡 Small orders require 100% payment before procurement (payment gate).
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

function KpiCell({
  value,
  label,
  color = "default",
}: {
  value: string
  label: string
  color?: "default" | "green" | "amber" | "purple"
}) {
  const colorMap = {
    default: "text-stone-900",
    green: "text-emerald-700",
    amber: "text-amber-700",
    purple: "text-violet-700",
  }
  return (
    <div className="p-3 border-r border-stone-200 last:border-r-0 min-w-[120px]">
      <div className={`text-xl font-bold ${colorMap[color]}`}>{value}</div>
      <div className="text-xs text-stone-500 mt-0.5">{label}</div>
    </div>
  )
}
