// src/app/(erp)/page.tsx
//
// Landing page — the home screen when you click the ✿ logo.
//
// Desktop: KPI stats + two-column grid (today's orders + upcoming events) + quick actions
// Mobile: greeting + compact snapshot + 4 big action buttons + pending items as cards
//
// Mobile layout matches the wireframe in /download/mobile-wireframe-flow.html

import { db as prisma } from "@/lib/db"
import Link from "next/link"

async function getLandingData() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const weekEnd = new Date(today)
  weekEnd.setDate(weekEnd.getDate() + 7)

  const [
    ordersToday,
    eventsThisWeek,
    pendingQuotes,
    recentOrders,
    upcomingEvents,
    activeQuotes,
    inProgressOrders,
    weeklyRevenue,
  ] = await Promise.all([
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
    // For mobile: active quotes with customer names
    prisma.quote.findMany({
      where: { status: { in: ["draft", "sent", "viewed", "negotiating"] } },
      include: { customer: { select: { name: true } } },
      orderBy: { quoteDate: "desc" },
      take: 5,
    }),
    // For mobile: orders in production
    prisma.order.findMany({
      where: { status: { in: ["payment_confirmed", "procuring", "producing"] } },
      include: { customer: { select: { name: true } }, lineItems: { select: { qty: true, unitPrice: true } } },
      orderBy: { deliveryDate: "asc" },
      take: 5,
    }),
    // For mobile: weekly revenue
    prisma.order.aggregate({
      where: { deliveryDate: { gte: today, lte: weekEnd } },
      _sum: { deliveryFee: true },
    }),
  ])

  // Calculate pending items for mobile (merge quotes + orders + events)
  const pendingItems: Array<{
    type: "order" | "quote" | "event"
    number: string
    title: string
    meta: string
    amount: number
    href: string
  }> = []

  for (const o of inProgressOrders) {
    const total = o.lineItems.reduce((s, l) => s + l.unitPrice * l.qty, 0) + o.deliveryFee
    pendingItems.push({
      type: "order",
      number: o.orderNumber,
      title: o.customer?.name ?? "—",
      meta: `Produciendo · ${o.deliveryDate ? o.deliveryDate.toLocaleDateString("es-MX", { day: "2-digit", month: "short" }) : "sin fecha"}`,
      amount: total,
      href: `/orders`,
    })
  }

  for (const q of activeQuotes) {
    pendingItems.push({
      type: "quote",
      number: q.quoteNumber,
      title: q.customer?.name ?? q.customerName ?? "—",
      meta: `${q.status} · ${q.eventType ?? "pedido"}`,
      amount: q.total,
      href: `/quotes/${q.id}`,
    })
  }

  for (const e of upcomingEvents) {
    pendingItems.push({
      type: "event",
      number: e.eventNumber,
      title: e.name,
      meta: `${e.eventDate ? e.eventDate.toLocaleDateString("es-MX", { day: "2-digit", month: "short" }) : "—"} · ${e.status}`,
      amount: 0,
      href: `/events`,
    })
  }

  return {
    ordersToday,
    eventsThisWeek,
    pendingQuotes,
    recentOrders,
    upcomingEvents,
    activeQuotes,
    inProgressOrders,
    weeklyRevenue: weeklyRevenue._sum.deliveryFee ?? 0,
    pendingItems: pendingItems.slice(0, 5),
    activeQuoteCount: activeQuotes.length,
    inProgressCount: inProgressOrders.length,
  }
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Borrador",
  sent: "Enviada",
  viewed: "Vista",
  negotiating: "Negociando",
  accepted: "Aceptada",
  payment_confirmed: "Pago confirmado",
  procuring: "Comprando",
  producing: "Produciendo",
}

