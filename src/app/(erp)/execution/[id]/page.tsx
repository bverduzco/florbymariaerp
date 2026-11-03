export const dynamic = "force-dynamic"

import { db as prisma } from "@/lib/db"
import { notFound } from "next/navigation"
import Link from "next/link"

async function getLog(id: string) {
  return prisma.executionLog.findUnique({
    where: { id },
    include: {
      lines: { orderBy: { id: "asc" } },
      event: { select: { eventNumber: true, name: true, eventDate: true } },
      order: { select: { orderNumber: true, status: true, customer: { select: { name: true } } } },
    },
  })
}

export default async function ExecutionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const log = await getLog(id)
  if (!log) notFound()

  const isPaid = log.quotedPrice !== null
  const variance = (log.actualCost ?? 0) - (log.estimatedCost ?? 0)

  return (
    <div>
      {/* Breadcrumb */}
      <div className="mb-4">
        <Link href="/execution" className="text-sm text-stone-500 hover:text-stone-900 underline">
          ← Back to Execution Logs
        </Link>
      </div>

      {/* Header */}
      <div className="fmd-screen-header">
        <div>
          <h1>{log.executionNumber}</h1>
          <div className="fmd-subtitle">
            {log.executedAt.toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" })}
            {" · "}by {log.executedBy ?? "—"}
            {" · "}<span className={`fmd-status ${log.status}`}>{log.status}</span>
            {" "}<span className={`fmd-status ${isPaid ? "accepted" : "expired"}`}>
              {isPaid ? "💵 Paid" : "🎁 Unpaid demo"}
            </span>
          </div>
        </div>
      </div>

      {/* Linked job */}
      {(log.event || log.order) && (
        <div className="fmd-box" style={{ marginBottom: "12px" }}>
          <div className="fmd-box-label">Linked Job</div>
          <div style={{ fontSize: "13px", color: "#44403C" }}>
            {log.order && (
              <div>
                🛒 <span style={{ fontFamily: "monospace", fontWeight: 700 }}>{log.order.orderNumber}</span>
                {" · "}{log.order.customer?.name ?? "—"}
                {" · "}<span className={`fmd-status ${log.order.status}`}>{log.order.status}</span>
              </div>
            )}
            {log.event && (
              <div>
                🎉 <span style={{ fontFamily: "monospace", fontWeight: 700 }}>{log.event.eventNumber}</span>
                {" · "}{log.event.name}
                {log.event.eventDate && ` · ${log.event.eventDate.toLocaleDateString("es-MX", { day: "2-digit", month: "short" })}`}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Material lines */}
      <div className="fmd-box">
        <div className="fmd-box-label">Material Lines ({log.lines.length})</div>
        {log.lines.length === 0 ? (
          <div style={{ textAlign: "center", padding: "16px", color: "#9CA3AF", fontSize: "12px" }}>
            No material lines recorded.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="fmd-table">
              <thead>
                <tr>
                  <th>Material</th>
                  <th>SKU</th>
                  <th style={{ textAlign: "right" }}>Qty used</th>
                  <th style={{ textAlign: "right" }}>Unit cost</th>
                  <th style={{ textAlign: "right" }}>Line cost</th>
                  <th>Type</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {log.lines.map((line) => (
                  <tr key={line.id}>
                    <td style={{ fontWeight: 600, color: "#44403C" }}>{line.materialName}</td>
                    <td style={{ fontFamily: "monospace", fontSize: "10px", color: "#78716C" }}>{line.materialSku}</td>
                    <td style={{ textAlign: "right" }}>{line.qtyUsed} {line.unit}</td>
                    <td style={{ textAlign: "right" }}>${line.unitCost.toLocaleString("es-MX", { maximumFractionDigits: 2 })}</td>
                    <td style={{ textAlign: "right", fontWeight: 600 }}>${line.lineCost.toLocaleString("es-MX", { maximumFractionDigits: 2 })}</td>
                    <td>
                      <span className={`fmd-status ${line.type === "recipe" ? "accepted" : line.type === "addition" ? "pending" : line.type === "substitution" ? "draft" : "cancelled"}`}>
                        {line.type}
                      </span>
                    </td>
                    <td style={{ maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "11px", color: "#78716C" }}>
                      {line.notes ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Cost summary */}
      <div className="fmd-kpi-bar">
        <div className="fmd-kpi-cell">
          <div className="fmd-kpi-value" style={{ color: "#44403C" }}>${(log.estimatedCost ?? 0).toLocaleString("es-MX", { maximumFractionDigits: 0 })}</div>
          <div className="fmd-kpi-label">Estimated cost</div>
        </div>
        <div className="fmd-kpi-cell">
          <div className="fmd-kpi-value" style={{ color: "#D97706" }}>${(log.actualCost ?? 0).toLocaleString("es-MX", { maximumFractionDigits: 0 })}</div>
          <div className="fmd-kpi-label">Actual cost</div>
        </div>
        <div className="fmd-kpi-cell">
          <div className="fmd-kpi-value" style={{ color: isPaid ? "#065F46" : "#6B7280" }}>
            {log.quotedPrice ? `$${log.quotedPrice.toLocaleString("es-MX", { maximumFractionDigits: 0 })}` : "N/A"}
          </div>
          <div className="fmd-kpi-label">Quoted price</div>
        </div>
        <div className="fmd-kpi-cell">
          <div className="fmd-kpi-value" style={{ color: isPaid ? "#BE185D" : "#6B7280" }}>
            {log.marginDollars ? `$${log.marginDollars.toLocaleString("es-MX", { maximumFractionDigits: 0 })}` : "N/A"}
            {log.marginPct ? ` (${Math.round(log.marginPct * 100)}%)` : ""}
          </div>
          <div className="fmd-kpi-label">Margin</div>
        </div>
        <div className="fmd-kpi-cell">
          <div className="fmd-kpi-value" style={{ color: variance >= 0 ? "#991B1B" : "#047857" }}>
            {variance >= 0 ? "+" : "−"}${Math.abs(variance).toLocaleString("es-MX", { maximumFractionDigits: 0 })}
          </div>
          <div className="fmd-kpi-label">Cost variance</div>
        </div>
      </div>

      {/* Notes */}
      {log.notes && (
        <div className="fmd-box" style={{ marginTop: "12px" }}>
          <div className="fmd-box-label">Notes</div>
          <div style={{ fontSize: "13px", color: "#44403C", padding: "8px 0" }}>{log.notes}</div>
        </div>
      )}

      <div className="fmd-note" style={{ marginTop: "12px" }}>
        📅 Executed on {log.executedAt.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" })} by {log.executedBy ?? "—"}.
        {log.lines.length > 0 && ` ${log.lines.length} material line(s) recorded.`}
      </div>
    </div>
  )
}
