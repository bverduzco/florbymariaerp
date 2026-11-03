import { db as prisma } from "@/lib/db"
import { LogExecutionDialog } from "./log-execution-dialog"
import Link from "next/link"

async function getLogs() {
  return prisma.executionLog.findMany({
    orderBy: { executedAt: "desc" },
    include: { lines: true },
  })
}

async function getEventsWithLines() {
  // Events with line items — those are the ones Maria would actually execute against.
  const events = await prisma.event.findMany({
    where: {
      lineItems: { some: {} },
    },
    select: {
      id: true,
      eventNumber: true,
      name: true,
      eventDate: true,
      lineItems: {
        select: {
          id: true,
          productSku: true,
          productName: true,
          qty: true,
          lineKey: true,
        },
      },
    },
    orderBy: { eventDate: "desc" },
    take: 50,
  })
  return events.map((e) => ({
    ...e,
    eventDate: e.eventDate?.toISOString() ?? null,
  }))
}

async function getPendingOrders() {
  // Orders pending execution = paid (payment_confirmed) OR already procuring.
  // Excludes draft, quote_sent (not paid yet), delivered, fulfilled, cancelled.
  const PENDING_STATUSES = ["payment_confirmed", "procuring"]
  const orders = await prisma.order.findMany({
    where: {
      status: { in: PENDING_STATUSES },
      lineItems: { some: {} },
    },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      deliveryDate: true,
      customer: { select: { name: true } },
      lineItems: {
        select: {
          id: true,
          productSku: true,
          productName: true,
          qty: true,
        },
      },
    },
    orderBy: { deliveryDate: "asc" },
    take: 50,
  })
  return orders.map((o) => ({
    ...o,
    deliveryDate: o.deliveryDate?.toISOString() ?? null,
  }))
}

async function getMaterials() {
  return prisma.material.findMany({
    where: { sku: { not: "" } },
    select: {
      sku: true,
      name: true,
      unit: true,
      unitCost: true,
      packPrice: true,
      unitsPerPack: true,
      category: true,
    },
    orderBy: { name: "asc" },
  })
}

async function getRecipeLinesByProduct() {
  // Group recipe lines by productSku so the dialog can prefill per event line item.
  const lines = await prisma.recipeLine.findMany({
    select: {
      id: true,
      productSku: true,
      componentSku: true,
      materialId: true,
      componentName: true,
      qty: true,
      unit: true,
      unitCost: true,
      lineCost: true,
      color: true,
    },
  })
  const map: Record<
    string,
    Array<{
      id: string
      productSku: string
      componentSku: string
      materialId: string
      materialSku: string
      materialName: string
      componentName: string
      qty: number
      unit: string
      unitCost: number
      lineCost: number
      color: string | null
    }>
  > = {}
  for (const l of lines) {
    if (!map[l.productSku]) map[l.productSku] = []
    map[l.productSku].push({
      ...l,
      materialSku: l.componentSku, // alias for clarity in the dialog
      materialName: l.componentName,
    })
  }
  return map
}