export default async function LandingPage() {
  const data = await getLandingData()

  return (
    <>
      {/* ════════════════════════════════════════════════════════ */}
      {/* DESKTOP LANDING (hidden on mobile) */}
      {/* ════════════════════════════════════════════════════════ */}
      <div className="hidden lg:block">
        <div className="fmd-screen-header">
          <div>
            <h1>✿ Flor by Maria</h1>
            <div className="fmd-subtitle">Home — summary of today&apos;s orders and upcoming events</div>
          </div>
        </div>

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

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "16px" }}>
          <div className="fmd-box">
            <div className="fmd-box-label">Today&apos;s Orders</div>
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

        <div className="fmd-box">
          <div className="fmd-box-label">Quick Actions</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            <Link href="/quotes" className="fmd-btn primary" style={{ textDecoration: "none" }}>📋 New Quote</Link>
            <Link href="/shoppinglist" className="fmd-btn success" style={{ textDecoration: "none" }}>🛒 Shopping List</Link>
            <Link href="/custom" className="fmd-btn dark" style={{ textDecoration: "none" }}>🌷 Custom Bouquet</Link>
            <Link href="/dashboard" className="fmd-btn outline" style={{ textDecoration: "none" }}>📊 Dashboard</Link>
            <Link href="/knowledge" className="fmd-btn outline" style={{ textDecoration: "none" }}>📚 Wiki</Link>
            <Link href="/execution" className="fmd-btn dark" style={{ textDecoration: "none" }}>🔨 Log Execution</Link>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════ */}
      {/* MOBILE LANDING (hidden on desktop) */}
      {/* ════════════════════════════════════════════════════════ */}
      <div className="lg:hidden" style={{ paddingBottom: "80px" }}>
        {/* Greeting */}
        <div style={{ padding: "20px 16px 12px", textAlign: "center" }}>
          <div style={{ fontSize: "11px", color: "#78716C", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "4px" }}>
            {new Date().toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "short" })}
          </div>
          <div style={{ fontSize: "22px", fontWeight: 700, color: "#44403C" }}>
            Buenos días, María 👋
          </div>
          {data.inProgressCount > 0 && (
            <div style={{ fontSize: "12px", color: "#78716C", marginTop: "4px" }}>
              Tienes {data.inProgressCount} pedido{data.inProgressCount !== 1 ? "s" : ""} pendiente{data.inProgressCount !== 1 ? "s" : ""} de producción
            </div>
          )}
        </div>

        {/* Compact snapshot */}
        <div style={{ margin: "8px 16px 20px", background: "#fff", border: "1px solid #E7E5E4", borderRadius: "10px", padding: "14px", display: "flex", justifyContent: "space-around" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "20px", fontWeight: 700, color: "#BE185D" }}>{data.ordersToday}</div>
            <div style={{ fontSize: "10px", color: "#78716C", textTransform: "uppercase", letterSpacing: "0.5px", marginTop: "2px" }}>Hoy</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "20px", fontWeight: 700, color: "#BE185D" }}>{data.eventsThisWeek}</div>
            <div style={{ fontSize: "10px", color: "#78716C", textTransform: "uppercase", letterSpacing: "0.5px", marginTop: "2px" }}>Esta sem.</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "20px", fontWeight: 700, color: "#BE185D" }}>{data.activeQuoteCount}</div>
            <div style={{ fontSize: "10px", color: "#78716C", textTransform: "uppercase", letterSpacing: "0.5px", marginTop: "2px" }}>Cotiz.</div>
          </div>
        </div>

        {/* Big action buttons — only 3: New Quote, Catalogue, Custom Builder */}
        <div style={{ padding: "0 24px 24px", display: "flex", flexDirection: "column", gap: "12px" }}>
          <Link
            href="/quotes?new=1"
            style={{
              display: "flex", alignItems: "center", gap: "14px",
              padding: "18px 20px", borderRadius: "12px",
              background: "#BE185D", color: "white",
              fontSize: "15px", fontWeight: 600, textDecoration: "none",
            }}
          >
            <span style={{ fontSize: "20px" }}>📋</span>
            <span style={{ flex: 1 }}>
              Nueva cotización
              <span style={{ display: "block", fontSize: "11px", fontWeight: 400, opacity: 0.8, marginTop: "2px" }}>
                Crea y envía en 2 minutos
              </span>
            </span>
            <span style={{ fontSize: "18px", opacity: 0.4 }}>›</span>
          </Link>

          <Link
            href="/catalogue"
            style={{
              display: "flex", alignItems: "center", gap: "14px",
              padding: "18px 20px", borderRadius: "12px",
              background: "#fff", color: "#44403C", border: "1px solid #E7E5E4",
              fontSize: "15px", fontWeight: 600, textDecoration: "none",
            }}
          >
            <span style={{ fontSize: "20px" }}>🌸</span>
            <span style={{ flex: 1 }}>
              Catálogo
              <span style={{ display: "block", fontSize: "11px", fontWeight: 400, color: "#78716C", marginTop: "2px" }}>
                Añadir a cotización
              </span>
            </span>
            <span style={{ fontSize: "18px", color: "#A8A29E" }}>›</span>
          </Link>

          <Link
            href="/custom"
            style={{
              display: "flex", alignItems: "center", gap: "14px",
              padding: "18px 20px", borderRadius: "12px",
              background: "#fff", color: "#44403C", border: "1px solid #E7E5E4",
              fontSize: "15px", fontWeight: 600, textDecoration: "none",
            }}
          >
            <span style={{ fontSize: "20px" }}>🌷</span>
            <span style={{ flex: 1 }}>
              Custom builder
              <span style={{ display: "block", fontSize: "11px", fontWeight: 400, color: "#78716C", marginTop: "2px" }}>
                Diseña un ramo personalizado
              </span>
            </span>
            <span style={{ fontSize: "18px", color: "#A8A29E" }}>›</span>
          </Link>
        </div>

        {/* Pending items */}
        {data.pendingItems.length > 0 && (
          <>
            <div style={{ padding: "0 16px 8px", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "#78716C" }}>
              Pendientes de hoy
            </div>
            <div style={{ margin: "0 16px 20px", background: "#fff", border: "1px solid #E7E5E4", borderRadius: "10px", overflow: "hidden" }}>
              {data.pendingItems.map((item, i) => {
                const badgeClass =
                  item.type === "order" ? "background:#DBEAFE"
                  : item.type === "quote" ? "background:#FCE7F3"
                  : "background:#FEF3C7"
                const badgeIcon = item.type === "order" ? "🛒" : item.type === "quote" ? "📋" : "🎉"
                return (
                  <Link
                    key={i}
                    href={item.href}
                    style={{
                      display: "flex", alignItems: "center", gap: "10px",
                      padding: "12px 14px",
                      borderBottom: i < data.pendingItems.length - 1 ? "1px solid #F5F5F4" : "none",
                      textDecoration: "none",
                    }}
                  >
                    <div style={{ width: "36px", height: "36px", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", flexShrink: 0, ...Object.fromEntries(Object.entries({ background: badgeClass.split(":")[1].trim() }).map(([k, v]) => [k, v])) }}>
                      {badgeIcon}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "13px", fontWeight: 600, color: "#44403C", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {item.number} · {item.title}
                      </div>
                      <div style={{ fontSize: "11px", color: "#78716C", marginTop: "1px" }}>
                        {item.meta}
                      </div>
                    </div>
                    {item.amount > 0 && (
                      <div style={{ fontSize: "13px", fontWeight: 700, color: "#44403C", flexShrink: 0 }}>
                        ${item.amount.toLocaleString("es-MX", { maximumFractionDigits: 0 })}
                      </div>
                    )}
                  </Link>
                )
              })}
            </div>
          </>
        )}
      </div>
    </>
  )
}
