// src/app/calendar/page.tsx
//
// Calendar screen — matches the v1.8.1 wireframe.
// Pulls live data from Prisma:
//   - BlockedDate (system + Maria's blocks)
//   - CapacityDay (per-day labor minutes + cooler slots)
//   - SeasonMarker (informational overlay)
//
// Layout (top to bottom):
//   1. Screen header (title + subtitle)
//   2. Horizontal compact summary bar (5 KPIs)
//   3. Action button row (Month picker + Markers toggle + Block Date)
//   4. Season markers legend (pill chips, toggleable)
//   5. Month grid (Mon-Sun, colored day cells with rhythm labels)
//   6. Order schedule (auto-computed pipeline + conflict flags)
//   7. Weekly rhythm table
//
// Markers toggle is a real client-side toggle (hidden via state).

import { db as prisma } from "@/lib/db"
import { CalendarGrid } from "./calendar-grid"
import { MarkersToggle } from "./markers-toggle"
import { BlockDateDialog } from "./block-date-dialog"

// Server-side data fetch — runs once per page load
async function getCalendarData() {
  const [blockedDates, capacityDays, seasonMarkers, quotes] = await Promise.all([
    prisma.blockedDate.findMany({
      where: { date: { gte: new Date("2026-11-01"), lt: new Date("2026-12-01") } },
      orderBy: { date: "asc" },
    }),
    prisma.capacityDay.findMany({
      where: { date: { gte: new Date("2026-11-01"), lt: new Date("2026-12-01") } },
      orderBy: { date: "asc" },
    }),
    prisma.seasonMarker.findMany({ orderBy: { markerId: "asc" } }),
    prisma.quote.findMany({
      where: { status: { in: ["accepted", "sent", "negotiating"] } },
      include: { lines: true },
      orderBy: { eventDate: "asc" },
    }),
  ])
  return { blockedDates, capacityDays, seasonMarkers, quotes }
}

