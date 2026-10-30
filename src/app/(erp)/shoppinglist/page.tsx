import { db as prisma } from "@/lib/db"
import { GeneratePdfButton } from "./generate-pdf-button"

async function getShoppingListData() {
  const activeOrders = await prisma.order.findMany({
    where: { status: { in: ["payment_confirmed", "procuring", "producing"] } },
    include: { customer: { select: { name: true } }, lineItems: true },
    orderBy: { deliveryDate: "asc" },
  })
  const allProductSkus = new Set<string>()
  for (const order of activeOrders) { for (const li of order.lineItems) { if (li.productSku) allProductSkus.add(li.productSku) } }
  const products = await prisma.product.findMany({ where: { sku: { in: Array.from(allProductSkus) } }, include: { recipeLines: { include: { material: { select: { sku: true, name: true, category: true, currentStockPacks: true, packPrice: true, unitsPerPack: true, supplier: true } } } } } })
  const productBySku = new Map(products.map((p) => [p.sku, p]))
  const materialNeeds = new Map<string, { sku: string; name: string; category: string; supplier: string | null; currentStockPacks: number | null; packPrice: number | null; unitsPerPack: number | null; totalStemsNeeded: number; orders: string[] }>()
  for (const order of activeOrders) { for (const lineItem of order.lineItems) { const product = productBySku.get(lineItem.productSku); if (!product) continue; for (const recipeLine of product.recipeLines) { const mat = recipeLine.material; if (!mat) continue; const existing = materialNeeds.get(mat.sku) ?? { sku: mat.sku, name: mat.name, category: mat.category, supplier: mat.supplier, currentStockPacks: mat.currentStockPacks, packPrice: mat.packPrice, unitsPerPack: mat.unitsPerPack, totalStemsNeeded: 0, orders: [] }; existing.totalStemsNeeded += recipeLine.qty * lineItem.qty; if (!existing.orders.includes(order.orderNumber)) existing.orders.push(order.orderNumber); materialNeeds.set(mat.sku, existing) } } }
  const materials = Array.from(materialNeeds.values()).map((m) => { const upp = m.unitsPerPack ?? 12; const packsNeeded = Math.ceil(m.totalStemsNeeded / upp); const stock = m.currentStockPacks ?? 0; const packsToBuy = Math.max(0, packsNeeded - stock); return { ...m, packsNeeded, packsToBuy, estimatedCost: packsToBuy * (m.packPrice ?? 0), unitsPerPack: upp } })
  const bySupplier = materials.reduce((acc, m) => { const sup = m.supplier ?? "Unassigned"; if (!acc[sup]) acc[sup] = { materials: [], totalCost: 0, packsToBuy: 0 }; acc[sup].materials.push(m); acc[sup].totalCost += m.estimatedCost; acc[sup].packsToBuy += m.packsToBuy; return acc }, {} as Record<string, { materials: typeof materials; totalCost: number; packsToBuy: number }>)
  return { activeOrders, materials, bySupplier }
}

export default async function ShoppingListPage() {
  const { activeOrders, materials, bySupplier } = await getShoppingListData()
  const totalPacks = materials.reduce((s, m) => s + m.packsToBuy, 0)
  const totalCost = materials.reduce((s, m) => s + m.estimatedCost, 0)

  return (
    <div>
      <div className="fmd-screen-header">
        <div><h1>Shopping List</h1><div className="fmd-subtitle">Procurement plan for active orders</div></div>
        <GeneratePdfButton activeOrders={activeOrders} />
      </div>
      <div className="fmd-kpi-bar">
        <div className="fmd-kpi-cell"><div className="fmd-kpi-value" style={{ color: "#44403C" }}>{activeOrders.length}</div><div className="fmd-kpi-label">Active orders</div></div>
        <div className="fmd-kpi-cell"><div className="fmd-kpi-value" style={{ color: "#BE185D" }}>{materials.length}</div><div className="fmd-kpi-label">Materials needed</div></div>
        <div className="fmd-kpi-cell"><div className="fmd-kpi-value" style={{ color: "#D97706" }}>{totalPacks}</div><div className="fmd-kpi-label">Packs to buy</div></div>
        <div className="fmd-kpi-cell"><div className="fmd-kpi-value" style={{ color: "#991B1B" }}>${totalCost.toLocaleString("es-MX", { maximumFractionDigits: 0 })}</div><div className="fmd-kpi-label">Est. cost</div></div>
      </div>
      {activeOrders.length > 0 && (
        <div className="fmd-box">
          <div className="fmd-box-label">Active Orders Feeding This List</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {activeOrders.map((o) => (<span key={o.id} className="fmd-flow-step" style={{ background: "#EFF6FF", borderColor: "#BFDBFE", color: "#1E40AF" }}>{o.orderNumber} · {o.customer.name}</span>))}
          </div>
        </div>
      )}
      {Object.keys(bySupplier).length === 0 ? (
        <div className="fmd-note">No active orders in the pipeline. Shopping list populates when orders reach payment_confirmed status.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {Object.entries(bySupplier).map(([supplier, data]) => (
            <div key={supplier} className="fmd-box" style={{ marginBottom: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", paddingBottom: "8px", borderBottom: "1px solid #D6D3D1" }}>
                <div style={{ fontSize: "14px", fontWeight: 600, color: "#44403C" }}>🏭 {supplier}</div>
                <div style={{ fontSize: "16px", fontWeight: 700, color: "#44403C" }}>${data.totalCost.toLocaleString("es-MX", { maximumFractionDigits: 0 })}</div>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table className="fmd-table">
                  <thead><tr><th>SKU</th><th>Material</th><th style={{ textAlign: "right" }}>Stems</th><th style={{ textAlign: "right" }}>Packs</th><th style={{ textAlign: "right" }}>Stock</th><th style={{ textAlign: "right" }}>To buy</th><th style={{ textAlign: "right" }}>Cost</th></tr></thead>
                  <tbody>{data.materials.map((m) => (<tr key={m.sku}><td style={{ fontFamily: "monospace", fontSize: "10px" }}>{m.sku}</td><td style={{ fontWeight: 600, color: "#44403C" }}>{m.name}</td><td style={{ textAlign: "right" }}>{m.totalStemsNeeded}</td><td style={{ textAlign: "right" }}>{m.packsNeeded}</td><td style={{ textAlign: "right", color: "#78716C" }}>{m.currentStockPacks ?? 0}</td><td style={{ textAlign: "right", fontWeight: 700, color: m.packsToBuy > 0 ? "#D97706" : "#047857" }}>{m.packsToBuy > 0 ? m.packsToBuy : "✓"}</td><td style={{ textAlign: "right" }}>${m.estimatedCost.toLocaleString("es-MX", { maximumFractionDigits: 0 })}</td></tr>))}</tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
