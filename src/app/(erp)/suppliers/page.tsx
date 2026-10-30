import { db as prisma } from "@/lib/db"

async function getSuppliers() {
  return prisma.supplier.findMany({
    include: { _count: { select: { materials: true, supplierPrices: true } } },
    orderBy: { name: "asc" },
  })
}

async function getRecentPrices() {
  return prisma.supplierPrice.findMany({
    take: 10,
    orderBy: { date: "desc" },
    include: { material: { select: { name: true } } },
  })
}

export default async function SuppliersPage() {
  const [suppliers, recentPrices] = await Promise.all([getSuppliers(), getRecentPrices()])
  const withContact = suppliers.filter((s) => s.phone || s.email).length
  const totalMaterials = suppliers.reduce((s, sup) => s + sup._count.materials, 0)
  const totalPrices = suppliers.reduce((s, sup) => s + sup._count.supplierPrices, 0)

  return (
    <div>
      <div className="fmd-screen-header">
        <div><h1>Suppliers</h1><div className="fmd-subtitle">Vendor directory · all COD (full payment upfront)</div></div>
      </div>

      {/* KPI bar */}
      <div className="fmd-kpi-bar">
        <div className="fmd-kpi-cell"><div className="fmd-kpi-value" style={{ color: "#44403C" }}>{suppliers.length}</div><div className="fmd-kpi-label">Total suppliers</div></div>
        <div className="fmd-kpi-cell"><div className="fmd-kpi-value" style={{ color: "#047857" }}>{withContact}</div><div className="fmd-kpi-label">With contact info</div></div>
        <div className="fmd-kpi-cell"><div className="fmd-kpi-value" style={{ color: "#BE185D" }}>{totalMaterials}</div><div className="fmd-kpi-label">Materials tracked</div></div>
        <div className="fmd-kpi-cell"><div className="fmd-kpi-value" style={{ color: "#44403C" }}>{totalPrices}</div><div className="fmd-kpi-label">Price quotes logged</div></div>
      </div>

      {/* Supplier Directory */}
      <div className="fmd-box">
        <div className="fmd-box-label">Supplier Directory ({suppliers.length})</div>
        <div style={{ overflowX: "auto" }}>
          <table className="fmd-table">
            <thead><tr><th>Supplier</th><th>Contact</th><th>Lead time</th><th>Payment terms</th><th style={{ textAlign: "right" }}>Materials</th><th style={{ textAlign: "right" }}>Price quotes</th></tr></thead>
            <tbody>
              {suppliers.map((s) => (
                <tr key={s.id}>
                  <td style={{ fontWeight: 600, color: "#44403C" }}>
                    {s.name}
                    <span className="fmd-status" style={{ background: "#FEF3C7", color: "#92400E", marginLeft: "6px" }}>COD</span>
                  </td>
                  <td>
                    {s.phone && <div style={{ fontSize: "11px" }}>📞 {s.phone}</div>}
                    {s.email && <div style={{ fontSize: "11px" }}>✉️ {s.email}</div>}
                    {!s.phone && !s.email && <span style={{ color: "#D6D3D1", fontStyle: "italic" }}>No contact info</span>}
                  </td>
                  <td>{s.leadTimeDays ? `${s.leadTimeDays} days` : "—"}</td>
                  <td style={{ fontSize: "11px" }}>{s.paymentTerms ?? "COD (full upfront)"}</td>
                  <td style={{ textAlign: "right" }}>{s._count.materials}</td>
                  <td style={{ textAlign: "right" }}>{s._count.supplierPrices}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Price List Management */}
      <div className="fmd-box" style={{ borderColor: "#BE185D", background: "#FDF2F8" }}>
        <div className="fmd-box-label" style={{ color: "#BE185D" }}>Price List Management</div>
        <div style={{ fontSize: "13px", fontWeight: 600, color: "#BE185D", marginBottom: "8px" }}>Update supplier price lists from received quotes</div>
        <div className="fmd-note blue">When you receive a new price quote from a supplier (WhatsApp photo, email, PDF), use this to update all prices at once. Each update creates new rows in Supplier Prices (is_latest = yes on new, no on old).</div>
        <div style={{ marginTop: "12px" }}>
          <div style={{ fontSize: "13px", fontWeight: 600, color: "#44403C", marginBottom: "8px" }}>Supplier: <span style={{ color: "#BE185D" }}>Select supplier ▾</span></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginTop: "8px" }}>
            <div style={{ background: "#ffffff", border: "1px solid #D6D3D1", borderRadius: "4px", padding: "8px 12px", fontSize: "12px", color: "#6B7280" }}>▸ Bulk paste: SKU, Price per line</div>
            <div style={{ background: "#ffffff", border: "1px solid #D6D3D1", borderRadius: "4px", padding: "8px 12px", fontSize: "12px", color: "#6B7280" }}>▸ Or upload Excel/CSV from supplier</div>
          </div>
        </div>
        <table className="fmd-table" style={{ marginTop: "12px" }}>
          <thead><tr><th>SKU</th><th>Material</th><th>Supplier</th><th style={{ textAlign: "right" }}>Pack price</th><th style={{ textAlign: "right" }}>Units/pack</th><th>Latest?</th><th>Date</th></tr></thead>
          <tbody>
            {recentPrices.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: "center", padding: "16px", color: "#9CA3AF" }}>No price quotes logged yet.</td></tr>
            ) : (
              recentPrices.map((p) => (
                <tr key={p.id}>
                  <td style={{ fontFamily: "monospace", fontSize: "10px" }}>{p.materialSku}</td>
                  <td style={{ color: "#44403C" }}>{p.material?.name ?? p.materialSku}</td>
                  <td>{p.supplierName}</td>
                  <td style={{ textAlign: "right", fontWeight: 600, color: "#44403C" }}>${p.packPrice.toLocaleString("es-MX", { maximumFractionDigits: 2 })}</td>
                  <td style={{ textAlign: "right" }}>{p.unitsPerPack ?? "—"}</td>
                  <td>{p.isLatest ? <span className="fmd-status accepted">latest</span> : <span className="fmd-status expired">old</span>}</td>
                  <td style={{ fontSize: "11px" }}>{p.date.toLocaleDateString("es-MX", { day: "2-digit", month: "short" })}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {recentPrices.length > 0 && (
          <div style={{ marginTop: "8px" }}>
            <span className="fmd-btn primary">✓ Apply Price Update</span>
            <span className="fmd-btn outline" style={{ marginLeft: "8px" }}>Cancel</span>
            <span className="fmd-btn outline" style={{ marginLeft: "8px" }}>Switch Supplier ▾</span>
          </div>
        )}
      </div>

      {/* Price Update History */}
      <div className="fmd-box">
        <div className="fmd-box-label">Price Update History</div>
        <div style={{ overflowX: "auto" }}>
          <table className="fmd-table">
            <thead><tr><th>Date</th><th>Supplier</th><th>Material</th><th style={{ textAlign: "right" }}>Pack price</th><th>Latest?</th></tr></thead>
            <tbody>
              {recentPrices.map((p) => (
                <tr key={`hist-${p.id}`}>
                  <td style={{ fontSize: "11px" }}>{p.date.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}</td>
                  <td style={{ color: "#44403C" }}>{p.supplierName}</td>
                  <td>{p.material?.name ?? p.materialSku} <span style={{ fontFamily: "monospace", fontSize: "10px", color: "#78716C" }}>{p.materialSku}</span></td>
                  <td style={{ textAlign: "right", fontWeight: 600 }}>${p.packPrice.toLocaleString("es-MX", { maximumFractionDigits: 2 })}</td>
                  <td>{p.isLatest ? <span className="fmd-status accepted">latest</span> : <span className="fmd-status expired">superseded</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Business rules */}
      <div className="fmd-note">⚠️ All suppliers are COD — full payment upfront, no credit terms. Materials.Pack Price reads from the latest Supplier Price per (SKU, supplier). Preferred Supplier on Materials determines which price shows by default.</div>
    </div>
  )
}
