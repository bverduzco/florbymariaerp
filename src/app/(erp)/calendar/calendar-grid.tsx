"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

interface BlockedDateLite {
  date: Date
  reason: string
  notes: string | null
  blockedBy: string
}

interface CapacityDayLite {
  date: Date
  dayOfWeek: string
  isWorkingDay: boolean
  isProcurementDay: boolean
  minutesAvailable: number
  minutesUsed: number
  coolerSlotsUsed: number
  notes: string | null
}

interface SeasonMarkerLite {
  markerId: string
  name: string
  type: string
  startDate: Date
  endDate: Date | null
  color: string
  intensity: string | null
}

interface OrderScheduleLite {
  id: string
  customer: string
  type: string
  deliveryDate: Date
  procurementDate: Date
  assemblyDate: Date
  laborMin: number
  cooler: number
  dateConflict: boolean
  total: number
}

interface CalendarGridProps {
  month: number
  year: number
  blockedMap: Map<string, BlockedDateLite>
  capacityMap: Map<string, CapacityDayLite>
  seasonMarkers: SeasonMarkerLite[]
  markersVisible: boolean
  orderSchedule?: OrderScheduleLite[]
}

const RHYTHM_LABELS: Record<string, string> = {
  Monday: "—", Tuesday: "PROC", Wednesday: "—", Thursday: "ASSEM",
  Friday: "DELIVER", Saturday: "OFF", Sunday: "OFF",
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function getCellState(
  dayDate: Date,
  blocked: BlockedDateLite | undefined,
  capacity: CapacityDayLite | undefined,
): { bg: string; text: string; label: string; isBlocked: boolean } {
  if (blocked) {
    return {
      bg: "#FEE2E2", text: "#991B1B",
      label: blocked.notes?.includes("EVENT LOCK") ? "🚫 EVENT LOCK" : "🚫 BLOCKED",
      isBlocked: true,
    }
  }
  if (capacity && !capacity.isWorkingDay) {
    return { bg: "#F3F4F6", text: "#9CA3AF", label: "OFF", isBlocked: false }
  }
  if (capacity) {
    const utilization = capacity.minutesAvailable > 0
      ? capacity.minutesUsed / capacity.minutesAvailable : 0
    if (utilization >= 0.8) {
      return {
        bg: "#FEF3C7", text: "#92400E",
        label: capacity.notes?.includes("ASSEM") ? "ASSEM ⚠️" : (capacity.notes ?? RHYTHM_LABELS[capacity.dayOfWeek] ?? "—"),
        isBlocked: false,
      }
    }
    return {
      bg: "#D1FAE5", text: "#065F46",
      label: capacity.notes?.includes("PROC") ? "PROC"
        : capacity.notes?.includes("ASSEM") ? "ASSEM"
        : capacity.notes?.includes("DELIVER") ? "DELIVER"
        : RHYTHM_LABELS[capacity.dayOfWeek] ?? "—",
      isBlocked: false,
    }
  }
  return {
    bg: "transparent", text: "#9CA3AF",
    label: RHYTHM_LABELS[dayDate.toLocaleDateString("en-US", { weekday: "long" })] ?? "—",
    isBlocked: false,
  }
}

function getActiveMarkers(dayDate: Date, markers: SeasonMarkerLite[]): SeasonMarkerLite[] {
  const dayTime = dayDate.getTime()
  return markers.filter((m) => {
    const start = m.startDate.getTime()
    const end = (m.endDate ?? m.startDate).getTime()
    return dayTime >= start && dayTime <= end + 24 * 60 * 60 * 1000
  })
}

export function CalendarGrid({
  month, year, blockedMap, capacityMap, seasonMarkers, markersVisible, orderSchedule = [],
}: CalendarGridProps) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)

  // Build grid dates
  const gridDates: Date[] = []
  const startDate = new Date(year, month - 1, 1)
  const firstDayOfWeek = startDate.getDay()
  const mondayOffset = firstDayOfWeek === 0 ? -6 : 1 - firstDayOfWeek
  const gridStart = new Date(startDate)
  gridStart.setDate(startDate.getDate() + mondayOffset)
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart)
    d.setDate(gridStart.getDate() + i)
    gridDates.push(d)
  }

  // Build a map of orders by date key (delivery, procurement, assembly)
  const ordersByDate = new Map<string, Array<{ order: OrderScheduleLite; role: string }>>()
  for (const o of orderSchedule) {
    const dates = [
      { date: o.deliveryDate, role: "Delivery" },
      { date: o.procurementDate, role: "Procurement" },
      { date: o.assemblyDate, role: "Assembly" },
    ]
    for (const { date, role } of dates) {
      const key = dateKey(date)
      if (!ordersByDate.has(key)) ordersByDate.set(key, [])
      ordersByDate.get(key)!.push({ order: o, role })
    }
  }

  // Selected day details
  const selectedKey = selectedDate ? dateKey(selectedDate) : null
  const selectedBlocked = selectedKey ? blockedMap.get(selectedKey) : null
  const selectedCapacity = selectedKey ? capacityMap.get(selectedKey) : null
  const selectedOrders = selectedKey ? ordersByDate.get(selectedKey) ?? [] : []
  const selectedMarkers = selectedDate ? getActiveMarkers(selectedDate, seasonMarkers) : []

  return (
    <div>
      <table className="w-full border-collapse" style={{ tableLayout: "fixed" }}>
        <thead>
          <tr>
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
              <th key={day} className="text-center py-2 px-1 text-xs font-semibold text-stone-700 border-b border-stone-200">
                {day}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 6 }).map((_, weekIdx) => (
            <tr key={weekIdx}>
              {gridDates.slice(weekIdx * 7, weekIdx * 7 + 7).map((dayDate) => {
                const key = dateKey(dayDate)
                const blocked = blockedMap.get(key)
                const capacity = capacityMap.get(key)
                const { bg, text, label } = getCellState(dayDate, blocked, capacity)
                const activeMarkers = markersVisible ? getActiveMarkers(dayDate, seasonMarkers) : []
                const isInMonth = dayDate.getMonth() === month - 1
                const dayOrders = ordersByDate.get(key) ?? []

                return (
                  <td
                    key={key}
                    onClick={() => isInMonth && setSelectedDate(dayDate)}
                    style={{
                      backgroundColor: isInMonth ? bg : "#FAFAF9",
                      color: isInMonth ? text : "#D6D3D1",
                      height: "56px",
                      border: "1px solid #E5E7EB",
                      padding: "4px",
                      verticalAlign: "top",
                      cursor: isInMonth ? "pointer" : "default",
                    }}
                    className="align-top"
                  >
                    {isInMonth ? (
                      <div>
                        <div className="font-semibold text-sm">{dayDate.getDate()}</div>
                        <div className="text-xs opacity-80">{label}</div>
                        {dayOrders.length > 0 && (
                          <div className="text-[9px] mt-0.5 font-semibold" style={{ color: "#BE185D" }}>
                            {dayOrders.length} job{dayOrders.length !== 1 ? "s" : ""}
                          </div>
                        )}
                        {activeMarkers.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-0.5 items-center">
                            {activeMarkers.slice(0, 4).map((m) => (
                              <span
                                key={m.markerId}
                                className="inline-block w-2 h-2 rounded-full"
                                style={{ backgroundColor: m.color }}
                                title={m.name}
                              />
                            ))}
                            {activeMarkers.length > 4 && (
                              <span className="text-[8px] text-stone-400 ml-0.5">+{activeMarkers.length - 4}</span>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-stone-300 text-sm">{dayDate.getDate()}</div>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Day detail dialog */}
      <Dialog open={!!selectedDate} onOpenChange={(v) => !v && setSelectedDate(null)}>
        <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedDate?.toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </DialogTitle>
          </DialogHeader>

          {selectedDate && (
            <div className="space-y-3 text-sm">
              {/* Blocked status */}
              {selectedBlocked ? (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                  <div className="font-semibold text-red-800">🚫 Blocked — {selectedBlocked.reason}</div>
                  <div className="text-xs text-red-600 mt-1">
                    Blocked by: {selectedBlocked.blockedBy}
                    {selectedBlocked.notes && ` · ${selectedBlocked.notes}`}
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-md">
                  <div className="font-semibold text-emerald-800">✓ Available</div>
                </div>
              )}

              {/* Capacity */}
              {selectedCapacity && (
                <div className="p-3 border border-stone-200 rounded-md">
                  <div className="text-xs uppercase tracking-wider text-stone-500 mb-2">Capacity</div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-stone-500">Working day:</span>{" "}
                      <span className="font-semibold">{selectedCapacity.isWorkingDay ? "Yes" : "No"}</span>
                    </div>
                    <div>
                      <span className="text-stone-500">Procurement day:</span>{" "}
                      <span className="font-semibold">{selectedCapacity.isProcurementDay ? "Yes" : "No"}</span>
                    </div>
                    <div>
                      <span className="text-stone-500">Labor:</span>{" "}
                      <span className="font-semibold">{selectedCapacity.minutesUsed}/{selectedCapacity.minutesAvailable} min</span>
                    </div>
                    <div>
                      <span className="text-stone-500">Cooler:</span>{" "}
                      <span className="font-semibold">{selectedCapacity.coolerSlotsUsed}/5 slots</span>
                    </div>
                  </div>
                  {selectedCapacity.notes && (
                    <div className="text-xs text-stone-500 mt-2">📝 {selectedCapacity.notes}</div>
                  )}
                </div>
              )}

              {/* Orders/jobs */}
              {selectedOrders.length > 0 ? (
                <div className="p-3 border border-stone-200 rounded-md">
                  <div className="text-xs uppercase tracking-wider text-stone-500 mb-2">
                    Jobs ({selectedOrders.length})
                  </div>
                  <div className="space-y-2">
                    {selectedOrders.map(({ order, role }, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                          role === "Delivery" ? "bg-rose-100 text-rose-700"
                          : role === "Procurement" ? "bg-blue-100 text-blue-700"
                          : "bg-amber-100 text-amber-700"
                        }`}>
                          {role}
                        </span>
                        <span className="font-mono font-semibold">{order.id}</span>
                        <span className="text-stone-600">{order.customer}</span>
                        <span className="ml-auto font-semibold">${order.total.toLocaleString("es-MX", { maximumFractionDigits: 0 })}</span>
                        {order.dateConflict && <span className="text-red-600">⚠</span>}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                !selectedBlocked && (
                  <div className="text-xs text-stone-400 text-center py-2">No jobs scheduled for this day.</div>
                )
              )}

              {/* Season markers */}
              {selectedMarkers.length > 0 && (
                <div className="p-3 border border-stone-200 rounded-md">
                  <div className="text-xs uppercase tracking-wider text-stone-500 mb-2">Season Markers</div>
                  <div className="flex flex-wrap gap-2">
                    {selectedMarkers.map((m) => (
                      <span
                        key={m.markerId}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs"
                        style={{ backgroundColor: `${m.color}22`, borderColor: `${m.color}66`, color: m.color }}
                      >
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: m.color }} />
                        {m.name} ({m.type})
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
