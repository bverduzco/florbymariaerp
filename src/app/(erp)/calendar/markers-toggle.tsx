"use client"

import { useRouter, usePathname, useSearchParams } from "next/navigation"
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

/**
 * MarkersToggle — toggles season marker visibility via URL search params.
 *
 * Uses ?markers=on (default) or ?markers=off instead of local React state.
 * This way the CalendarGrid (which is a separate client component) can
 * read the same URL param and show/hide marker strips in sync with this toggle.
 *
 * The legend chips (shown below the button when markers are ON) are rendered
 * in their own row below the button bar, not inline — so they don't push
 * the Block Date button to a new row.
 */
export function MarkersToggle({ markers }: MarkersToggleProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const markersVisible = searchParams.get("markers") !== "off" // default = ON

  function toggle() {
    const params = new URLSearchParams(searchParams.toString())
    if (markersVisible) {
      params.set("markers", "off")
    } else {
      params.delete("markers") // default = on
    }
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <>
      <button
        onClick={toggle}
        className={`px-4 py-1.5 text-sm font-medium border rounded-md transition cursor-pointer ${
          markersVisible
            ? "bg-violet-100 border-violet-400 text-violet-800"
            : "bg-white border-stone-300 text-stone-700 hover:bg-stone-50"
        }`}
        title="Show/hide season/holiday/trend overlay"
      >
        🎨 Markers: {markersVisible ? "ON" : "OFF"}
      </button>
      {markersVisible && markers.length > 0 && (
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
