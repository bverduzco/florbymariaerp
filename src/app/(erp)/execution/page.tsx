import { db as prisma } from "@/lib/db"

async function getLogs() { return prisma.executionLog.findMany({ orderBy: { executedAt: "desc" } }) }

export default async function ExecutionPage() {
  const logs = await getLogs()
  const executed = logs.filter((l) => l.status === "executed").length
  const totalCost = logs.reduce((s, l) => s + (l.actualCost ?? 0), 0)
  const estCost = logs.reduce((s, l) => s + (l.estimatedCost ?? 0), 0)
  const variance = totalCost - estCost

  return (
    <div>
      <div className="fmd-screen-header">
        <div><h1>Execution Logs</h1><div className="fmd-subtitle">What was actually used per job</div></div>
      </div>
      <div className="fmd-kpi-bar">
        <div className="fmd-kpi-cell"><div className="fmd-kpi-value" style={{ color: "#44403C" }}>{logs.length}</div><div className="fmd-kpi-label">Total executions</div></div>
        <div className="fmd-kpi-cell"><div className="fmd-kpi-value" style={{ color: "#047857" }}>{executed}</div><div className="fmd-kpi-label">Executed</div></div>
        <div className="fmd-kpi-cell"><div className="fmd-kpi-value" style={{ color: "#D97706" }}>${totalCost.toLocaleString("es-MX", { maximumFractionDigits: 0 })}</div><div className="fmd-kpi-label">Actual cost</div></div>
        <div className="fmd-kpi-cell"><div className="fmd-kpi-value" style={{ color: variance >= 0 ? "#991B1B" : "#047857" }}>{variance >= 0 ? "+" : "-"}${Math.abs(variance).toLocaleString("es-MX", { maximumFractionDigits: 0 })}</div><div className="fmd-kpi-label">Cost variance</div></div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {logs.map((log) => {
          const isPaid = log.quotedPrice !== null
          const v = (log.actualCost ?? 0) - (log.estimatedCost ?? 0)
          return (
            <div key={log.id} className="fmd-box" style={{ marginBottom: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontFamily: "monospace", fontSize: "12px", fontWeight: 700, color: "#44403C" }}>{log.executionNumber}</span>
                    <span className={`fmd-status ${log.status}`}>{log.status}</span>
                    <span className={`fmd-status ${isPaid ? "accepted" : "expired"}`}>{isPaid ? "💵 Paid" : "🎁 Unpaid demo"}</span>
                  </div>
                  <div style={{ fontSize: "11px", color: "#6B7280", marginTop: "4px" }}>📅 {log.executedAt.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })} · 👤 {log.executedBy ?? "—"}</div>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px", marginTop: "8px" }}>
                <div style={{ textAlign: "center", padding: "6px", borderRadius: "6px", background: "#FAFAF9" }}><div style={{ fontSize: "9px", textTransform: "uppercase", color: "#78716C" }}>Est. cost</div><div style={{ fontSize: "14px", fontWeight: 700, color: "#44403C" }}>${log.estimatedCost?.toLocaleString("es-MX", { maximumFractionDigits: 0 }) ?? "—"}</div></div>
                <div style={{ textAlign: "center", padding: "6px", borderRadius: "6px", background: "#FFFBEB" }}><div style={{ fontSize: "9px", textTransform: "uppercase", color: "#78716C" }}>Actual cost</div><div style={{ fontSize: "14px", fontWeight: 700, color: "#92400E" }}>${log.actualCost?.toLocaleString("es-MX", { maximumFractionDigits: 0 }) ?? "—"}</div></div>
                <div style={{ textAlign: "center", padding: "6px", borderRadius: "6px", background: isPaid ? "#D1FAE5" : "#F3F4F6" }}><div style={{ fontSize: "9px", textTransform: "uppercase", color: "#78716C" }}>Quoted</div><div style={{ fontSize: "14px", fontWeight: 700, color: isPaid ? "#065F46" : "#6B7280" }}>{log.quotedPrice ? `$${log.quotedPrice.toLocaleString("es-MX", { maximumFractionDigits: 0 })}` : "N/A"}</div></div>
                <div style={{ textAlign: "center", padding: "6px", borderRadius: "6px", background: isPaid ? "#FCE7F3" : "#F3F4F6" }}><div style={{ fontSize: "9px", textTransform: "uppercase", color: "#78716C" }}>Margin</div><div style={{ fontSize: "14px", fontWeight: 700, color: isPaid ? "#BE185D" : "#6B7280" }}>{log.marginDollars ? `$${log.marginDollars.toLocaleString("es-MX", { maximumFractionDigits: 0 })}` : "N/A"}</div></div>
              </div>
              {v !== 0 && <div style={{ fontSize: "11px", marginTop: "6px", paddingTop: "6px", borderTop: "1px solid #D6D3D1", color: v > 0 ? "#991B1B" : "#047857" }}>{v > 0 ? "⚠" : "✓"} Cost variance: {v > 0 ? "+" : "-"}${Math.abs(v).toLocaleString("es-MX", { maximumFractionDigits: 2 })}</div>}
              {log.notes && <div style={{ fontSize: "11px", color: "#6B7280", marginTop: "4px", paddingTop: "4px", borderTop: "1px solid #D6D3D1" }}>📝 {log.notes}</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