export default async function ExecutionPage() {
  const [logs, events, pendingOrders, materials, recipeLinesByProduct] = await Promise.all([
    getLogs(),
    getEventsWithLines(),
    getPendingOrders(),
    getMaterials(),
    getRecipeLinesByProduct(),
  ])

  const executed = logs.filter((l) => l.status === "executed").length
  const totalCost = logs.reduce((s, l) => s + (l.actualCost ?? 0), 0)
  const estCost = logs.reduce((s, l) => s + (l.estimatedCost ?? 0), 0)
  const variance = totalCost - estCost

  return (
    <div>
      <div className="fmd-screen-header hidden lg:flex">
        <div>
          <h1>Execution Logs</h1>
          <div className="fmd-subtitle">What was actually used per job</div>
        </div>
        <LogExecutionDialog
          events={events}
          pendingOrders={pendingOrders}
          materials={materials}
          recipeLinesByProduct={recipeLinesByProduct}
        />
      </div>

      {/* Mobile header */}
      <div className="lg:hidden" style={{ padding: "16px 0 12px", background: "#fff", borderBottom: "1px solid #E7E5E4" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: "20px", fontWeight: 700, color: "#44403C" }}>Execution Logs</div>
            <div style={{ fontSize: "12px", color: "#78716C", marginTop: "2px" }}>{logs.length} logs · {executed} executed</div>
          </div>
          <LogExecutionDialog
            events={events}
            pendingOrders={pendingOrders}
            materials={materials}
            recipeLinesByProduct={recipeLinesByProduct}
          />
        </div>
      </div>

      <div className="fmd-kpi-bar hidden lg:flex">
        <div className="fmd-kpi-cell">
          <div className="fmd-kpi-value" style={{ color: "#44403C" }}>
            {logs.length}
          </div>
          <div className="fmd-kpi-label">Total executions</div>
        </div>
        <div className="fmd-kpi-cell">
          <div className="fmd-kpi-value" style={{ color: "#047857" }}>
            {executed}
          </div>
          <div className="fmd-kpi-label">Executed</div>
        </div>
        <div className="fmd-kpi-cell">
          <div className="fmd-kpi-value" style={{ color: "#D97706" }}>
            ${totalCost.toLocaleString("es-MX", { maximumFractionDigits: 0 })}
          </div>
          <div className="fmd-kpi-label">Actual cost</div>
        </div>
        <div className="fmd-kpi-cell">
          <div
            className="fmd-kpi-value"
            style={{ color: variance >= 0 ? "#991B1B" : "#047857" }}
          >
            {variance >= 0 ? "+" : "-"}$
            {Math.abs(variance).toLocaleString("es-MX", {
              maximumFractionDigits: 0,
            })}
          </div>
          <div className="fmd-kpi-label">Cost variance</div>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {logs.length === 0 && (
          <div
            className="fmd-box"
            style={{ marginBottom: 0, textAlign: "center", padding: "32px" }}
          >
            <div style={{ fontSize: "13px", color: "#78716C" }}>
              No executions logged yet.
            </div>
            <div style={{ fontSize: "11px", color: "#A8A29E", marginTop: "4px" }}>
              Click <b>+ Log Execution</b> above to record your first job — pick an
              event to prefill the recipe lines, then adjust actual quantities.
            </div>
          </div>
        )}
        {logs.map((log) => {
          const isPaid = log.quotedPrice !== null
          const v =
            (log.actualCost ?? 0) - (log.estimatedCost ?? 0)
          return (
            <div key={log.id} className="fmd-box" style={{ marginBottom: 0 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: "8px",
                }}
              >
                <div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <Link
                      href={`/execution/${log.id}`}
                      style={{
                        fontFamily: "monospace",
                        fontSize: "12px",
                        fontWeight: 700,
                        color: "#44403C",
                        textDecoration: "none",
                      }}
                      className="hover:text-rose-700 hover:underline transition"
                    >
                      {log.executionNumber}
                    </Link>
                    <span className={`fmd-status ${log.status}`}>
                      {log.status}
                    </span>
                    <span
                      className={`fmd-status ${isPaid ? "accepted" : "expired"}`}
                    >
                      {isPaid ? "💵 Paid" : "🎁 Unpaid demo"}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: "11px",
                      color: "#6B7280",
                      marginTop: "4px",
                    }}
                  >
                    📅{" "}
                    {log.executedAt.toLocaleDateString("es-MX", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}{" "}
                    · 👤 {log.executedBy ?? "—"} · 📦{" "}
                    {log.lines?.length ?? 0} line(s)
                  </div>
                </div>
              </div>
              <div
                className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2"
              >
                <div
                  style={{
                    textAlign: "center",
                    padding: "6px",
                    borderRadius: "6px",
                    background: "#FAFAF9",
                  }}
                >
                  <div
                    style={{
                      fontSize: "9px",
                      textTransform: "uppercase",
                      color: "#78716C",
                    }}
                  >
                    Est. cost
                  </div>
                  <div
                    style={{
                      fontSize: "14px",
                      fontWeight: 700,
                      color: "#44403C",
                    }}
                  >
                    $
                    {log.estimatedCost?.toLocaleString("es-MX", {
                      maximumFractionDigits: 0,
                    }) ?? "—"}
                  </div>
                </div>
                <div
                  style={{
                    textAlign: "center",
                    padding: "6px",
                    borderRadius: "6px",
                    background: "#FFFBEB",
                  }}
                >
                  <div
                    style={{
                      fontSize: "9px",
                      textTransform: "uppercase",
                      color: "#78716C",
                    }}
                  >
                    Actual cost
                  </div>
                  <div
                    style={{
                      fontSize: "14px",
                      fontWeight: 700,
                      color: "#92400E",
                    }}
                  >
                    $
                    {log.actualCost?.toLocaleString("es-MX", {
                      maximumFractionDigits: 0,
                    }) ?? "—"}
                  </div>
                </div>
                <div
                  style={{
                    textAlign: "center",
                    padding: "6px",
                    borderRadius: "6px",
                    background: isPaid ? "#D1FAE5" : "#F3F4F6",
                  }}
                >
                  <div
                    style={{
                      fontSize: "9px",
                      textTransform: "uppercase",
                      color: "#78716C",
                    }}
                  >
                    Quoted
                  </div>
                  <div
                    style={{
                      fontSize: "14px",
                      fontWeight: 700,
                      color: isPaid ? "#065F46" : "#6B7280",
                    }}
                  >
                    {log.quotedPrice
                      ? `$${log.quotedPrice.toLocaleString("es-MX", {
                          maximumFractionDigits: 0,
                        })}`
                      : "N/A"}
                  </div>
                </div>
                <div
                  style={{
                    textAlign: "center",
                    padding: "6px",
                    borderRadius: "6px",
                    background: isPaid ? "#FCE7F3" : "#F3F4F6",
                  }}
                >
                  <div
                    style={{
                      fontSize: "9px",
                      textTransform: "uppercase",
                      color: "#78716C",
                    }}
                  >
                    Margin
                  </div>
                  <div
                    style={{
                      fontSize: "14px",
                      fontWeight: 700,
                      color: isPaid ? "#BE185D" : "#6B7280",
                    }}
                  >
                    {log.marginDollars
                      ? `$${log.marginDollars.toLocaleString("es-MX", {
                          maximumFractionDigits: 0,
                        })}`
                      : "N/A"}
                  </div>
                </div>
              </div>
              {v !== 0 && (
                <div
                  style={{
                    fontSize: "11px",
                    marginTop: "6px",
                    paddingTop: "6px",
                    borderTop: "1px solid #D6D3D1",
                    color: v > 0 ? "#991B1B" : "#047857",
                  }}
                >
                  {v > 0 ? "⚠" : "✓"} Cost variance:{" "}
                  {v > 0 ? "+" : "-"}$
                  {Math.abs(v).toLocaleString("es-MX", {
                    maximumFractionDigits: 2,
                  })}
                </div>
              )}
              {log.notes && (
                <div
                  style={{
                    fontSize: "11px",
                    color: "#6B7280",
                    marginTop: "4px",
                    paddingTop: "4px",
                    borderTop: "1px solid #D6D3D1",
                  }}
                >
                  📝 {log.notes}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
