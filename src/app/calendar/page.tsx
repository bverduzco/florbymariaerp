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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CalendarGrid } from "./calendar-grid"
import { MarkersToggle } from "./markers-toggle"

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
    <main className="min-h-screen bg-stone-50 px-6 py-10">
      <div className="mx-auto max-w-6xl">
        {/* ─── Screen header ─── */}
        <header className="mb-6">
          <div className="text-xs uppercase tracking-wider text-stone-500">
            Capacity + season/holiday/trend overlay · v1.8.1
          </div>
          <h1 className="mt-1 text-3xl font-bold text-stone-900">Calendar</h1>
        </header>

        {/* ─── Horizontal compact summary bar ─── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-0 mb-4 border border-stone-200 rounded-lg overflow-hidden bg-white">
          <KpiCell
            value={`${avgLaborPerDay}`}
            unit="min/day"
            label={`Labor cap · Tue=360`}
          />
          <KpiCell
            value={`${coolerHardLimit}`}
            unit="slots"
            label="Cooler hard limit"
          />
          <KpiCell
            value={`${coolerSlotsUsedThisWeek}/${coolerHardLimit}`}
            unit="used"
            label="Cooler this week"
            color="green"
          />
          <KpiCell
            value={`${blockedCount}`}
            unit="blocked"
            label="This month"
            color="amber"
          />
          <KpiCell
            value={`${activeMarkers}`}
            unit="markers"
            label="Active this month"
            color="purple"
          />
        </div>

        {/* ─── Action button row ─── */}
        <div className="flex flex-wrap gap-2 mb-3 items-center">
          <button className="px-4 py-1.5 text-sm font-medium border border-stone-300 rounded-md bg-white hover:bg-stone-50 transition">
            November 2026 ▾
          </button>
          <MarkersToggle markers={seasonMarkers} />
          <button className="px-4 py-1.5 text-sm font-medium bg-amber-500 text-white border border-amber-600 rounded-md hover:bg-amber-600 transition">
            🚫 Block Date
          </button>
        </div>

        {/* ─── Month grid ─── */}
        <Card className="mb-6 border-stone-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">November 2026 — Month Grid</CardTitle>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>

        {/* ─── Order schedule ─── */}
        <Card className="mb-6 border-stone-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Order Schedule — Pipeline &amp; Conflict Flags</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-200 text-stone-600 text-xs uppercase tracking-wider">
                    <th className="text-left py-2 px-3">Quote</th>
                    <th className="text-left py-2 px-3">Customer</th>
                    <th className="text-left py-2 px-3">Type</th>
                    <th className="text-left py-2 px-3">Delivery</th>
                    <th className="text-left py-2 px-3">Procurement</th>
                    <th className="text-left py-2 px-3">Assembly</th>
                    <th className="text-right py-2 px-3">Labor min</th>
                    <th className="text-right py-2 px-3">Cooler</th>
                    <th className="text-left py-2 px-3">Conflict</th>
                    <th className="text-right py-2 px-3">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {orderSchedule.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-6 text-center text-stone-400 text-sm">
                        No active quotes with delivery dates.
                      </td>
                    </tr>
                  ) : (
                    orderSchedule.map((o) => (
                      <tr key={o.id} className="border-b border-stone-100 hover:bg-stone-50">
                        <td className="py-2 px-3 font-mono text-xs">{o.id}</td>
                        <td className="py-2 px-3">{o.customer}</td>
                        <td className="py-2 px-3 capitalize">{o.type}</td>
                        <td className="py-2 px-3">{o.deliveryDate.toLocaleDateString("es-MX", { day: "2-digit", month: "short" })}</td>
                        <td className="py-2 px-3 text-stone-500">{o.procurementDate.toLocaleDateString("es-MX", { day: "2-digit", month: "short" })}</td>
                        <td className="py-2 px-3 text-stone-500">{o.assemblyDate.toLocaleDateString("es-MX", { day: "2-digit", month: "short" })}</td>
                        <td className="py-2 px-3 text-right">{o.laborMin}</td>
                        <td className="py-2 px-3 text-right">{o.cooler}</td>
                        <td className="py-2 px-3">
                          {o.dateConflict ? (
                            <Badge variant="destructive" className="text-xs">⚠ Conflict</Badge>
                          ) : (
                            <span className="text-stone-400 text-xs">OK</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right font-medium">
                          ${o.total.toLocaleString("es-MX", { maximumFractionDigits: 0 })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="mt-3 text-xs text-stone-500">
              📅 Pipeline: Procurement = Delivery − 3 days · Assembly = Delivery − 1 day · Conditioning same day as Procurement.
              <br />
              ⚠️ Shopping List WARNS (doesn&apos;t block) when capacity exceeded or dates are near blocked.
            </div>
          </CardContent>
        </Card>

        {/* ─── Weekly rhythm ─── */}
        <Card className="border-stone-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Weekly Rhythm</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-stone-600 text-xs uppercase tracking-wider">
                  <th className="text-left py-2 px-3">Day</th>
                  <th className="text-left py-2 px-3">Activity</th>
                  <th className="text-right py-2 px-3">Minutes</th>
                  <th className="text-right py-2 px-3">Cooler</th>
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
                  <tr
                    key={day}
                    className={`border-b border-stone-100 hover:bg-stone-50 ${idx === 6 ? "text-red-700" : ""}`}
                  >
                    <td className="py-2 px-3 font-medium">{day}</td>
                    <td className="py-2 px-3">{activity}</td>
                    <td className="py-2 px-3 text-right">{minutes}</td>
                    <td className="py-2 px-3 text-right">{cooler}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <div className="mt-6 text-xs text-stone-500 leading-relaxed">
          <strong>EVENT LOCKOUT RULE:</strong> When an event is on Saturday, the system auto-blocks Friday + Saturday + Sunday (Option A). No other orders can be scheduled on those days. Procurement for the event happens on the preceding Tuesday.
          <br />
          <strong className="mt-2 inline-block">v1.8.1 ADDITION:</strong> SeasonMarkers are informational only. They never block quotes, never trigger hard warnings. They only tint calendar day cells and optionally surface yellow hint banners in the Shopping List when a HIGH-intensity HOLIDAY overlaps the procurement window.
        </div>
      </div>
    </main>
  )
}

// ─── KPI Cell (horizontal summary bar segment) ─────────────────────────
function KpiCell({
  value,
  unit,
  label,
  color = "default",
}: {
  value: string
  unit: string
  label: string
  color?: "default" | "green" | "amber" | "purple"
}) {
  const colorMap = {
    default: "text-stone-900",
    green: "text-emerald-700",
    amber: "text-amber-700",
    purple: "text-violet-700",
  }
  return (
    <div className="p-3 border-r border-stone-200 last:border-r-0 min-w-[120px]">
      <div className={`text-xl font-bold ${colorMap[color]}`}>
        {value} <span className="text-xs font-medium text-stone-400">{unit}</span>
      </div>
      <div className="text-xs text-stone-500 mt-0.5">{label}</div>
    </div>
  )
}
