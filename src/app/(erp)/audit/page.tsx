export const dynamic = "force-dynamic"

import { db as prisma } from "@/lib/db"

async function getAuditLogs(entityType?: string, limit = 100) {
  try {
    const where = entityType && entityType !== "all" ? { entityType } : {}
    return await prisma.auditLog.findMany({
      where,
      orderBy: { changedAt: "desc" },
      take: limit,
    })
  } catch {
    return []
  }
}

async function getEntityTypes() {
  try {
    const result = await prisma.auditLog.findMany({
      select: { entityType: true },
      distinct: ["entityType"],
      orderBy: { entityType: "asc" },
    })
    return result.map((r) => r.entityType)
  } catch {
    return []
  }
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>
}) {
  const params = await searchParams
  const filterType = params.type ?? "all"

  const [logs, entityTypes] = await Promise.all([
    getAuditLogs(filterType, 200),
    getEntityTypes(),
  ])

  // Action badge colors
  const actionColors: Record<string, { bg: string; color: string }> = {
    create: { bg: "#D1FAE5", color: "#065F46" },
    update: { bg: "#E0E7FF", color: "#3730A3" },
    delete: { bg: "#FEE2E2", color: "#991B1B" },
    status_change: { bg: "#FEF3C7", color: "#92400E" },
    convert: { bg: "#FCE7F3", color: "#BE185D" },
  }

  function fmtDate(d: Date) {
    return d.toLocaleString("es-MX", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <div>
      <div className="fmd-screen-header">
        <div>
          <h1>Audit Trail</h1>
          <div className="fmd-subtitle">Every change to quotes, orders, customers, events, and more</div>
        </div>
      </div>

      {/* Filter pills */}
      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "16px" }}>
        <a
          href="/audit"
          style={{
            padding: "4px 12px",
            fontSize: "11px",
            fontWeight: 600,
            borderRadius: "4px",
            textDecoration: "none",
            background: filterType === "all" ? "#44403C" : "#fff",
            color: filterType === "all" ? "#fff" : "#44403C",
            border: "1px solid #D6D3D1",
          }}
        >
          All ({logs.length})
        </a>
        {entityTypes.map((type) => (
          <a
            key={type}
            href={`/audit?type=${encodeURIComponent(type)}`}
            style={{
              padding: "4px 12px",
              fontSize: "11px",
              fontWeight: 600,
              borderRadius: "4px",
              textDecoration: "none",
              background: filterType === type ? "#44403C" : "#fff",
              color: filterType === type ? "#fff" : "#44403C",
              border: "1px solid #D6D3D1",
            }}
          >
            {type}
          </a>
        ))}
      </div>

      {logs.length === 0 ? (
        <div className="fmd-box" style={{ textAlign: "center", padding: "32px" }}>
          <div style={{ fontSize: "13px", color: "#78716C" }}>No audit entries yet. Changes to quotes, orders, payments, and customers will appear here automatically.</div>
        </div>
      ) : (
        <div className="fmd-box">
          <div className="fmd-box-label">Recent Changes ({logs.length})</div>
          <div style={{ overflowX: "auto" }}>
            <table className="fmd-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Entity</th>
                  <th>Action</th>
                  <th>Field</th>
                  <th>Old value</th>
                  <th>New value</th>
                  <th>By</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const ac = actionColors[log.action] ?? { bg: "#F3F4F6", color: "#44403C" }
                  return (
                    <tr key={log.id}>
                      <td style={{ fontSize: "11px", color: "#78716C", whiteSpace: "nowrap" }}>
                        {fmtDate(log.changedAt)}
                      </td>
                      <td style={{ fontWeight: 600, color: "#44403C" }}>
                        {log.entityType}
                        <div style={{ fontSize: "9px", color: "#A8A29E", fontFamily: "monospace" }}>
                          {log.entityId.slice(0, 12)}...
                        </div>
                      </td>
                      <td>
                        <span
                          className="fmd-status"
                          style={{ background: ac.bg, color: ac.color, fontSize: "10px" }}
                        >
                          {log.action.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td style={{ fontSize: "11px", color: "#78716C" }}>{log.fieldName ?? "—"}</td>
                      <td style={{ fontSize: "11px", color: "#991B1B", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {log.oldValue ?? "—"}
                      </td>
                      <td style={{ fontSize: "11px", color: "#047857", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {log.newValue ?? "—"}
                      </td>
                      <td style={{ fontSize: "11px", color: "#78716C" }}>{log.changedBy}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="fmd-note blue">
        💡 The audit trail is automatically populated when changes are made through the API. Currently logged actions: quote→order conversions, payment recordings, and customer note creation. To expand coverage, more routes need to call the <code style={{ background: "#fff", padding: "1px 4px", borderRadius: "3px" }}>logChange()</code> helper.
      </div>
    </div>
  )
}
