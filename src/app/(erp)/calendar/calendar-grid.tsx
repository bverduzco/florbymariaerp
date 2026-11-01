"use client"

// src/app/calendar/calendar-grid.tsx
//
// Client-side month grid. Renders day cells for the selected month.
// markersVisible is now a PROP (read from URL search params by the parent),
// not local state — ensures the MarkersToggle button and grid stay in sync.

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

interface CalendarGridProps {
  month: number
  year: number
  blockedMap: Map<string, BlockedDateLite>
  capacityMap: Map<string, CapacityDayLite>
  seasonMarkers: SeasonMarkerLite[]
  markersVisible: boolean
}

const RHYTHM_LABELS: Record<string, string> = {
  Monday: "—",
  Tuesday: "PROC",
  Wednesday: "—",
  Thursday: "ASSEM",
  Friday: "DELIVER",
  Saturday: "OFF",
  Sunday: "OFF",
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
  month, year, blockedMap, capacityMap, seasonMarkers, markersVisible,
}: CalendarGridProps) {
  // Build grid dates — find the Monday on or before the 1st of the month
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

                return (
                  <td
                    key={key}
                    style={{
                      backgroundColor: isInMonth ? bg : "#FAFAF9",
                      color: isInMonth ? text : "#D6D3D1",
                      height: "56px",
                      border: "1px solid #E5E7EB",
                      padding: "4px",
                      verticalAlign: "top",
                    }}
                    className="align-top"
                  >
                    {isInMonth ? (
                      <div>
                        <div className="font-semibold text-sm">{dayDate.getDate()}</div>
                        <div className="text-xs opacity-80">{label}</div>
                        {activeMarkers.length > 0 && (
                          <div className="mt-1 flex flex-col gap-0.5">
                            {activeMarkers.slice(0, 2).map((m) => (
                              <div
                                key={m.markerId}
                                style={{ height: "3px", backgroundColor: m.color, borderRadius: "2px" }}
                                title={m.name}
                              />
                            ))}
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
    </div>
  )
}
