"use client"

// src/app/calendar/markers-toggle.tsx
//
// Client-side button that toggles the visibility of season/holiday/trend markers
// in the calendar grid. Receives the markers from the server component (read-only
// display of the legend), but the actual show/hide state lives here.

import { useState } from "react"
import { Badge } from "@/components/ui/badge"

interface SeasonMarkerLite {
  markerId: string
  name: string
  type: string
  startDate: Date
  endDate: Date | null
  color: string
  intensity: string | null
}

interface MarkersToggleProps {
  markers: SeasonMarkerLite[]
}

export function MarkersToggle({ markers }: MarkersToggleProps) {
  const [visible, setVisible] = useState(true)

  return (
    <>
      <button
        onClick={() => setVisible(!visible)}
        className={`px-4 py-1.5 text-sm font-medium border rounded-md transition cursor-pointer ${
          visible
            ? "bg-violet-100 border-violet-400 text-violet-800"
            : "bg-white border-stone-300 text-stone-700 hover:bg-stone-50"
        }`}
        title="Show/hide season/holiday/trend overlay"
      >
        🎨 Markers: {visible ? "ON" : "OFF"}
      </button>
      {visible && (
        <div className="w-full mt-2 flex flex-wrap gap-2 text-xs">
          {markers.map((m) => (
            <span
              key={m.markerId}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border"
              style={{
                backgroundColor: `${m.color}22`,
                borderColor: `${m.color}66`,
                color: m.color,
              }}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: m.color }}
              />
              {m.name}
              {m.intensity && (
                <span className="opacity-70">({m.intensity})</span>
              )}
            </span>
          ))}
        </div>
      )}
    </>
  )
}
