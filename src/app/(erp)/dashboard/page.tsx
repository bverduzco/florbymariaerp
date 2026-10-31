import { db as prisma } from "@/lib/db"
import Link from "next/link"

async function getDashboardData() {
  const [
    totalMaterials, totalOrders, totalEvents, payments, expenses,
    purchaseOrders, adHocPurchases, losses, executionLogs,
  ] = await Promise.all([
    prisma.material.count(),
    prisma.order.count(),
    prisma.event.count(),
    prisma.payment.findMany({ where: { status: "confirmed" } }),
    prisma.expense.findMany(),
    prisma.purchaseOrder.findMany({ select: { totalCost: true, createdAt: true } }),
    prisma.adHocPurchase.findMany({ select: { total: true, date: true } }),
    prisma.loss.findMany({ select: { costImpact: true, date: true } }),
    prisma.executionLog.findMany({ select: { actualCost: true, executedAt: true } }),
  ])

  const monthStart = new Date("2026-10-01")
  const monthEnd = new Date("2026-10-31")

  const inThisMonth = payments
    .filter((p) => p.direction === "inbound" && p.date >= monthStart && p.date <= monthEnd)
    .reduce((sum, p) => sum + p.amount, 0)
  const outThisMonth = payments
    .filter((p) => p.direction === "outbound" && p.date >= monthStart && p.date <= monthEnd)
    .reduce((sum, p) => sum + p.amount, 0)

  // Money Out breakdown — matching wireframe
  const formalPOs = purchaseOrders
    .filter((p) => p.createdAt >= monthStart && p.createdAt <= monthEnd)
  const formalPOsTotal = formalPOs.reduce((s, p) => s + p.totalCost, 0)

  const adHocThisMonth = adHocPurchases
    .filter((a) => a.date >= monthStart && a.date <= monthEnd)
  const adHocTotal = adHocThisMonth.reduce((s, a) => s + a.total, 0)

  const expensesThisMonth = expenses
    .filter((e) => e.date >= monthStart && e.date <= monthEnd)
  const expensesTotal = expensesThisMonth.reduce((s, e) => s + e.amount, 0)

  const totalMoneyOut = formalPOsTotal + adHocTotal + expensesTotal

  // Losses this month
  const lossesThisMonth = losses.filter((l) => l.date >= monthStart && l.date <= monthEnd)
  const lossesTotal = lossesThisMonth.reduce((s, l) => s + (l.costImpact ?? 0), 0)

  return {
    totalMaterials, totalOrders, totalEvents,
    paymentsIn: inThisMonth, paymentsOut: outThisMonth,
    netCashFlow: inThisMonth - outThisMonth,
    expenseCount: expenses.length,
    formalPOsTotal, formalPOsCount: formalPOs.length,
    adHocTotal, adHocCount: adHocThisMonth.length,
    expensesTotal, expensesCount: expensesThisMonth.length,
    totalMoneyOut,
    lossesTotal, lossesCount: lossesThisMonth.length,
  }
}

