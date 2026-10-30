import { db as prisma } from "@/lib/db"

async function getCustomMaterials() { return prisma.customMaterial.findMany({ orderBy: [{ type: "asc" }, { name: "asc" }] }) }

export default async function CustomPage() {
  const materials = await getCustomMaterials()
  const flowers = materials.filter((m) => m.type === "flower").length
  const foliage = materials.filter((m) => m.type === "foliage").length
  const withMatch = materials.filter((m) => m.erpSku).length
  const avgPrice = materials.length > 0 ? materials.reduce((s, m) => s + m.pricePerStem, 0) / materials.length : 0

  return (
    <div>
      <div className="fmd-screen-header"><div><h1>Custom Bouquet Builder</h1><div className="fmd-subtitle">Build-a-bouquet with custom materials</div></div></div>
      <div className="fmd-kpi-bar">
        <div className="fmd-kpi-cell"><div className="fmd-kpi-value" style={{ color: "#44403C" }}>{materials.length}</div><div className="fmd-kpi-label">Available materials</div></div>
        <div className="fmd-kpi-cell"><div className="fmd-kpi-value" style={{ color: "#BE185D" }}>{flowers}🌹 / {foliage}🌿</div><div className="fmd-kpi-label">Flowers / Foliage</div></div>
        <div className="fmd-kpi-cell"><div className="fmd-kpi-value" style={{ color: "#047857" }}>{withMatch}</div><div className="fmd-kpi-label">ERP SKU matched</div></div>
        <div className="fmd-kpi-cell"><div className="fmd-kpi-value" style={{ color: "#D97706" }}>${avgPrice.toFixed(2)}</div><div className="fmd-kpi-label">Avg price/stem</div></div>
      </div>
      <div className="fmd-box">
        <div className="fmd-box-label">Available Materials ({materials.length})</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "8px" }}>
          {materials.map((m) => (
            <div key={m.id} style={{ padding: "10px", border: "1px solid #D6D3D1", borderRadius: "6px", background: "#ffffff" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "#44403C" }}>{m.name}</div>
                <div style={{ fontSize: "14px", fontWeight: 700, color: "#BE185D" }}>${m.pricePerStem.toFixed(2)}</div>
              </div>
              <div style={{ marginTop: "6px" }}>
                {m.erpSku ? <span className="fmd-status accepted">✓ {m.erpSku}</span> : <span className="fmd-status expired">no ERP match</span>}
                {m.matchConfidence && <span className="fmd-status pending" style={{ marginLeft: "4px" }}>{m.matchConfidence.replace(/_/g, " ")}</span>}
              </div>
              <div style={{ fontSize: "10px", color: "#78716C", marginTop: "4px" }}>{m.type} · {m.class ?? "—"} · {m.source}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
