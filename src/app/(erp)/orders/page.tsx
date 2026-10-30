// src/app/(erp)/orders/page.tsx — wireframe-matched styling

import { db as prisma } from "@/lib/db"
import { NewOrderDialog } from "./new-order-dialog"
import { StatusDropdown } from "@/components/status-dropdown"

async function getOrders() {
  return prisma.order.findMany({
    include: {
      customer: { select: { name: true, phone: true } },
      lineItems: { select: { productName: true, productSize: true, qty: true, unitPrice: true } },
    },
    orderBy: { createdAt: "desc" },
  })
}

export default async function OrdersPage() {
  const [orders, customers, products] = await Promise.all([
    getOrders(),
    prisma.customer.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.product.findMany({
      where: { actualPriceBeforeIva: { gt: 0 } },
      orderBy: [{ name: "asc" }],
      select: { sku: true, name: true, size: true, actualPriceBeforeIva: true },
    }),
  ])

  const total = orders.length
  const fulfilled = orders.filter((o) => o.status === "fulfilled" || o.status === "delivered").length
  const inProgress = orders.filter((o) => ["procuring", "producing", "payment_confirmed", "awaiting_payment"].includes(o.status)).length
  const totalRevenue = orders.reduce((s, o) => {
    const items = o.lineItems.reduce((is, l) => is + l.unitPrice * l.qty, 0)
    return s + items + o.deliveryFee
  }, 0)

  return (
    <div>
      <div className="fmd-screen-header">
        <div>
          <h1>Orders</h1>
          <div className="fmd-subtitle">Everyday sales · draft → payment → production → delivery</div>
        </div>
        <NewOrderDialog customers={customers} products={products} />
      </div>

      <div className="fmd-kpi-bar">
        <div className="fmd-kpi-cell"><div className="fmd-kpi-value" style={{ color: "#44403C" }}>{total}</div><div className="fmd-kpi-label">Total orders</div></div>
        <div className="fmd-kpi-cell"><div className="fmd-kpi-value" style={{ color: "#047857" }}>{fulfilled}</div><div className="fmd-kpi-label">Fulfilled</div></div>
        <div className="fmd-kpi-cell"><div className="fmd-kpi-value" style={{ color: "#D97706" }}>{inProgress}</div><div className="fmd-kpi-label">In progress</div></div>
        <div className="fmd-kpi-cell"><div className="fmd-kpi-value" style={{ color: "#BE185D" }}>${totalRevenue.toLocaleString("es-MX", { maximumFractionDigits: 0 })}</div><div className="fmd-kpi-label">Total revenue</div></div>
      </div>

      <div className="fmd-box">
        <div className="fmd-box-label">All Orders</div>
        <div style={{ overflowX: "auto" }}>
          <table className="fmd-table">
            <thead>
              <tr>
                <th>Order #</th>
                <th>Customer</th>
                <th>Items</th>
                <th>Delivery</th>
                <th>Status</th>
                <th>Payment</th>
                <th style={{ textAlign: "right" }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                const itemsTotal = o.lineItems.reduce((s, l) => s + l.unitPrice * l.qty, 0) + o.deliveryFee
                const itemCount = o.lineItems.reduce((s, l) => s + l.qty, 0)
                return (
                  <tr key={o.id}>
                    <td style={{ fontFamily: "monospace", fontSize: "11px", color: "#44403C" }}>{o.orderNumber}</td>
                    <td style={{ fontWeight: 600, color: "#44403C" }}>{o.customer.name}</td>
                    <td>{o.lineItems.length} products · {itemCount} items</td>
                    <td>{o.deliveryDate ? o.deliveryDate.toLocaleDateString("es-MX", { day: "2-digit", month: "short" }) : "—"}</td>
                    <td>
                      <StatusDropdown
                        entityId={o.id}
                        currentStatus={o.status}
                        statuses={[
                          { value: "draft", label: "Draft" },
                          { value: "quote_sent", label: "Quote sent" },
                          { value: "awaiting_payment", label: "Awaiting payment" },
                          { value: "payment_confirmed", label: "Payment confirmed" },
                          { value: "procuring", label: "Procuring" },
                          { value: "producing", label: "Producing" },
                          { value: "delivered", label: "Delivered" },
                          { value: "fulfilled", label: "Fulfilled" },
                          { value: "cancelled", label: "Cancelled" },
                        ]}
                        apiPath="/api/orders/{id}/status"
                      />
                    </td>
                    <td><span className={`fmd-status ${o.paymentStatus}`}>{o.paymentStatus.replace(/_/g, " ")}</span></td>
                    <td style={{ textAlign: "right", fontWeight: 600, color: "#44403C" }}>${itemsTotal.toLocaleString("es-MX", { maximumFractionDigits: 0 })}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="fmd-note">💡 Small orders require 100% payment before procurement. Payment gate blocks Shopping List generation.</div>
    </div>
  )
}
