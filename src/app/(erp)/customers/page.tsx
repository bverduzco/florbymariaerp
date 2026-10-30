import { db as prisma } from "@/lib/db"
import { AddCustomerDialog } from "./add-customer-dialog"
import { CustomerSearch } from "./customer-search"

async function getCustomers() {
  const customers = await prisma.customer.findMany({
    include: { _count: { select: { orders: true, events: true, quotes: true } },
      orders: { select: { deliveryFee: true, lineItems: { select: { unitPrice: true, qty: true } } } } },
    orderBy: { createdAt: "desc" },
  })
  return customers.map((c) => ({
    id: c.id, name: c.name, phone: c.phone, email: c.email, notes: c.notes,
    createdAt: c.createdAt.toISOString(),
    orderCount: c._count.orders, eventCount: c._count.events, quoteCount: c._count.quotes,
    lifetimeValue: c.orders.reduce((s, o) => s + o.lineItems.reduce((is, l) => is + l.unitPrice * l.qty, 0) + o.deliveryFee, 0),
  }))
}

export default async function CustomersPage() {
  const customers = await getCustomers()
  const totalLtv = customers.reduce((s, c) => s + c.lifetimeValue, 0)
  const avgLtv = customers.length > 0 ? totalLtv / customers.length : 0

  return (
    <div>
      <div className="fmd-screen-header">
        <div><h1>Customers</h1><div className="fmd-subtitle">Contact list + order history</div></div>
        <AddCustomerDialog />
      </div>
      <div className="fmd-kpi-bar">
        <div className="fmd-kpi-cell"><div className="fmd-kpi-value" style={{ color: "#44403C" }}>{customers.length}</div><div className="fmd-kpi-label">Total customers</div></div>
        <div className="fmd-kpi-cell"><div className="fmd-kpi-value" style={{ color: "#047857" }}>${totalLtv.toLocaleString("es-MX", { maximumFractionDigits: 0 })}</div><div className="fmd-kpi-label">Total LTV</div></div>
        <div className="fmd-kpi-cell"><div className="fmd-kpi-value" style={{ color: "#BE185D" }}>${avgLtv.toLocaleString("es-MX", { maximumFractionDigits: 0 })}</div><div className="fmd-kpi-label">Average LTV</div></div>
      </div>
      <div className="fmd-box">
        <div className="fmd-box-label">All Customers ({customers.length})</div>
        <CustomerSearch customers={customers} />
      </div>
    </div>
  )
}
