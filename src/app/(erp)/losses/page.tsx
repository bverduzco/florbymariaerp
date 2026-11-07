export const dynamic = "force-dynamic"

import { db as prisma } from "@/lib/db"
import { LogLossDialog } from "./log-loss-dialog"

async function getLosses() { return prisma.loss.findMany({ orderBy: { date: "desc" } }) }
async function getMaterials() { return prisma.material.findMany({ where: { currentStockPacks: { gt: 0 } }, select: { id: true, sku: true, name: true, packPrice: true, currentStockPacks: true, unitsPerPack: true, unit: true }, orderBy: { name: "asc" } }) }

const REASON_EMOJI: Record<string, string> = { damaged: "🔧", spoiled: "🥀", broken: "💔", expired: "⏰", lost: "❓", stolen: "🚨", other: "📦" }

export default async function LossesPage() {
  const [losses, materials] = await Promise.all([getLosses(), getMaterials()])
  const totalPacks = losses.reduce((s, l) => s + l.qtyLostPacks, 0)
  const totalCost = losses.reduce((s, l) => s + (l.costImpact ?? 0), 0)

  return (
    <div>
      <div className="fmd-screen-header">
        <div><h1>Losses</h1><div className="fmd-subtitle">Damaged, spoiled & lost inventory</div></div>
        <LogLossDialog materials={materials} />
      </div>
      <div className="fmd-kpi-bar hidden lg:flex">
        <div className="fmd-kpi-cell"><div className="fmd-kpi-value" style={{ color: "#44403C" }}>{losses.length}</div><div className="fmd-kpi-label">Loss events</div></div>
        <div className="fmd-kpi-cell"><div className="fmd-kpi-value" style={{ color: "#D97706" }}>{totalPacks}</div><div className="fmd-kpi-label">Packs lost</div></div>
        <div className="fmd-kpi-cell"><div className="fmd-kpi-value" style={{ color: "#991B1B" }}>${totalCost.toLocaleString("es-MX", { maximumFractionDigits: 0 })}</div><div className="fmd-kpi-label">Cost impact</div></div>
      </div>
      <div className="fmd-box">
        <div className="fmd-box-label">Loss Log ({losses.length})</div>
        <div style={{ overflowX: "auto" }}>
          <table className="fmd-table">
            <thead><tr><th>Loss #</th><th>Date</th><th>Material</th><th style={{ textAlign: "right" }}>Qty</th><th>Reason</th><th>By</th><th style={{ textAlign: "right" }}>Cost</th><th>Notes</th></tr></thead>
            <tbody>
              {losses.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: "center", padding: "24px", color: "#9CA3AF" }}>No losses recorded yet.</td></tr>
              )}
              {losses.map((l) => (
                <tr key={l.id}>
                  <td style={{ fontFamily: "monospace", fontSize: "11px" }}>{l.lossNumber}</td>
                  <td>{l.date.toLocaleDateString("es-MX", { day: "2-digit", month: "short" })}</td>
                  <td style={{ fontFamily: "monospace", fontSize: "11px" }}>{l.materialSku}</td>
                  <td style={{ textAlign: "right", fontWeight: 700, color: "#991B1B" }}>
                    {l.qtyLostUnits != null
                      ? `-${l.qtyLostUnits} ${l.unit ?? "pcs"}`
                      : `-${l.qtyLostPacks} packs`
                    }
                  </td>
                  <td><span className="fmd-status" style={{ background: "#F3F4F6", color: "#44403C" }}>{REASON_EMOJI[l.reason] ?? "📦"} {l.reason}</span></td>
                  <td>{l.discoveredBy ?? "—"}</td>
                  <td style={{ textAlign: "right", fontWeight: 600, color: "#991B1B" }}>${l.costImpact?.toLocaleString("es-MX", { maximumFractionDigits: 0 }) ?? "—"}</td>
                  <td style={{ maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.notes ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
