import { db as prisma } from "@/lib/db"
import { NewEventDialog } from "./new-event-dialog"
import { StatusDropdown } from "@/components/status-dropdown"

async function getEvents() {
  return prisma.event.findMany({
    include: { customer: { select: { name: true, phone: true } },
      _count: { select: { orders: true, lineItems: true } },
      orders: { select: { deliveryFee: true, lineItems: { select: { unitPrice: true, qty: true } } } } },
    orderBy: { eventDate: "asc" },
  })
}

export default async function EventsPage() {
  const events = await getEvents()
  const total = events.length
  const upcoming = events.filter((e) => e.eventDate && e.eventDate > new Date()).length
  const inProgress = events.filter((e) => ["confirmed", "in_progress"].includes(e.status)).length
  const estRevenue = events.reduce((s, e) => s + e.orders.reduce((os, o) => os + o.lineItems.reduce((is, l) => is + l.unitPrice * l.qty, 0) + o.deliveryFee, 0), 0)

  return (
    <div>
      <div className="fmd-screen-header">
        <div><h1>Events</h1><div className="fmd-subtitle">Weddings, corporate jobs, demos</div></div>
        <NewEventDialog />
      </div>
      <div className="fmd-kpi-bar">
        <div className="fmd-kpi-cell"><div className="fmd-kpi-value" style={{ color: "#44403C" }}>{total}</div><div className="fmd-kpi-label">Total events</div></div>
        <div className="fmd-kpi-cell"><div className="fmd-kpi-value" style={{ color: "#2563EB" }}>{upcoming}</div><div className="fmd-kpi-label">Upcoming</div></div>
        <div className="fmd-kpi-cell"><div className="fmd-kpi-value" style={{ color: "#D97706" }}>{inProgress}</div><div className="fmd-kpi-label">In progress</div></div>
        <div className="fmd-kpi-cell"><div className="fmd-kpi-value" style={{ color: "#BE185D" }}>${estRevenue.toLocaleString("es-MX", { maximumFractionDigits: 0 })}</div><div className="fmd-kpi-label">Est. revenue</div></div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {events.map((event) => {
          const daysUntil = event.eventDate ? Math.ceil((event.eventDate.getTime() - Date.now()) / 86400000) : null
          return (
            <div key={event.id} className="fmd-box" style={{ marginBottom: 0 }}>
              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "12px", marginBottom: "8px" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                    <span style={{ fontFamily: "monospace", fontSize: "11px", color: "#78716C" }}>{event.eventNumber}</span>
                    <StatusDropdown entityId={event.id} currentStatus={event.status}
                      statuses={[{ value: "quote", label: "Quote" }, { value: "confirmed", label: "Confirmed" }, { value: "in_progress", label: "In progress" }, { value: "completed", label: "Completed" }, { value: "cancelled", label: "Cancelled" }]}
                      apiPath="/api/events/{id}/status" />
                    {daysUntil !== null && daysUntil > 0 && <span className="fmd-flow-step" style={{ background: "#EFF6FF", borderColor: "#BFDBFE", color: "#1E40AF" }}>in {daysUntil} days</span>}
                  </div>
                  <div style={{ fontSize: "14px", fontWeight: 600, color: "#44403C" }}>{event.name}</div>
                  {event.customer && <div style={{ fontSize: "12px", color: "#6B7280" }}>👤 {event.customer.name}</div>}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, auto)", gap: "16px", fontSize: "12px" }}>
                  <div><div style={{ fontSize: "10px", textTransform: "uppercase", color: "#78716C" }}>Date</div><div style={{ fontWeight: 600, color: "#44403C" }}>{event.eventDate ? event.eventDate.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" }) : "—"}</div></div>
                  <div><div style={{ fontSize: "10px", textTransform: "uppercase", color: "#78716C" }}>Guests</div><div style={{ fontWeight: 600, color: "#44403C" }}>{event.guests ?? "—"}</div></div>
                  <div><div style={{ fontSize: "10px", textTransform: "uppercase", color: "#78716C" }}>Bundle</div><div style={{ fontWeight: 600, color: "#44403C" }}>{event._count.orders} orders</div></div>
                </div>
              </div>
              {event.notes && <div style={{ fontSize: "11px", color: "#6B7280", paddingTop: "8px", borderTop: "1px solid #D6D3D1" }}>📝 {event.notes}</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
