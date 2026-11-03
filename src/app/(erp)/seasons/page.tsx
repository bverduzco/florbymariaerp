import { db as prisma } from "@/lib/db"
import { SeasonMarkerDialog } from "./season-marker-dialog"
import { DeleteSeasonButton } from "./delete-season-button"

async function getMarkers() {
  return prisma.seasonMarker.findMany({
    orderBy: [{ startDate: "asc" }],
  })
}

function fmtDate(date: Date): string {
  return date.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })
}

export default async function SeasonsPage() {
  const markers = await getMarkers()

  const byType = markers.reduce((acc, m) => {
    if (!acc[m.type]) acc[m.type] = []
    acc[m.type].push(m)
    return acc
  }, {} as Record<string, typeof markers>)

  const typeEmoji: Record<string, string> = {
    SEASON: "📅",
    HOLIDAY: "🎉",
    TREND: "📈",
  }

  return (
    <div>
      <div className="fmd-screen-header">
        <div>
          <h1>Seasons & Markers</h1>
          <div className="fmd-subtitle">Manage seasons, holidays, and trends that overlay the calendar</div>
        </div>
        <SeasonMarkerDialog
          mode="create"
          trigger={
            <button className="px-4 py-2 text-sm font-medium bg-stone-900 text-white rounded-md hover:bg-stone-800 transition">
              + Add marker
            </button>
          }
        />
      </div>

      {markers.length === 0 ? (
        <div className="fmd-box" style={{ marginBottom: 0 }}>
          <div className="fmd-box-label">No markers yet</div>
          <div style={{ textAlign: "center", padding: "32px", color: "#9CA3AF" }}>
            <div style={{ fontSize: "32px", marginBottom: "8px" }}>📅</div>
            <div style={{ fontSize: "13px" }}>
              No seasons, holidays, or trends configured. Click <b>+ Add marker</b> above to create one.
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {Object.entries(byType).map(([type, items]) => (
            <div key={type} className="fmd-box" style={{ marginBottom: 0 }}>
              <div className="fmd-box-label">
                {typeEmoji[type] ?? "📌"} {type} ({items.length})
              </div>
              <div style={{ overflowX: "auto" }}>
                <table className="fmd-table">
                  <thead>
                    <tr>
                      <th style={{ width: "24px" }}></th>
                      <th>Name</th>
                      <th>Start date</th>
                      <th>End date</th>
                      <th>Intensity</th>
                      <th>Recurrence</th>
                      <th>Description</th>
                      <th style={{ textAlign: "center" }}>Edit</th>
                      <th style={{ textAlign: "center" }}>Delete</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((m) => (
                      <tr key={m.id}>
                        <td>
                          <span
                            className="inline-block w-3 h-3 rounded-full"
                            style={{ backgroundColor: m.color }}
                            title={m.color}
                          />
                        </td>
                        <td style={{ fontWeight: 600, color: "#44403C" }}>{m.name}</td>
                        <td>{fmtDate(m.startDate)}</td>
                        <td style={{ color: m.endDate ? "#78716C" : "#D6D3D1" }}>
                          {m.endDate ? fmtDate(m.endDate) : "—"}
                        </td>
                        <td>
                          {m.intensity ? (
                            <span className={`fmd-status ${m.intensity === "HIGH" ? "cancelled" : m.intensity === "MEDIUM" ? "pending" : "draft"}`}>
                              {m.intensity}
                            </span>
                          ) : (
                            <span style={{ color: "#D6D3D1" }}>—</span>
                          )}
                        </td>
                        <td style={{ fontSize: "11px", color: "#78716C" }}>
                          {m.recurrence === "NONE" ? "—" : m.recurrence.replace(/_/g, " ")}
                        </td>
                        <td style={{ maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "11px", color: "#78716C" }}>
                          {m.description ?? "—"}
                        </td>
                        <td style={{ textAlign: "center", padding: "4px" }}>
                          <SeasonMarkerDialog
                            mode="edit"
                            marker={{
                              id: m.id,
                              markerId: m.markerId,
                              name: m.name,
                              type: m.type,
                              startDate: m.startDate.toISOString(),
                              endDate: m.endDate?.toISOString() ?? null,
                              color: m.color,
                              intensity: m.intensity,
                              description: m.description,
                              recurrence: m.recurrence,
                            }}
                            trigger={
                              <button
                                className="px-2 py-1 text-xs border border-stone-300 rounded hover:bg-stone-900 hover:text-white hover:border-stone-900 transition"
                                title={`Edit ${m.name}`}
                              >
                                ✏️
                              </button>
                            }
                          />
                        </td>
                        <td style={{ textAlign: "center", padding: "4px" }}>
                          <DeleteSeasonButton id={m.id} name={m.name} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="fmd-note blue">
        💡 These markers appear as colored dots on calendar day cells. They are informational only — they never block quotes or orders. Use the Calendar tab to see them in action.
      </div>
    </div>
  )
}
