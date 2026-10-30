"use client"

// src/app/calendar/calendar-grid.tsx
//
// Client-side month grid. Renders a 5-row × 7-col table of day cells.
// Each cell shows:
//   - Date number (bold)
//   - Rhythm label (PROC / ASSEM / DELIVER / OFF / BLOCKED)
//   - 3px colored strip at bottom if any SeasonMarker is active that day
//
// Cell background color reflects capacity state:
//   - Green (#D1FAE5) = available, minutesUsed < 80% of minutesAvailable
//   - Amber (#FEF3C7) = approaching limit, 80-100%
//   - Red (#FEE2E2) = blocked or >100%
//   - Gray (#F3F4F6) = off day (Sun)

import { useState } from "react"

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
  month: number  // 1-12
  year: number
  blockedMap: Map<string, BlockedDateLite>
  capacityMap: Map<string, CapacityDayLite>
  seasonMarkers: SeasonMarkerLite[]
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
): {
  bg: string
  text: string
  label: string
  isBlocked: boolean
} {
  // Blocked dates always red
  if (blocked) {
    return {
      bg: "#FEE2E2",
      text: "#991B1B",
      label: blocked.notes?.includes("EVENT LOCK") ? "🚫 EVENT LOCK" : "🚫 BLOCKED",
      isBlocked: true,
    }
  }
  // Off day (Sunday) gray
  if (capacity && !capacity.isWorkingDay) {
    return {
      bg: "#F3F4F6",
      text: "#9CA3AF",
      label: "OFF",
      isBlocked: false,
    }
  }
  // Working day — color by utilization
  if (capacity) {
    const utilization = capacity.minutesAvailable > 0
      ? capacity.minutesUsed / capacity.minutesAvailable
      : 0
    if (utilization >= 0.8) {
      return {
        bg: "#FEF3C7",
        text: "#92400E",
        label: capacity.notes?.includes("ASSEM") ? "ASSEM ⚠️" : (capacity.notes ?? RHYTHM_LABELS[capacity.dayOfWeek] ?? "—"),
        isBlocked: false,
      }
    }
    return {
      bg: "#D1FAE5",
      text: "#065F46",
      label: capacity.notes?.includes("PROC")
        ? "PROC"
        : capacity.notes?.includes("ASSEM")
        ? "ASSEM"
        : capacity.notes?.includes("DELIVER")
        ? "DELIVER"
        : RHYTHM_LABELS[capacity.dayOfWeek] ?? "—",
      isBlocked: false,
    }
  }
  // No data — neutral
  return {
    bg: "transparent",
    text: "#9CA3AF",
    label: RHYTHM_LABELS[dayDate.toLocaleDateString("en-US", { weekday: "long" })] ?? "—",
    isBlocked: false,
  }
}

function getActiveMarkers(dayDate: Date, markers: SeasonMarkerLite[]): SeasonMarkerLite[] {
  const dayTime = dayDate.getTime()
  return markers.filter((m) => {
    const start = m.startDate.getTime()
    const end = (m.endDate ?? m.startDate).getTime()
    return dayTime >= start && dayTime <= end + 24 * 60 * 60 * 1000 // include full end day
  })
}

export function CalendarGrid({
  month,
  year,
  blockedMap,
  capacityMap,
  seasonMarkers,
}: CalendarGridProps) {
  const [markersVisible, setMarkersVisible] = useState(true)

  // Compute the days to render. November 2026 starts on Sunday in some locales,
  // but our grid is Mon-Sun. So we need to find the Monday on or before Nov 1.
  // Nov 1, 2026 is a Sunday → grid starts Mon Oct 26? Actually no — Nov 1 2026 is a Sunday,
  // so the first row of Mon-Sun grid starts Monday Oct 26? Wait, that's wrong.
  // Let me think: if Nov 1 is Sunday, then the first full week containing Nov 1 starts
  // Mon Oct 26 (since Oct 26 = Mon, Oct 27 = Tue, ... Nov 1 = Sun).
  // But the wireframe shows Nov 2 (Monday) as the first cell. So we skip the empty cells
  // before Nov 1 and start the grid at Nov 2 (first Monday of November).
  // Wait actually re-checking wireframe: first row is Nov 2-8 (Mon-Sun).
  // So we start at Nov 2, 2026.

  // Build a list of dates for the grid (5 weeks = 35 cells, starting Nov 2 2026)
  const gridDates: Date[] = []
  // Start date: first Monday of November 2026 (Nov 2)
  const startDate = new Date(year, month - 1, 2) // Nov 2, 2026 (month is 0-indexed)
  for (let i = 0; i < 35; i++) {
    const d = new Date(startDate)
    d.setDate(startDate.getDate() + i)
    gridDates.push(d)
  }

  // Find markers active in this month for the legend strip at bottom of each cell
  return (
    <div>
      <table className="w-full border-collapse" style={{ tableLayout: "fixed" }}>
        <thead>
          <tr>
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
              <th
                key={day}
                className="text-center py-2 px-1 text-xs font-semibold text-stone-700 border-b border-stone-200"
              >
                {day}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 5 }).map((_, weekIdx) => (
            <tr key={weekIdx}>
              {gridDates.slice(weekIdx * 7, weekIdx * 7 + 7).map((dayDate) => {
                const key = dateKey(dayDate)
                const blocked = blockedMap.get(key)
                const capacity = capacityMap.get(key)
                const { bg, text, label, isBlocked } = getCellState(dayDate, blocked, capacity)
                const activeMarkers = markersVisible ? getActiveMarkers(dayDate, seasonMarkers) : []
                const isInMonth = dayDate.getMonth() === month - 1

                return (
                  <td
                    key={key}
                    style={{
                      backgroundColor: bg,
                      color: text,
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
                                style={{
                                  height: "3px",
                                  backgroundColor: m.color,
                                  borderRadius: "2px",
                                }}
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
