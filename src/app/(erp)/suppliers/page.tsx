import { db as prisma } from "@/lib/db"

async function getSuppliers() {
  return prisma.supplier.findMany({ include: { _count: { select: { materials: true, supplierPrices: true } } }, orderBy: { name: "asc" } })
}

export default async function SuppliersPage() {
  const suppliers = await getSuppliers()
  const withContact = suppliers.filter((s) => s.phone || s.email).length
  const totalMaterials = suppliers.reduce((s, sup) => s + sup._count.materials, 0)
  const totalPrices = suppliers.reduce((s, sup) => s + sup._count.supplierPrices, 0)

  return (
    <div>
      <div className="fmd-screen-header">
        <div><h1>Suppliers</h1><div className="fmd-subtitle">Vendor directory · all COD (full payment upfront)</div></div>
      </div>
      <div className="fmd-kpi-bar">
        <div className="fmd-kpi-cell"><div className="fmd-kpi-value" style={{ color: "#44403C" }}>{suppliers.length}</div><div className="fmd-kpi-label">Total suppliers</div></div>
        <div className="fmd-kpi-cell"><div className="fmd-kpi-value" style={{ color: "#047857" }}>{withContact}</div><div className="fmd-kpi-label">With contact info</div></div>
        <div className="fmd-kpi-cell"><div className="fmd-kpi-value" style={{ color: "#BE185D" }}>{totalMaterials}</div><div className="fmd-kpi-label">Materials tracked</div></div>
        <div className="fmd-kpi-cell"><div className="fmd-kpi-value" style={{ color: "#44403C" }}>{totalPrices}</div><div className="fmd-kpi-label">Price quotes</div></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "8px" }}>
        {suppliers.map((s) => (
          <div key={s.id} className="fmd-box" style={{ marginBottom: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
              <div style={{ fontSize: "13px", fontWeight: 600, color: "#44403C" }}>{s.name}</div>
              <span className="fmd-status" style={{ background: "#FEF3C7", color: "#92400E" }}>COD</span>
            </div>
            {s.phone && <div style={{ fontSize: "11px", color: "#6B7280" }}>📞 {s.phone}</div>}
            {s.email && <div style={{ fontSize: "11px", color: "#6B7280" }}>✉️ {s.email}</div>}
            {!s.phone && !s.email && <div style={{ fontSize: "11px", color: "#D6D3D1", fontStyle: "italic" }}>No contact info</div>}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginTop: "8px", paddingTop: "8px", borderTop: "1px solid #D6D3D1" }}>
              <div><div style={{ fontSize: "10px", textTransform: "uppercase", color: "#78716C" }}>Materials</div><div style={{ fontSize: "16px", fontWeight: 700, color: "#44403C" }}>{s._count.materials}</div></div>
              <div><div style={{ fontSize: "10px", textTransform: "uppercase", color: "#78716C" }}>Price quotes</div><div style={{ fontSize: "16px", fontWeight: 700, color: "#44403C" }}>{s._count.supplierPrices}</div></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
