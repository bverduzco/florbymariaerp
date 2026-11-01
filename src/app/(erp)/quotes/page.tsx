// src/app/(erp)/quotes/page.tsx
//
// Quotes — wireframe-matched styling.

import { db as prisma } from "@/lib/db"
import { NewQuoteDialog } from "./new-quote-dialog"
import { StatusDropdown } from "@/components/status-dropdown"
import { QuotePdfButton } from "@/components/quote-pdf-button"
import { QuoteMessageButton } from "@/components/quote-message-button"
import Link from "next/link"

async function getQuotes() {
  return prisma.quote.findMany({
    include: {
      customer: { select: { name: true, phone: true } },
      lines: { select: { id: true } },
    },
    orderBy: { quoteDate: "desc" },
  })
}

export default async function QuotesPage() {
  const [quotes, products, customers, events] = await Promise.all([
    getQuotes(),
    // All products (including $0 ones) so Maria can pick placeholders
    prisma.product.findMany({
      orderBy: [{ name: "asc" }],
      select: {
        id: true,
        sku: true,
        name: true,
        size: true,
        actualPriceBeforeIva: true,
      },
    }),
    prisma.customer.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.event.findMany({
      orderBy: { eventDate: "asc" },
      select: {
        id: true,
        eventNumber: true,
        name: true,
        eventDate: true,
      },
    }),
  ])

  const total = quotes.length
  const accepted = quotes.filter((q) => q.status === "accepted").length
  const inPipeline = quotes.filter((q) => ["sent", "viewed", "negotiating"].includes(q.status)).length
  const lost = quotes.filter((q) => ["declined", "expired"].includes(q.status)).length
  const pipelineValue = quotes
    .filter((q) => ["accepted", "sent", "negotiating"].includes(q.status))
    .reduce((s, q) => s + q.total, 0)
  const conversion = total > 0 ? Math.round((accepted / total) * 100) : 0

  return (
    <div>
      {/* Screen header — desktop only */}
      <div className="fmd-screen-header hidden lg:flex">
        <div>
          <h1>Quotes</h1>
          <div className="fmd-subtitle">Sales pipeline · draft → sent → accepted → declined</div>
        </div>
        <NewQuoteDialog products={products} customers={customers} events={events} />
      </div>

      {/* KPI bar — desktop only */}
      <div className="fmd-kpi-bar hidden lg:flex">
        <div className="fmd-kpi-cell">
          <div className="fmd-kpi-value" style={{ color: "#44403C" }}>{total}</div>
          <div className="fmd-kpi-label">Total quotes</div>
        </div>
        <div className="fmd-kpi-cell">
          <div className="fmd-kpi-value" style={{ color: "#047857" }}>{accepted}</div>
          <div className="fmd-kpi-label">Accepted</div>
        </div>
        <div className="fmd-kpi-cell">
          <div className="fmd-kpi-value" style={{ color: "#2563EB" }}>{inPipeline}</div>
          <div className="fmd-kpi-label">In pipeline</div>
        </div>
        <div className="fmd-kpi-cell">
          <div className="fmd-kpi-value" style={{ color: "#991B1B" }}>{lost}</div>
          <div className="fmd-kpi-label">Lost/expired</div>
        </div>
        <div className="fmd-kpi-cell">
          <div className="fmd-kpi-value" style={{ color: "#BE185D" }}>{conversion}%</div>
          <div className="fmd-kpi-label">Conversion</div>
        </div>
        <div className="fmd-kpi-cell">
          <div className="fmd-kpi-value" style={{ color: "#44403C" }}>${pipelineValue.toLocaleString("es-MX", { maximumFractionDigits: 0 })}</div>
          <div className="fmd-kpi-label">Pipeline value</div>
        </div>
      </div>

      {/* ── Desktop: table view ──────────────────────────────── */}
      <div className="fmd-box hidden lg:block">
        <div className="fmd-box-label">All Quotes ({quotes.length})</div>
        <div style={{ overflowX: "auto" }}>
          <table className="fmd-table">
            <thead>
              <tr>
                <th>Quote #</th>
                <th>Customer</th>
                <th>Type</th>
                <th>Event date</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Items</th>
                <th style={{ textAlign: "right" }}>Total</th>
                <th style={{ textAlign: "center" }}>PDF</th>
                <th style={{ textAlign: "center" }}>MSG</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {quotes.length === 0 ? (
                <tr><td colSpan={10} style={{ textAlign: "center", padding: "24px", color: "#9CA3AF" }}>No quotes yet.</td></tr>
              ) : (
                quotes.map((q) => (
                  <tr key={q.id}>
                    <td style={{ fontFamily: "monospace", fontSize: "11px", color: "#44403C" }}>
                      <Link href={`/quotes/${q.id}`} style={{ color: "#44403C", textDecoration: "none" }}>
                        {q.quoteNumber}
                      </Link>
                    </td>
                    <td style={{ fontWeight: 600, color: "#44403C" }}>{q.customerName ?? "—"}</td>
                    <td style={{ textTransform: "capitalize" }}>{q.eventType ?? "—"}</td>
                    <td>{q.eventDate ? q.eventDate.toLocaleDateString("es-MX", { day: "2-digit", month: "short" }) : "—"}</td>
                    <td>
                      <StatusDropdown
                        entityId={q.id}
                        currentStatus={q.status}
                        statuses={[
                          { value: "draft", label: "Draft" },
                          { value: "sent", label: "Sent" },
                          { value: "viewed", label: "Viewed" },
                          { value: "negotiating", label: "Negotiating" },
                          { value: "accepted", label: "Accepted" },
                          { value: "declined", label: "Declined" },
                          { value: "expired", label: "Expired" },
                        ]}
                        apiPath="/api/quotes/{id}"
                      />
                    </td>
                    <td style={{ textAlign: "right" }}>{q.lines.length}</td>
                    <td style={{ textAlign: "right", fontWeight: 600, color: "#44403C" }}>
                      ${q.total.toLocaleString("es-MX", { maximumFractionDigits: 0 })}
                    </td>
                    <td style={{ textAlign: "center", padding: "4px" }}>
                      <QuotePdfButton quoteId={q.id} variant="icon" />
                    </td>
                    <td style={{ textAlign: "center", padding: "4px" }}>
                      <QuoteMessageButton quoteId={q.id} variant="icon" />
                    </td>
                    <td style={{ maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {q.lostReason ? (
                        <span style={{ color: "#991B1B" }}>Lost: {q.lostReason.replace(/_/g, " ")}</span>
                      ) : q.notes ? (
                        q.notes
                      ) : (
                        <span style={{ color: "#D6D3D1" }}>—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Mobile: card list view ───────────────────────────── */}
      <div className="lg:hidden" style={{ paddingBottom: "80px" }}>
        {/* Mobile page header */}
        <div style={{ padding: "16px 16px 12px", background: "#fff", borderBottom: "1px solid #E7E5E4" }}>
          <div style={{ fontSize: "20px", fontWeight: 700, color: "#44403C" }}>Cotizaciones</div>
          <div style={{ fontSize: "12px", color: "#78716C", marginTop: "2px" }}>
            {quotes.length} cotizaciones · {quotes.filter(q => ["draft", "sent", "viewed", "negotiating"].includes(q.status)).length} activas · {quotes.filter(q => q.status === "accepted").length} aceptadas
          </div>
        </div>

        {quotes.length === 0 ? (
          <div style={{ textAlign: "center", padding: "32px 16px", color: "#9CA3AF", fontSize: "13px" }}>
            No hay cotizaciones todavía.
          </div>
        ) : (
          <div style={{ padding: "12px 16px" }}>
            {quotes.map((q) => (
              <Link
                key={q.id}
                href={`/quotes/${q.id}`}
                style={{
                  display: "block",
                  marginBottom: "8px",
                  background: "#fff",
                  border: "1px solid #E7E5E4",
                  borderRadius: "10px",
                  padding: "14px",
                  textDecoration: "none",
                }}
              >
                {/* Card header: quote number + status */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "6px" }}>
                  <span style={{ fontFamily: "monospace", fontSize: "13px", fontWeight: 700, color: "#44403C" }}>
                    {q.quoteNumber}
                  </span>
                  <span
                    className={`fmd-status ${q.status}`}
                    style={{ fontSize: "10px", fontWeight: 600, padding: "2px 8px", borderRadius: "4px", textTransform: "capitalize" }}
                  >
                    {q.status.replace(/_/g, " ")}
                  </span>
                </div>

                {/* Customer name */}
                <div style={{ fontSize: "14px", fontWeight: 600, color: "#44403C", marginBottom: "4px" }}>
                  {q.customerName ?? "—"}
                </div>

                {/* Meta + amount */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px" }}>
                  <div style={{ fontSize: "11px", color: "#78716C" }}>
                    {(q.eventType ?? "—").charAt(0).toUpperCase() + (q.eventType ?? "—").slice(1)}
                    {" · "}
                    {q.eventDate ? q.eventDate.toLocaleDateString("es-MX", { day: "2-digit", month: "short" }) : "sin fecha"}
                    {" · "}
                    {q.lines.length} item{q.lines.length !== 1 ? "s" : ""}
                  </div>
                  <div style={{ fontSize: "15px", fontWeight: 700, color: "#BE185D" }}>
                    ${q.total.toLocaleString("es-MX", { maximumFractionDigits: 0 })}
                  </div>
                </div>

                {/* Inline actions — buttons stop propagation via their own Link/fetch, not onClick */}
                <div style={{ display: "flex", gap: "8px", marginTop: "10px", paddingTop: "10px", borderTop: "1px solid #F5F5F4" }}>
                  <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
                    <QuotePdfButton quoteId={q.id} variant="icon" />
                  </div>
                  <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
                    <QuoteMessageButton quoteId={q.id} variant="icon" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Desktop-only note */}
      <div className="fmd-note blue hidden lg:block">
        📊 {total} quotes · {accepted} accepted ({conversion}%) · ${pipelineValue.toLocaleString("es-MX", { maximumFractionDigits: 0 })} in active pipeline.
      </div>
    </div>
  )
}
