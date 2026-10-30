import { db as prisma } from "@/lib/db"

async function getLegalData() {
  const [templates, variables] = await Promise.all([
    prisma.legalTemplate.findMany({ orderBy: { templateNumber: "asc" } }),
    prisma.templateVariable.findMany({ orderBy: { placeholder: "asc" } }),
  ])
  return { templates, variables }
}

const APPLY_EMOJI: Record<string, string> = { all_quotes: "📝", small_orders: "📦", event_quotes: "💒", all_customers: "👥" }

export default async function LegalPage() {
  const { templates, variables } = await getLegalData()
  const needNewFields = variables.filter((v) => v.cellOrField?.includes("new field")).length

  return (
    <div>
      <div className="fmd-screen-header"><div><h1>Legal Templates</h1><div className="fmd-subtitle">Privacy notices + terms of service with [PLACEHOLDER] substitution</div></div></div>
      <div className="fmd-kpi-bar">
        <div className="fmd-kpi-cell"><div className="fmd-kpi-value" style={{ color: "#44403C" }}>{templates.length}</div><div className="fmd-kpi-label">Templates</div></div>
        <div className="fmd-kpi-cell"><div className="fmd-kpi-value" style={{ color: "#BE185D" }}>{variables.length}</div><div className="fmd-kpi-label">Placeholders</div></div>
        <div className="fmd-kpi-cell"><div className="fmd-kpi-value" style={{ color: "#D97706" }}>{needNewFields}</div><div className="fmd-kpi-label">Need new fields</div></div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {templates.map((t) => {
          const placeholders = t.placeholdersNeeded?.split(",").map((p) => p.trim()).filter(Boolean) ?? []
          return (
            <div key={t.id} className="fmd-box" style={{ marginBottom: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px", paddingBottom: "8px", borderBottom: "1px solid #D6D3D1" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontFamily: "monospace", fontSize: "11px", color: "#78716C" }}>{t.templateNumber}</span>
                    <span className="fmd-status" style={{ background: "#F3F4F6", color: "#44403C" }}>{APPLY_EMOJI[t.appliesTo] ?? "📄"} {t.appliesTo.replace(/_/g, " ")}</span>
                    <span className="fmd-status" style={{ background: "#F3F4F6", color: "#44403C" }}>{t.version}</span>
                  </div>
                  <div style={{ fontSize: "14px", fontWeight: 600, color: "#44403C", marginTop: "4px" }}>{t.name}</div>
                  <div style={{ fontSize: "11px", color: "#6B7280" }}>📍 {t.trigger}</div>
                </div>
                <div style={{ fontSize: "11px", color: "#78716C" }}>{t.lastUpdated.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}</div>
              </div>
              <div style={{ background: "#FAFAF9", border: "1px solid #D6D3D1", borderRadius: "6px", padding: "10px", marginBottom: "8px", maxHeight: "150px", overflow: "hidden", fontSize: "11px", color: "#6B7280", whiteSpace: "pre-wrap" }}>
                {t.templateText.slice(0, 400)}{t.templateText.length > 400 && <span style={{ color: "#D6D3D1", fontStyle: "italic" }}>... ({t.templateText.length - 400} more chars)</span>}
              </div>
              {placeholders.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                  {placeholders.map((p) => <span key={p} className="fmd-status" style={{ background: "#FCE7F3", color: "#BE185D", fontFamily: "monospace" }}>[{p}]</span>)}
                </div>
              )}
            </div>
          )
        })}
      </div>
      <div className="fmd-box">
        <div className="fmd-box-label">Template Variables — Placeholder → Data Source</div>
        <div style={{ overflowX: "auto" }}>
          <table className="fmd-table">
            <thead><tr><th>Placeholder</th><th>Source</th><th>Sheet</th><th>Cell / Field</th><th>Notes</th></tr></thead>
            <tbody>
              {variables.map((v) => (
                <tr key={v.id}>
                  <td style={{ fontFamily: "monospace", fontSize: "11px", color: "#BE185D" }}>{v.placeholder}</td>
                  <td>{v.dataSource}</td>
                  <td>{v.sheet ?? "—"}</td>
                  <td style={{ fontFamily: "monospace", fontSize: "11px" }}>{v.cellOrField}{v.cellOrField?.includes("new field") && <span className="fmd-status pending" style={{ marginLeft: "4px" }}>needed</span>}</td>
                  <td style={{ maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.notes ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
