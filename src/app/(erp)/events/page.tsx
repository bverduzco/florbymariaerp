import { db as prisma } from "@/lib/db"
import { NewEventDialog } from "./new-event-dialog"
import { StatusDropdown } from "@/components/status-dropdown"
import { OrderDetailDialog } from "@/components/order-detail-dialog"
import { serializeOrderForDetail } from "@/lib/order-detail-serializer"

async function getEvents() {
  return prisma.event.findMany({
    include: {
      customer: { select: { name: true, phone: true } },
      _count: { select: { orders: true, lineItems: true } },
      orders: {
        include: {
          customer: { select: { name: true, phone: true, email: true, address: true } },
          event: { select: { eventNumber: true, name: true, eventDate: true } },
          lineItems: {
            select: {
              id: true,
              productSku: true,
              productName: true,
              productSize: true,
              qty: true,
              unitPrice: true,
            },
          },
          executionLogs: {
            select: {
              id: true,
              executionNumber: true,
              status: true,
              executedAt: true,
              actualCost: true,
              lines: {
                select: {
                  materialName: true,
                  qtyUsed: true,
                  unit: true,
                  lineCost: true,
                  type: true,
                },
              },
            },
            orderBy: { executedAt: "desc" },
            take: 5,
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { eventDate: "asc" },
  })
}

export default async function EventsPage() {
  const events = await getEvents()
  const total = events.length
  const upcoming = events.filter((e) => e.eventDate && e.eventDate > new Date()).length
  const estRevenue = events.reduce((s, e) => s + e.orders.reduce((os, o) => os + o.lineItems.reduce((is, l) => is + l.unitPrice * l.qty, 0) + o.deliveryFee, 0), 0)

  // Split into paid vs unpaid (events with a customer = paid, without = unpaid)
  const paidEvents = events.filter((e) => e.customerId !== null)
  const unpaidEvents = events.filter((e) => e.customerId === null)

  return (
    <div>
      <div className="fmd-screen-header">
        <div><h1>Events</h1><div className="fmd-subtitle">Weddings, corporate, demos, photo shoots — both paid and unpaid</div></div>
        <NewEventDialog />
      </div>

      <div className="fmd-kpi-bar">
        <div className="fmd-kpi-cell"><div className="fmd-kpi-value" style={{ color: "#44403C" }}>{total}</div><div className="fmd-kpi-label">Total events</div></div>
        <div className="fmd-kpi-cell"><div className="fmd-kpi-value" style={{ color: "#2563EB" }}>{upcoming}</div><div className="fmd-kpi-label">Upcoming</div></div>
        <div className="fmd-kpi-cell"><div className="fmd-kpi-value" style={{ color: "#BE185D" }}>${estRevenue.toLocaleString("es-MX", { maximumFractionDigits: 0 })}</div><div className="fmd-kpi-label">Est. revenue</div></div>
      </div>

      {/* Two-column: Paid Events + Unpaid Events */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "16px" }}>
        {/* Paid Events */}
        <div className="fmd-box" style={{ marginBottom: 0 }}>
          <div className="fmd-box-label">Paid Events ({paidEvents.length})</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {paidEvents.length === 0 ? (
              <div style={{ textAlign: "center", padding: "16px", color: "#9CA3AF", fontSize: "12px" }}>No paid events.</div>
            ) : (
              paidEvents.map((event) => (
                <EventCard key={event.id} event={event} isPaid={true} />
              ))
            )}
          </div>
        </div>

        {/* Unpaid Events */}
        <div className="fmd-box" style={{ marginBottom: 0 }}>
          <div className="fmd-box-label">Unpaid Events ({unpaidEvents.length})</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {unpaidEvents.length === 0 ? (
              <div style={{ textAlign: "center", padding: "16px", color: "#9CA3AF", fontSize: "12px" }}>No unpaid events.</div>
            ) : (
              unpaidEvents.map((event) => (
                <EventCard key={event.id} event={event} isPaid={false} />
              ))
            )}
          </div>
        </div>
      </div>

      <div className="fmd-note blue" style={{ marginTop: "12px" }}>
        💡 Paid events have a linked customer (weddings, corporate, etc.). Unpaid events are marketing/portfolio (bridal fairs, photo shoots, demos). Both track actual costs — only paid events track margin.
      </div>
    </div>
  )
}

function EventCard({ event, isPaid }: { event: any; isPaid: boolean }) {
  const daysUntil = event.eventDate ? Math.ceil((event.eventDate.getTime() - Date.now()) / 86400000) : null
  const isPast = event.eventDate && event.eventDate < new Date()
  const estRevenue = event.orders.reduce((s: number, o: any) => s + o.lineItems.reduce((is: number, l: any) => is + l.unitPrice * l.qty, 0) + o.deliveryFee, 0)
  const eventType = event.notes?.match(/\[(\w+)\]/)?.[1] ?? "—"

  return (
    <div style={{ background: "#ffffff", border: "1px solid #D6D3D1", borderRadius: "6px", padding: "10px" }}>
      {/* Header: event number + name + status */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "6px" }}>
        <div style={{ fontSize: "13px", fontWeight: 600, color: "#44403C" }}>
          {event.eventNumber} · {event.name}
        </div>
        <StatusDropdown
          entityId={event.id}
          currentStatus={event.status}
          statuses={[
            { value: "quote", label: "Quote" },
            { value: "confirmed", label: "Confirmed" },
            { value: "in_progress", label: "In progress" },
            { value: "completed", label: "Completed" },
            { value: "cancelled", label: "Cancelled" },
          ]}
          apiPath="/api/events/{id}/status"
        />
      </div>

      {/* Fields matching wireframe layout */}
      <div style={{ fontSize: "12px", color: "#6B7280", display: "flex", flexDirection: "column", gap: "3px" }}>
        {/* Date + guests */}
        <div style={{ display: "flex", gap: "8px" }}>
          <span style={{ color: "#78716C" }}>Date:</span>
          <span style={{ color: "#44403C", fontWeight: 500 }}>
            {event.eventDate ? event.eventDate.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
            {event.guests ? ` · Guests: ${event.guests}` : ""}
          </span>
          {daysUntil !== null && daysUntil > 0 && (
            <span className="fmd-status" style={{ background: "#EFF6FF", color: "#1E40AF", marginLeft: "4px" }}>in {daysUntil} days</span>
          )}
          {isPast && <span className="fmd-status" style={{ background: "#F3F4F6", color: "#78716C" }}>past</span>}
        </div>

        {/* Customer (buyer) */}
        {event.customer && (
          <div style={{ display: "flex", gap: "8px" }}>
            <span style={{ color: "#78716C" }}>Customer:</span>
            <span style={{ color: "#44403C" }}>{event.customer.name}</span>
            {event.customer.phone && <span style={{ color: "#78716C" }}>· {event.customer.phone}</span>}
          </div>
        )}

        {/* Honoree — for paid events */}
        {isPaid && (
          <div style={{ display: "flex", gap: "8px" }}>
            <span style={{ color: "#78716C" }}>Honoree:</span>
            <span style={{ color: "#44403C" }}>
              {event.notes?.includes("Honoree:") ? event.notes.match(/Honoree:\s*([^\]]+?)(?:\n|$)/)?.[1]?.trim() : "(same as customer)"}
            </span>
          </div>
        )}

        {/* Payer — for paid events */}
        {isPaid && (
          <div style={{ display: "flex", gap: "8px" }}>
            <span style={{ color: "#78716C" }}>Payer:</span>
            <span style={{ color: "#44403C" }}>(same as customer)</span>
          </div>
        )}

        {/* Event type + Is Paid */}
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <span style={{ color: "#78716C" }}>Type:</span>
          <span style={{ color: "#44403C", textTransform: "capitalize" }}>{eventType}</span>
          <span style={{ color: "#78716C" }}>·</span>
          <span className={`fmd-status ${isPaid ? "accepted" : "expired"}`}>{isPaid ? "Paid" : "Unpaid"}</span>
        </div>

        {/* Est revenue — for paid events */}
        {isPaid && estRevenue > 0 && (
          <div style={{ display: "flex", gap: "8px" }}>
            <span style={{ color: "#78716C" }}>Est. revenue:</span>
            <span style={{ color: "#44403C", fontWeight: 600 }}>${estRevenue.toLocaleString("es-MX", { maximumFractionDigits: 0 })}</span>
            <span style={{ color: "#78716C" }}>· {event._count.orders} order(s)</span>
          </div>
        )}

        {/* Orders sub-section — clickable rows opening OrderDetailDialog */}
        {event.orders.length > 0 && (
          <div style={{ marginTop: "8px", paddingTop: "8px", borderTop: "1px solid #D6D3D1" }}>
            <div style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "1px", color: "#78716C", marginBottom: "4px" }}>
              Orders ({event.orders.length}) — click for details
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
              {event.orders.map((o: any) => {
                const orderTotal = o.lineItems.reduce((s: number, l: any) => s + l.unitPrice * l.qty, 0) + o.deliveryFee
                return (
                  <OrderDetailDialog
                    key={o.id}
                    order={serializeOrderForDetail(o)}
                    trigger={
                      <button
                        className="order-row-hover"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          padding: "4px 8px",
                          fontSize: "11px",
                          background: "#FAFAF9",
                          border: "1px solid #D6D3D1",
                          borderRadius: "4px",
                          color: "#44403C",
                          cursor: "pointer",
                          transition: "background 0.15s, border-color 0.15s",
                          textAlign: "left",
                          width: "100%",
                        }}
                        title={`View details for ${o.orderNumber}`}
                      >
                        <span style={{ fontFamily: "monospace", fontWeight: 600, color: "#44403C" }}>{o.orderNumber}</span>
                        <span style={{ color: "#78716C" }}>·</span>
                        <span style={{ fontWeight: 500 }}>{o.customer?.name ?? "—"}</span>
                        <span style={{ marginLeft: "auto", fontWeight: 600, color: "#BE185D" }}>${orderTotal.toLocaleString("es-MX", { maximumFractionDigits: 0 })}</span>
                        <span className={`fmd-status ${o.status}`} style={{ fontSize: "9px" }}>{o.status.replace(/_/g, " ")}</span>
                      </button>
                    }
                  />
                )
              })}
            </div>
          </div>
        )}

        {/* Purpose — for unpaid events */}
        {!isPaid && event.notes && (
          <div style={{ display: "flex", gap: "8px" }}>
            <span style={{ color: "#78716C" }}>Purpose:</span>
            <span style={{ color: "#44403C" }}>{event.notes.replace(/\[\w+\]/, "").trim() || "Marketing/portfolio"}</span>
          </div>
        )}
      </div>

      {/* Notes */}
      {event.notes && (
        <div style={{ fontSize: "11px", color: "#78716C", marginTop: "6px", paddingTop: "6px", borderTop: "1px solid #D6D3D1", fontStyle: "italic" }}>
          📝 {event.notes.slice(0, 100)}{event.notes.length > 100 ? "..." : ""}
        </div>
      )}
    </div>
  )
}
