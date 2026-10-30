// src/app/(erp)/page.tsx
//
// Landing page — the home screen when you click the ✿ logo.
// Matches the wireframe's screen-landing layout:
//   1. Header with ✿ logo
//   2. 3 KPI stats (orders today, events this week, pending quotes)
//   3. Two-column grid: today's orders + upcoming events
//   4. Quick actions bar

import { db as prisma } from "@/lib/db"
import Link from "next/link"

async function getLandingData() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const weekEnd = new Date(today)
  weekEnd.setDate(weekEnd.getDate() + 7)

  const [ordersToday, eventsThisWeek, pendingQuotes, recentOrders, upcomingEvents] = await Promise.all([
    prisma.order.count({ where: { deliveryDate: { gte: today, lt: tomorrow } } }),
    prisma.event.count({ where: { eventDate: { gte: today, lte: weekEnd } } }),
    prisma.quote.count({ where: { status: { in: ["draft", "sent", "viewed", "negotiating"] } } }),
    prisma.order.findMany({
      where: { deliveryDate: { gte: today, lt: tomorrow } },
      include: { customer: { select: { name: true } }, lineItems: { select: { qty: true, unitPrice: true } } },
      take: 5,
    }),
    prisma.event.findMany({
      where: { eventDate: { gte: today, lte: weekEnd } },
      include: { customer: { select: { name: true } } },
      orderBy: { eventDate: "asc" },
      take: 5,
    }),
  ])

  return { ordersToday, eventsThisWeek, pendingQuotes, recentOrders, upcomingEvents }
}

export default async function LandingPage() {
  const data = await getLandingData()

  return (
    <div>
      {/* Header */}
      <div className="fmd-screen-header">
        <div>
          <h1>✿ Flor by Maria</h1>
          <div className="fmd-subtitle">Home — summary of today's orders and upcoming events</div>
        </div>
      </div>

      {/* KPI stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "12px", marginBottom: "20px" }}>
        <div className="fmd-stat">
          <div className="fmd-stat-value">{data.ordersToday}</div>
          <div className="fmd-stat-label">Orders Today</div>
        </div>
        <div className="fmd-stat">
          <div className="fmd-stat-value">{data.eventsThisWeek}</div>
          <div className="fmd-stat-label">Events This Week</div>
        </div>
        <div className="fmd-stat">
          <div className="fmd-stat-value">{data.pendingQuotes}</div>
          <div className="fmd-stat-label">Pending Quotes</div>
        </div>
      </div>

      {/* Two-column: today's orders + upcoming events */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "16px" }}>
        {/* Today's Orders */}
        <div className="fmd-box">
          <div className="fmd-box-label">Today's Orders</div>
          {data.recentOrders.length === 0 ? (
            <div style={{ textAlign: "center", padding: "16px", color: "#9CA3AF", fontSize: "12px" }}>No orders today.</div>
          ) : (
            <table className="fmd-table">
              <thead><tr><th>Order</th><th>Customer</th><th>Items</th><th style={{ textAlign: "right" }}>Total</th><th>Status</th></tr></thead>
              <tbody>
                {data.recentOrders.map((o) => {
                  const total = o.lineItems.reduce((s, l) => s + l.unitPrice * l.qty, 0)
                  return (
                    <tr key={o.id}>
                      <td style={{ fontFamily: "monospace", fontSize: "11px" }}>{o.orderNumber}</td>
                      <td style={{ color: "#44403C" }}>{o.customer?.name ?? "—"}</td>
                      <td>{o.lineItems.length} lines</td>
                      <td style={{ textAlign: "right", fontWeight: 600, color: "#44403C" }}>${total.toLocaleString("es-MX", { maximumFractionDigits: 0 })}</td>
                      <td><span className={`fmd-status ${o.status}`}>{o.status.replace(/_/g, " ")}</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
          <Link href="/orders" className="fmd-btn primary" style={{ marginTop: "8px", display: "inline-block", textDecoration: "none" }}>+ New Order</Link>
        </div>

        {/* Upcoming Events */}
        <div className="fmd-box">
          <div className="fmd-box-label">Upcoming Events</div>
          {data.upcomingEvents.length === 0 ? (
            <div style={{ textAlign: "center", padding: "16px", color: "#9CA3AF", fontSize: "12px" }}>No events this week.</div>
          ) : (
            <table className="fmd-table">
              <thead><tr><th>Event</th><th>Date</th><th>Type</th><th>Status</th></tr></thead>
              <tbody>
                {data.upcomingEvents.map((e) => (
                  <tr key={e.id}>
                    <td style={{ color: "#44403C" }}>{e.eventNumber} · {e.name}</td>
                    <td>{e.eventDate ? e.eventDate.toLocaleDateString("es-MX", { day: "2-digit", month: "short" }) : "—"}</td>
                    <td style={{ textTransform: "capitalize" }}>{e.notes?.match(/\[(\w+)\]/)?.[1] ?? "—"}</td>
                    <td><span className={`fmd-status ${e.status}`}>{e.status.replace(/_/g, " ")}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <Link href="/events" className="fmd-btn primary" style={{ marginTop: "8px", display: "inline-block", textDecoration: "none" }}>+ New Event</Link>
        </div>
      </div>

      {/* Quick actions */}
      <div className="fmd-box">
        <div className="fmd-box-label">Quick Actions</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
          <Link href="/quotes" className="fmd-btn primary" style={{ textDecoration: "none" }}>📋 New Quote</Link>
          <Link href="/shoppinglist" className="fmd-btn success" style={{ textDecoration: "none" }}>🛒 Shopping List</Link>
          <Link href="/custom" className="fmd-btn dark" style={{ textDecoration: "none" }}>🌷 Custom Bouquet</Link>
          <Link href="/dashboard" className="fmd-btn outline" style={{ textDecoration: "none" }}>📊 Dashboard</Link>
        </div>
      </div>
    </div>
  )
}