export default async function DashboardPage() {
  const data = await getDashboardData()

  return (
    <div>
      <div className="fmd-screen-header">
        <div>
          <h1>Dashboard</h1>
          <div className="fmd-subtitle">Live snapshot — pulls from every tab automatically</div>
        </div>
        <button className="fmd-btn outline">This Month ▾</button>
      </div>

      {/* Top KPI stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "12px", marginBottom: "16px" }}>
        <div className="fmd-stat">
          <div className="fmd-stat-value">{data.totalMaterials}</div>
          <div className="fmd-stat-label">Inventory items</div>
        </div>
        <div className="fmd-stat">
          <div className="fmd-stat-value">{data.totalOrders}</div>
          <div className="fmd-stat-label">Orders</div>
        </div>
        <div className="fmd-stat">
          <div className="fmd-stat-value">{data.totalEvents}</div>
          <div className="fmd-stat-label">Events</div>
        </div>
        <div className="fmd-stat">
          <div className="fmd-stat-value" style={{ color: "#047857" }}>
            +${data.paymentsIn.toLocaleString("es-MX", { maximumFractionDigits: 0 })}
          </div>
          <div className="fmd-stat-label">Money in (Oct)</div>
        </div>
        <div className="fmd-stat">
          <div className="fmd-stat-value" style={{ color: "#991B1B" }}>
            -${data.totalMoneyOut.toLocaleString("es-MX", { maximumFractionDigits: 0 })}
          </div>
          <div className="fmd-stat-label">Money out (Oct)</div>
        </div>
        <div className="fmd-stat">
          <div className="fmd-stat-value" style={{ color: data.netCashFlow >= 0 ? "#047857" : "#991B1B" }}>
            {data.netCashFlow >= 0 ? "+" : "-"}${Math.abs(data.netCashFlow).toLocaleString("es-MX", { maximumFractionDigits: 0 })}
          </div>
          <div className="fmd-stat-label">Net cash flow</div>
        </div>
      </div>

      {/* Two-column: Money Out breakdown + Net Cash Flow */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "16px", marginBottom: "16px" }}>
        {/* Money Out breakdown */}
        <div className="fmd-box" style={{ marginBottom: 0 }}>
          <div className="fmd-box-label">Money Out — This Month (breakdown)</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <MoneyOutRow label="Formal POs" value={data.formalPOsTotal} count={data.formalPOsCount} countLabel="POs" />
            <MoneyOutRow label="Ad-hoc purchases" value={data.adHocTotal} count={data.adHocCount} countLabel="items" />
            <MoneyOutRow label="Operating expenses" value={data.expensesTotal} count={data.expensesCount} countLabel="entries" />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", borderTop: "2px solid #D6D3D1", marginTop: "4px", fontSize: "13px", fontWeight: 700, color: "#44403C" }}>
              <span>Total money out:</span>
              <span style={{ color: "#991B1B" }}>${data.totalMoneyOut.toLocaleString("es-MX", { maximumFractionDigits: 0 })}</span>
            </div>
          </div>
        </div>

        {/* Net Cash Flow */}
        <div className="fmd-box" style={{ marginBottom: 0 }}>
          <div className="fmd-box-label">Net Cash Flow</div>
          <div style={{ fontSize: "24px", fontWeight: 700, color: data.netCashFlow >= 0 ? "#047857" : "#991B1B", marginBottom: "8px" }}>
            {data.netCashFlow >= 0 ? "+" : "-"}${Math.abs(data.netCashFlow).toLocaleString("es-MX", { maximumFractionDigits: 0 })} MXN
          </div>
          <div style={{ fontSize: "12px", color: "#6B7280", padding: "8px 12px", background: "#FAFAF9", border: "1px solid #D6D3D1", borderRadius: "4px" }}>
            Revenue (${data.paymentsIn.toLocaleString("es-MX", { maximumFractionDigits: 0 })}) − Money Out (${data.totalMoneyOut.toLocaleString("es-MX", { maximumFractionDigits: 0 })})
          </div>
          {data.lossesCount > 0 && (
            <div style={{ marginTop: "8px", fontSize: "11px", color: "#991B1B" }}>
              ⚠ Losses this month: {data.lossesCount} events · ${data.lossesTotal.toLocaleString("es-MX", { maximumFractionDigits: 0 })} cost impact
            </div>
          )}
        </div>
      </div>

      {/* Quick links */}
      <div className="fmd-box">
        <div className="fmd-box-label">Quick Links</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "8px" }}>
          <QuickLink href="/quotes" icon="📋" label="Quotes" />
          <QuickLink href="/orders" icon="🛒" label="Orders" />
          <QuickLink href="/products" icon="💐" label="Products" />
          <QuickLink href="/customers" icon="👥" label="Customers" />
          <QuickLink href="/events" icon="🎉" label="Events" />
          <QuickLink href="/suppliers" icon="🏪" label="Suppliers" />
          <QuickLink href="/materials" icon="📦" label="Materials" />
          <QuickLink href="/procurement" icon="🚚" label="Procurement" />
          <QuickLink href="/shoppinglist" icon="🛒" label="Shopping List" />
          <QuickLink href="/payments" icon="💰" label="Payments" />
          <QuickLink href="/expenses" icon="💸" label="Expenses" />
          <QuickLink href="/losses" icon="⚠️" label="Losses" />
          <QuickLink href="/execution" icon="🔨" label="Execution Logs" />
          <QuickLink href="/recipes" icon="📖" label="Recipes" />
          <QuickLink href="/calendar" icon="📅" label="Calendar" />
          <QuickLink href="/staff" icon="👤" label="Staff" />
          <QuickLink href="/catalogue" icon="🌸" label="Catalogue" />
          <QuickLink href="/custom" icon="🌷" label="Custom Builder" />
          <QuickLink href="/legal" icon="📄" label="Legal Templates" />
          <QuickLink href="/settings" icon="⚙️" label="Settings" />
        </div>
      </div>

      {/* Pipeline flow */}
      <div className="fmd-box">
        <div className="fmd-box-label">Sales Pipeline</div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", margin: "12px 0" }}>
          <span className="fmd-flow-step">Lead</span>
          <span style={{ color: "#78716C", fontSize: "14px" }}>→</span>
          <span className="fmd-flow-step">Quote</span>
          <span style={{ color: "#78716C", fontSize: "14px" }}>→</span>
          <span className="fmd-flow-step">Accepted</span>
          <span style={{ color: "#78716C", fontSize: "14px" }}>→</span>
          <span className="fmd-flow-step">Order</span>
          <span style={{ color: "#78716C", fontSize: "14px" }}>→</span>
          <span className="fmd-flow-step">Procurement</span>
          <span style={{ color: "#78716C", fontSize: "14px" }}>→</span>
          <span className="fmd-flow-step">Production</span>
          <span style={{ color: "#78716C", fontSize: "14px" }}>→</span>
          <span className="fmd-flow-step">Delivered</span>
        </div>
      </div>

      <div className="fmd-note">
        💡 <strong>Business rules:</strong> Small orders = 100% prepay. Events = 50% deposit + 50% balance 14 days before. All suppliers = COD.
      </div>
    </div>
  )
}

function MoneyOutRow({ label, value, count, countLabel }: { label: string; value: number; count: number; countLabel: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 12px", background: "#ffffff", border: "1px solid #D6D3D1", borderRadius: "4px", fontSize: "12px" }}>
      <span style={{ color: "#6B7280" }}>{label}: <strong style={{ color: "#44403C" }}>${value.toLocaleString("es-MX", { maximumFractionDigits: 0 })}</strong> ({count} {countLabel})</span>
    </div>
  )
}

function QuickLink({ href, icon, label }: { href: string; icon: string; label: string }) {
  return (
    <Link href={href} className="fmd-flow-step" style={{ display: "flex", alignItems: "center", gap: "6px", textDecoration: "none" }}>
      <span style={{ fontSize: "14px" }}>{icon}</span>
      <span>{label}</span>
    </Link>
  )
}
