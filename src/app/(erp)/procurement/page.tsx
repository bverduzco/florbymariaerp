import { db as prisma } from "@/lib/db"
import { NewPoDialog } from "./new-po-dialog"

async function getPurchaseOrders() {
  return prisma.purchaseOrder.findMany({ include: { _count: { select: { lines: true } }, lines: { select: { materialSku: true, materialName: true, qtyPacks: true, costPerPack: true, lineTotal: true }, orderBy: { materialName: "asc" } } }, orderBy: { poNumber: "asc" } })
}
async function getSuppliers() { return prisma.supplier.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }) }

export default async function ProcurementPage() {
  const [pos, suppliers] = await Promise.all([getPurchaseOrders(), getSuppliers()])
  const received = pos.filter((p) => p.status === "received").length
  const totalCost = pos.reduce((s, p) => s + p.totalCost, 0)

  return (
    <div>
      <div className="fmd-screen-header">
        <div><h1>Purchase Orders</h1><div className="fmd-subtitle">Formal procurement · all suppliers COD</div></div>
        <NewPoDialog suppliers={suppliers.map((s) => s.name)} />
      </div>
      <div className="fmd-kpi-bar">
        <div className="fmd-kpi-cell"><div className="fmd-kpi-value" style={{ color: "#44403C" }}>{pos.length}</div><div className="fmd-kpi-label">Total POs</div></div>
        <div className="fmd-kpi-cell"><div className="fmd-kpi-value" style={{ color: "#047857" }}>{received}</div><div className="fmd-kpi-label">Received</div></div>
        <div className="fmd-kpi-cell"><div className="fmd-kpi-value" style={{ color: "#BE185D" }}>${totalCost.toLocaleString("es-MX", { maximumFractionDigits: 0 })}</div><div className="fmd-kpi-label">Total spent</div></div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {pos.map((po) => (
          <div key={po.id} className="fmd-box" style={{ marginBottom: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", paddingBottom: "8px", borderBottom: "1px solid #D6D3D1" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontFamily: "monospace", fontSize: "12px", fontWeight: 700, color: "#44403C" }}>{po.poNumber}</span>
                  <span className={`fmd-status ${po.status === "received" ? "accepted" : po.status === "cancelled" ? "cancelled" : "sent"}`}>{po.status}</span>
                </div>
                <div style={{ fontSize: "11px", color: "#6B7280", marginTop: "2px" }}>🏭 {po.supplier} · {po._count.lines} items</div>
              </div>
              <div style={{ fontSize: "20px", fontWeight: 700, color: "#44403C" }}>${po.totalCost.toLocaleString("es-MX", { maximumFractionDigits: 2 })}</div>
            </div>
            <table className="fmd-table">
              <thead><tr><th>SKU</th><th>Material</th><th style={{ textAlign: "right" }}>Qty</th><th style={{ textAlign: "right" }}>$ /pack</th><th style={{ textAlign: "right" }}>Total</th></tr></thead>
              <tbody>{po.lines.map((l) => (<tr key={l.materialSku}><td style={{ fontFamily: "monospace", fontSize: "10px" }}>{l.materialSku}</td><td style={{ color: "#44403C" }}>{l.materialName}</td><td style={{ textAlign: "right" }}>{l.qtyPacks}</td><td style={{ textAlign: "right" }}>${l.costPerPack.toLocaleString("es-MX", { maximumFractionDigits: 2 })}</td><td style={{ textAlign: "right", fontWeight: 600, color: "#44403C" }}>${l.lineTotal.toLocaleString("es-MX", { maximumFractionDigits: 2 })}</td></tr>))}</tbody>
            </table>
            {po.notes && <div style={{ fontSize: "11px", color: "#6B7280", marginTop: "6px", paddingTop: "6px", borderTop: "1px solid #D6D3D1" }}>📝 {po.notes}</div>}
          </div>
        ))}
      </div>
    </div>
  )
}