export default async function CalendarPage() {
  const { blockedDates, capacityDays, seasonMarkers, quotes } = await getCalendarData()

  // Compute KPIs for the horizontal summary bar
  const totalLaborMin = capacityDays
    .filter((d) => d.isWorkingDay)
    .reduce((sum, d) => sum + d.minutesAvailable, 0)
  const avgLaborPerDay = capacityDays.filter((d) => d.isWorkingDay).length > 0
    ? Math.round(totalLaborMin / capacityDays.filter((d) => d.isWorkingDay).length)
    : 0
  const coolerHardLimit = 5
  const coolerSlotsUsedThisWeek = capacityDays
    .slice(0, 7)
    .reduce((max, d) => Math.max(max, d.coolerSlotsUsed), 0)
  const blockedCount = blockedDates.length
  const activeMarkers = seasonMarkers.filter((m) => {
    const start = m.startDate
    const end = m.endDate ?? m.startDate
    const monthStart = new Date("2026-11-01")
    const monthEnd = new Date("2026-11-30")
    return start <= monthEnd && end >= monthStart
  }).length

  // Build lookup maps for the grid
  const blockedMap = new Map(blockedDates.map((b) => [b.date.toISOString().slice(0, 10), b]))
  const capacityMap = new Map(capacityDays.map((c) => [c.date.toISOString().slice(0, 10), c]))

  // Order schedule — derived from quotes with delivery dates
  const orderSchedule = quotes
    .filter((q) => q.eventDate)
    .map((q) => {
      const deliveryDate = q.eventDate!
      const procurementDate = new Date(deliveryDate)
      procurementDate.setDate(deliveryDate.getDate() - 3)
      const assemblyDate = new Date(deliveryDate)
      assemblyDate.setDate(deliveryDate.getDate() - 1)
      const laborMin = q.lines.reduce((s, l) => s + l.qty * 30, 0)
      const cooler = Math.min(5, Math.ceil(q.lines.reduce((s, l) => s + l.qty, 0) / 2))
      const procKey = procurementDate.toISOString().slice(0, 10)
      const delKey = deliveryDate.toISOString().slice(0, 10)
      const dateConflict = Boolean(blockedMap.get(procKey)) || Boolean(blockedMap.get(delKey))
      return {
        id: q.quoteNumber,
        customer: q.customerName ?? "—",
        type: q.eventType ?? "—",
        deliveryDate,
        procurementDate,
        assemblyDate,
        laborMin,
        cooler,
        dateConflict,
        total: q.total,
      }
    })

  return (
    <div>
        <div className="fmd-screen-header">
          <div>
            <h1>Calendar</h1>
            <div className="fmd-subtitle">Capacity + season/holiday/trend overlay · v1.8.1</div>
          </div>
        </div>

        {/* ─── Horizontal compact summary bar ─── */}
        <div className="fmd-kpi-bar">
          <div className="fmd-kpi-cell">
            <div className="fmd-kpi-value" style={{ color: "#44403C" }}>{avgLaborPerDay} <span style={{ fontSize: "11px", color: "#78716C" }}>min/day</span></div>
            <div className="fmd-kpi-label">Labor cap · Tue=360</div>
          </div>
          <div className="fmd-kpi-cell">
            <div className="fmd-kpi-value" style={{ color: "#44403C" }}>{coolerHardLimit} <span style={{ fontSize: "11px", color: "#78716C" }}>slots</span></div>
            <div className="fmd-kpi-label">Cooler hard limit</div>
          </div>
          <div className="fmd-kpi-cell">
            <div className="fmd-kpi-value" style={{ color: "#047857" }}>{coolerSlotsUsedThisWeek}/{coolerHardLimit} <span style={{ fontSize: "11px", color: "#78716C" }}>used</span></div>
            <div className="fmd-kpi-label">Cooler this week</div>
          </div>
          <div className="fmd-kpi-cell">
            <div className="fmd-kpi-value" style={{ color: "#D97706" }}>{blockedCount} <span style={{ fontSize: "11px", color: "#78716C" }}>blocked</span></div>
            <div className="fmd-kpi-label">This month</div>
          </div>
          <div className="fmd-kpi-cell">
            <div className="fmd-kpi-value" style={{ color: "#BE185D" }}>{activeMarkers} <span style={{ fontSize: "11px", color: "#78716C" }}>markers</span></div>
            <div className="fmd-kpi-label">Active this month</div>
          </div>
        </div>

        {/* ─── Action button row ─── */}
        <div className="flex flex-wrap gap-2 mb-3 items-center">
          <button className="px-4 py-1.5 text-sm font-medium border border-stone-300 rounded-md bg-white hover:bg-stone-50 transition">
            November 2026 ▾
          </button>
          <MarkersToggle markers={seasonMarkers} />
          <BlockDateDialog />
        </div>

        {/* ─── Month grid ─── */}
        <div className="fmd-box">
          <div className="fmd-box-label">November 2026 — Month Grid</div>
            <CalendarGrid
              month={11}
              year={2026}
              blockedMap={blockedMap}
              capacityMap={capacityMap}
              seasonMarkers={seasonMarkers}
            />
            <div className="mt-4 text-xs text-stone-500 leading-relaxed">
              <span className="text-green-700">🟢 Green</span> = available ·{" "}
              <span className="text-amber-700">🟡 Yellow</span> = approaching limit ·{" "}
              <span className="text-red-700">🔴 Red</span> = blocked ·{" "}
              <span className="text-stone-500">⬜ Gray</span> = off day
              <br />
              <strong>Purple strip</strong> = active SeasonMarker (Wedding Season Oct–Feb).
              Click any date → see details, markers, or block it.
            </div>
        </div>

        {/* ─── Order schedule ─── */}
        <div className="fmd-box">
          <div className="fmd-box-label">Order Schedule — Pipeline &amp; Conflict Flags</div>
            <div style={{ overflowX: "auto" }}>
              <table className="fmd-table">
                <thead>
                  <tr>
                    <th>Quote</th>
                    <th>Customer</th>
                    <th>Type</th>
                    <th>Delivery</th>
                    <th>Procurement</th>
                    <th>Assembly</th>
                    <th style={{ textAlign: "right" }}>Labor min</th>
                    <th style={{ textAlign: "right" }}>Cooler</th>
                    <th>Conflict</th>
                    <th style={{ textAlign: "right" }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {orderSchedule.length === 0 ? (
                    <tr><td colSpan={10} style={{ textAlign: "center", padding: "16px", color: "#9CA3AF" }}>No active quotes with delivery dates.</td></tr>
                  ) : (
                    orderSchedule.map((o) => (
                      <tr key={o.id}>
                        <td style={{ fontFamily: "monospace", fontSize: "11px" }}>{o.id}</td>
                        <td style={{ color: "#44403C" }}>{o.customer}</td>
                        <td style={{ textTransform: "capitalize" }}>{o.type}</td>
                        <td>{o.deliveryDate.toLocaleDateString("es-MX", { day: "2-digit", month: "short" })}</td>
                        <td style={{ color: "#78716C" }}>{o.procurementDate.toLocaleDateString("es-MX", { day: "2-digit", month: "short" })}</td>
                        <td style={{ color: "#78716C" }}>{o.assemblyDate.toLocaleDateString("es-MX", { day: "2-digit", month: "short" })}</td>
                        <td style={{ textAlign: "right" }}>{o.laborMin}</td>
                        <td style={{ textAlign: "right" }}>{o.cooler}</td>
                        <td>{o.dateConflict ? <span className="fmd-status cancelled">⚠ Conflict</span> : <span style={{ color: "#D6D3D1" }}>OK</span>}</td>
                        <td style={{ textAlign: "right", fontWeight: 600, color: "#44403C" }}>${o.total.toLocaleString("es-MX", { maximumFractionDigits: 0 })}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="fmd-note blue" style={{ marginTop: "8px" }}>
              📅 Pipeline: Procurement = Delivery − 3 days · Assembly = Delivery − 1 day · Conditioning same day as Procurement.<br />
              ⚠️ Shopping List WARNS (doesn&apos;t block) when capacity exceeded or dates are near blocked.
            </div>
        </div>

        {/* ─── Weekly rhythm ─── */}
        <div className="fmd-box">
          <div className="fmd-box-label">Weekly Rhythm</div>
            <table className="fmd-table">
              <thead>
                <tr>
                  <th>Day</th>
                  <th>Activity</th>
                  <th style={{ textAlign: "right" }}>Minutes</th>
                  <th style={{ textAlign: "right" }}>Cooler</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Monday", "Ordering + admin", "240 (4 hrs)", "5 slots"],
                  ["Tuesday", "Procurement + Conditioning (heavy day)", "360 (6 hrs)", "5 slots"],
                  ["Wednesday", "Idle (flowers hydrating in cooler)", "240 (4 hrs)", "5 slots"],
                  ["Thursday", "Assembly", "240 (4 hrs)", "5 slots"],
                  ["Friday", "Assembly finishing + delivery", "240 (4 hrs)", "5 slots"],
                  ["Saturday", "Event day / Off", "240 (if event) / 0 (off)", "5 slots"],
                  ["Sunday", "OFF (auto-blocked)", "0", "0"],
                ].map(([day, activity, minutes, cooler], idx) => (
                  <tr key={day} style={idx === 6 ? { color: "#991B1B" } : {}}>
                    <td style={{ fontWeight: 600 }}>{day}</td>
                    <td>{activity}</td>
                    <td style={{ textAlign: "right" }}>{minutes}</td>
                    <td style={{ textAlign: "right" }}>{cooler}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        <div className="fmd-note" style={{ marginTop: "8px" }}>
          <strong>EVENT LOCKOUT RULE:</strong> When an event is on Saturday, the system auto-blocks Friday + Saturday + Sunday (Option A). No other orders can be scheduled on those days. Procurement for the event happens on the preceding Tuesday.<br />
          <strong style={{ marginTop: "4px", display: "inline-block" }}>v1.8.1 ADDITION:</strong> SeasonMarkers are informational only. They never block quotes, never trigger hard warnings. They only tint calendar day cells and optionally surface yellow hint banners in the Shopping List when a HIGH-intensity HOLIDAY overlaps the procurement window.
        </div>
    </div>
  )
}
