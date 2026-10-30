// src/app/(erp)/dashboard/page.tsx
//
// Dashboard — matches wireframe design system.
// Uses .fmd-* CSS classes for exact wireframe styling.

import { db as prisma } from "@/lib/db"
import Link from "next/link"

async function getDashboardData() {
  const [
    totalMaterials, totalOrders, totalEvents, payments, expenses,
  ] = await Promise.all([
    prisma.material.count(),
    prisma.order.count(),
    prisma.event.count(),
    prisma.payment.findMany({ where: { status: "confirmed" } }),
    prisma.expense.aggregate({ _sum: { amount: true }, _count: true }),
  ])

  const monthStart = new Date("2026-10-01")
  const monthEnd = new Date("2026-10-31")
  const inThisMonth = payments
    .filter((p) => p.direction === "inbound" && p.date >= monthStart && p.date <= monthEnd)
    .reduce((sum, p) => sum + p.amount, 0)
  const outThisMonth = payments
    .filter((p) => p.direction === "outbound" && p.date >= monthStart && p.date <= monthEnd)
    .reduce((sum, p) => sum + p.amount, 0)

  return {
    totalMaterials, totalOrders, totalEvents,
    paymentsIn: inThisMonth, paymentsOut: outThisMonth,
    netCashFlow: inThisMonth - outThisMonth,
    expenseCount: expenses._count,
  }
}

export default async function DashboardPage() {
  const data = await getDashboardData()

  return (
    <div>
      {/* Screen header */}
      <div className="fmd-screen-header">
        <div>
          <h1>Dashboard</h1>
          <div className="fmd-subtitle">Live snapshot — pulls from every tab automatically</div>
        </div>
      </div>

      {/* KPI stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "12px", marginBottom: "20px" }}>
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
            -${data.paymentsOut.toLocaleString("es-MX", { maximumFractionDigits: 0 })}
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

      {/* Quick links */}
      <div className="fmd-box">
        <div className="fmd-box-label">Quick Links</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "8px" }}>
          <QuickLink href="/calendar" icon="📅" label="Calendar" />
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

      {/* Business rules */}
      <div className="fmd-note">
        💡 <strong>Business rules:</strong> Small orders = 100% prepay. Events = 50% deposit + 50% balance 14 days before. All suppliers = COD.
      </div>
    </div>
  )
}

function QuickLink({ href, icon, label }: { href: string; icon: string; label: string }) {
  return (
    <Link
      href={href}
      className="fmd-flow-step"
      style={{ display: "flex", alignItems: "center", gap: "6px", textDecoration: "none" }}
    >
      <span style={{ fontSize: "14px" }}>{icon}</span>
      <span>{label}</span>
    </Link>
  )
}
