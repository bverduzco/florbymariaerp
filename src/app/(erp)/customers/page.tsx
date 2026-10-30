import { db as prisma } from "@/lib/db"
import { AddCustomerDialog } from "./add-customer-dialog"
import { CustomerSearch } from "./customer-search"

async function getCustomers() {
  const customers = await prisma.customer.findMany({
    include: {
      _count: { select: { orders: true, events: true, quotes: true } },
      orders: { select: { deliveryFee: true, lineItems: { select: { unitPrice: true, qty: true } } } },
    },
    orderBy: { createdAt: "desc" },
  })
  return customers.map((c) => {
    const lifetimeValue = c.orders.reduce((sum, o) => {
      const itemsTotal = o.lineItems.reduce((s, l) => s + l.unitPrice * l.qty, 0)
      return sum + itemsTotal + o.deliveryFee
    }, 0)
    return {
      id: c.id,
      name: c.name,
      phone: c.phone,
      email: c.email,
      address: c.address,
      notes: c.notes,
      status: c.status,
      createdAt: c.createdAt.toISOString(),
      orderCount: c._count.orders,
      eventCount: c._count.events,
      quoteCount: c._count.quotes,
      lifetimeValue,
    }
  })
}

export default async function CustomersPage() {
  const customers = await getCustomers()

  const total = customers.length
  const leads = customers.filter((c) => c.status === "lead").length
  const prospects = customers.filter((c) => c.status === "prospect").length
  const activeCustomers = customers.filter((c) => c.status === "customer").length
  const inactive = customers.filter((c) => c.status === "inactive").length
  const totalLtv = customers.reduce((s, c) => s + c.lifetimeValue, 0)
  const avgLtv = total > 0 ? totalLtv / total : 0

  return (
    <div>
      <div className="fmd-screen-header">
        <div><h1>Customers</h1><div className="fmd-subtitle">CRM — leads, prospects, customers, referrers</div></div>
        <AddCustomerDialog />
      </div>

      {/* Lifecycle flow */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", margin: "0 0 16px 0" }}>
        <span className="fmd-flow-step">Lead</span>
        <span style={{ color: "#78716C", fontSize: "14px" }}>→</span>
        <span className="fmd-flow-step">Prospect (quote sent)</span>
        <span style={{ color: "#78716C", fontSize: "14px" }}>→</span>
        <span className="fmd-flow-step">Customer (deposit paid → order)</span>
        <span style={{ color: "#78716C", fontSize: "14px" }}>→</span>
        <span className="fmd-flow-step">Inactive (12+ months)</span>
      </div>

      <div className="fmd-note blue" style={{ marginBottom: "12px" }}>
        Status is lifecycle only. Promotion prospect → customer requires an Order (deposit paid). An accepted quote without deposit = still prospect.
      </div>

      {/* KPI bar */}
      <div className="fmd-kpi-bar">
        <div className="fmd-kpi-cell"><div className="fmd-kpi-value" style={{ color: "#44403C" }}>{total}</div><div className="fmd-kpi-label">Total contacts</div></div>
        <div className="fmd-kpi-cell"><div className="fmd-kpi-value" style={{ color: "#78716C" }}>{leads}</div><div className="fmd-kpi-label">Leads</div></div>
        <div className="fmd-kpi-cell"><div className="fmd-kpi-value" style={{ color: "#D97706" }}>{prospects}</div><div className="fmd-kpi-label">Prospects</div></div>
        <div className="fmd-kpi-cell"><div className="fmd-kpi-value" style={{ color: "#047857" }}>{activeCustomers}</div><div className="fmd-kpi-label">Customers</div></div>
        <div className="fmd-kpi-cell"><div className="fmd-kpi-value" style={{ color: "#BE185D" }}>${totalLtv.toLocaleString("es-MX", { maximumFractionDigits: 0 })}</div><div className="fmd-kpi-label">Total LTV</div></div>
      </div>

      <div className="fmd-box">
        <div className="fmd-box-label">Contact List ({customers.length})</div>
        <CustomerSearch customers={customers} />
      </div>
    </div>
  )
}
