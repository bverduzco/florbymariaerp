export const dynamic = "force-dynamic"

import { db as prisma } from "@/lib/db"
import { GeneratePdfButton } from "./generate-pdf-button"
import { CreatePosButton } from "./create-pos-button"
import { OrderDetailDialog } from "@/components/order-detail-dialog"
import { serializeOrderForDetail } from "@/lib/order-detail-serializer"

async function getShoppingListData() {
  const activeOrders = await prisma.order.findMany({
    where: { status: { in: ["payment_confirmed", "procuring", "producing"] } },
    include: {
      customer: { select: { name: true, phone: true, email: true, address: true } },
      event: { select: { eventNumber: true, name: true, eventDate: true } },
      lineItems: {
        select: {
          id: true,
          productSku: true,
          productName: true,
          productSize: true,
          qty: true,
          unitPrice: true,
        },
      },
      executionLogs: {
        select: {
          id: true,
          executionNumber: true,
          status: true,
          executedAt: true,
          actualCost: true,
          lines: {
            select: {
              materialName: true,
              qtyUsed: true,
              unit: true,
              lineCost: true,
              type: true,
            },
          },
        },
        orderBy: { executedAt: "desc" },
        take: 5, // only need a few for the detail dialog preview
      },
    },
    orderBy: { deliveryDate: "asc" },
  })
  const allProductSkus = new Set<string>()
  for (const order of activeOrders) { for (const li of order.lineItems) { if (li.productSku) allProductSkus.add(li.productSku) } }
  const products = await prisma.product.findMany({ where: { sku: { in: Array.from(allProductSkus) } }, include: { recipeLines: { include: { material: { select: { sku: true, name: true, category: true, currentStockPacks: true, packPrice: true, unitsPerPack: true, supplier: true } } } } } })
  const productBySku = new Map(products.map((p) => [p.sku, p]))
  const materialNeeds = new Map<string, { sku: string; name: string; category: string; supplier: string | null; currentStockPacks: number | null; packPrice: number | null; unitsPerPack: number | null; totalStemsNeeded: number; orders: string[] }>()
  for (const order of activeOrders) { for (const lineItem of order.lineItems) { const product = productBySku.get(lineItem.productSku); if (!product) continue; for (const recipeLine of product.recipeLines) { const mat = recipeLine.material; if (!mat) continue; const existing = materialNeeds.get(mat.sku) ?? { sku: mat.sku, name: mat.name, category: mat.category, supplier: mat.supplier, currentStockPacks: mat.currentStockPacks, packPrice: mat.packPrice, unitsPerPack: mat.unitsPerPack, totalStemsNeeded: 0, orders: [] }; existing.totalStemsNeeded += recipeLine.qty * lineItem.qty; if (!existing.orders.includes(order.orderNumber)) existing.orders.push(order.orderNumber); materialNeeds.set(mat.sku, existing) } } }
  const materials = Array.from(materialNeeds.values()).map((m) => {
    // IMPORTANT: must use the `> 0` fallback pattern, not `?? 12`.
    // `unitsPerPack ?? 12` only falls back to 12 when the value is
    // null/undefined. But the DB also has materials with unitsPerPack = 0
    // (legacy / not-set), and `totalStemsNeeded / 0` returns Infinity,
    // which JSON.stringify converts to null, which Prisma rejects with
    // "Argument qtyPacks is missing" downstream in the create-POs flow.
    // Same pattern as /api/losses/route.ts line 57.
    const upp = m.unitsPerPack && m.unitsPerPack > 0 ? m.unitsPerPack : 12;
    const packsNeeded = Math.ceil(m.totalStemsNeeded / upp);
    const stock = m.currentStockPacks ?? 0;
    const packsToBuy = Math.max(0, packsNeeded - stock);
    const unitsPerPackMissing = !m.unitsPerPack || m.unitsPerPack <= 0;
    return { ...m, packsNeeded, packsToBuy, estimatedCost: packsToBuy * (m.packPrice ?? 0), unitsPerPack: upp, unitsPerPackMissing }
  })
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
        <div style={{ display: "flex", gap: "8px" }}>
          <GeneratePdfButton activeOrders={activeOrders} />
          <CreatePosButton supplierGroups={Object.entries(bySupplier).map(([supplier, data]) => ({
            supplier,
            materials: data.materials.map((m) => ({ sku: m.sku, name: m.name, packsToBuy: m.packsToBuy, estimatedCost: m.estimatedCost, packPrice: m.packPrice })),
            totalCost: data.totalCost,
          }))} />
        </div>
      </div>
      <div className="fmd-kpi-bar hidden lg:flex">
        <div className="fmd-kpi-cell"><div className="fmd-kpi-value" style={{ color: "#44403C" }}>{activeOrders.length}</div><div className="fmd-kpi-label">Active orders</div></div>
        <div className="fmd-kpi-cell"><div className="fmd-kpi-value" style={{ color: "#BE185D" }}>{materials.length}</div><div className="fmd-kpi-label">Materials needed</div></div>
        <div className="fmd-kpi-cell"><div className="fmd-kpi-value" style={{ color: "#D97706" }}>{totalPacks}</div><div className="fmd-kpi-label">Packs to buy</div></div>
        <div className="fmd-kpi-cell"><div className="fmd-kpi-value" style={{ color: "#991B1B" }}>${totalCost.toLocaleString("es-MX", { maximumFractionDigits: 0 })}</div><div className="fmd-kpi-label">Est. cost</div></div>
      </div>
      {activeOrders.length > 0 && (
        <div className="fmd-box">
          <div className="fmd-box-label">Active Orders Feeding This List · click any order for full details</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {activeOrders.map((o) => (
              <OrderDetailDialog
                key={o.id}
                order={serializeOrderForDetail(o)}
                trigger={
                  <button
                    className="fmd-flow-step hover:shadow-sm transition"
                    style={{ background: "#EFF6FF", borderColor: "#BFDBFE", color: "#1E40AF", cursor: "pointer" }}
                    title={`View details for ${o.orderNumber}`}
                  >
                    {o.orderNumber} · {o.customer?.name ?? "—"}
                  </button>
                }
              />
            ))}
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
                  <tbody>{data.materials.map((m) => (<tr key={m.sku}><td style={{ fontFamily: "monospace", fontSize: "10px" }}>{m.sku}</td><td style={{ fontWeight: 600, color: "#44403C" }}>{m.name}{m.unitsPerPackMissing && <span style={{ marginLeft: "6px", fontSize: "9px", color: "#B45309", background: "#FEF3C7", border: "1px solid #FCD34D", borderRadius: "3px", padding: "1px 4px", fontWeight: 600, verticalAlign: "middle" }} title={`unitsPerPack is missing or 0 — using fallback of 12. Update the material to get accurate pack counts.`}>⚠ units/pack missing</span>}</td><td style={{ textAlign: "right" }}>{m.totalStemsNeeded}</td><td style={{ textAlign: "right" }}>{m.packsNeeded}</td><td style={{ textAlign: "right", color: "#78716C" }}>{m.currentStockPacks ?? 0}</td><td style={{ textAlign: "right", fontWeight: 700, color: m.packsToBuy > 0 ? "#D97706" : "#047857" }}>{m.packsToBuy > 0 ? m.packsToBuy : "✓"}</td><td style={{ textAlign: "right" }}>${m.estimatedCost.toLocaleString("es-MX", { maximumFractionDigits: 0 })}</td></tr>))}</tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
