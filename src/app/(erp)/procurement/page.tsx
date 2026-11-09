export const dynamic = "force-dynamic"

import { db as prisma } from "@/lib/db"
import { NewPoDialog } from "./new-po-dialog"
import { AdHocPurchaseDialog } from "./ad-hoc-purchase-dialog"
import { MissingPurchaseActions } from "./missing-purchase-actions"
import { PODetailDialog } from "@/components/po-detail-dialog"

async function getPurchaseOrders() {
  return prisma.purchaseOrder.findMany({
    include: { _count: { select: { lines: true } }, lines: { select: { id: true, materialSku: true, materialName: true, qtyPacks: true, costPerPack: true, lineTotal: true }, orderBy: { materialName: "asc" } } },
    orderBy: { poNumber: "asc" },
  })
}
async function getSuppliers() { return prisma.supplier.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }) }
async function getAdHocPurchases() {
  return prisma.adHocPurchase.findMany({ orderBy: { date: "desc" }, take: 10 })
}
async function getSupplierComparison() {
  // Get all supplier prices where isLatest = true, grouped by materialSku
  const prices = await prisma.supplierPrice.findMany({
    where: { isLatest: true },
    select: { materialSku: true, supplierName: true, packPrice: true },
    orderBy: { materialSku: "asc" },
  })
  // Group by materialSku
  const byMaterial = new Map<string, Array<{ supplier: string; price: number }>>()
  for (const p of prices) {
    if (!byMaterial.has(p.materialSku)) byMaterial.set(p.materialSku, [])
    byMaterial.get(p.materialSku)!.push({ supplier: p.supplierName, price: p.packPrice })
  }
  // Only include materials with 2+ suppliers
  const comparison = Array.from(byMaterial.entries())
    .filter(([_, suppliers]) => suppliers.length >= 2)
    .map(([sku, suppliers]) => {
      const laFinca = suppliers.find((s) => s.supplier === "LA FINCA")
      const lfPrice = laFinca?.price ?? null
      const cheapest = suppliers.reduce((min, s) => s.price < min.price ? s : min, suppliers[0])
      return { sku, suppliers, lfPrice, cheapest }
    })
  return comparison
}

async function getMissingPurchases() {
  try {
    return await prisma.missingPurchaseLog.findMany({
      where: { resolvedAt: null },
      orderBy: { createdAt: "desc" },
    })
  } catch {
    return []
  }
}

export default async function ProcurementPage() {
  const [pos, suppliers, adHocs, comparison, materials, missingPurchases] = await Promise.all([
    getPurchaseOrders(),
    getSuppliers(),
    getAdHocPurchases(),
    getSupplierComparison(),
    prisma.material.findMany({
      where: { sku: { not: "" } },
      select: { sku: true, name: true, unit: true, packPrice: true },
      orderBy: { name: "asc" },
    }),
    getMissingPurchases(),
  ])
  const received = pos.filter((p) => p.status === "received").length
  const totalCost = pos.reduce((s, p) => s + p.totalCost, 0)
  const adHocTotal = adHocs.reduce((s, a) => s + a.total, 0)

  return (
    <div>
      <div className="fmd-screen-header">
        <div><h1>Procurement</h1><div className="fmd-subtitle">Buying materials — formal POs + ad-hoc purchases + supplier comparison</div></div>
        <div style={{ display: "flex", gap: "8px" }}>
          <NewPoDialog suppliers={suppliers.map((s) => s.name)} />
          <AdHocPurchaseDialog materials={materials} />
        </div>
      </div>

      <div className="fmd-kpi-bar hidden lg:flex">
        <div className="fmd-kpi-cell"><div className="fmd-kpi-value" style={{ color: "#44403C" }}>{pos.length}</div><div className="fmd-kpi-label">Total POs</div></div>
        <div className="fmd-kpi-cell"><div className="fmd-kpi-value" style={{ color: "#047857" }}>{received}</div><div className="fmd-kpi-label">Received</div></div>
        <div className="fmd-kpi-cell"><div className="fmd-kpi-value" style={{ color: "#BE185D" }}>${totalCost.toLocaleString("es-MX", { maximumFractionDigits: 0 })}</div><div className="fmd-kpi-label">PO total spent</div></div>
        <div className="fmd-kpi-cell"><div className="fmd-kpi-value" style={{ color: "#D97706" }}>${adHocTotal.toLocaleString("es-MX", { maximumFractionDigits: 0 })}</div><div className="fmd-kpi-label">Ad-hoc total</div></div>
      </div>

      {/* Missing Purchase Warnings */}
      {missingPurchases.length > 0 && (
        <div className="fmd-box" style={{ borderColor: "#FCA5A5", background: "#FEF2F2", marginBottom: "16px" }}>
          <div className="fmd-box-label" style={{ color: "#991B1B" }}>
            ⚠ Missing Purchase Logs ({missingPurchases.length}) — these purchases are missing, create Ad-hoc purchase
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {missingPurchases.map((mp) => (
              <div key={mp.id} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 12px", background: "#fff", border: "1px solid #FECACA", borderRadius: "6px", fontSize: "12px" }}>
                <span style={{ fontFamily: "monospace", fontSize: "10px", color: "#78716C" }}>{mp.materialSku}</span>
                <span style={{ fontWeight: 600, color: "#44403C" }}>{mp.materialName}</span>
                <span style={{ color: "#991B1B" }}>— {mp.qtyShort} packs needed · est. ${mp.estCost.toLocaleString("es-MX", { maximumFractionDigits: 0 })}</span>
                <span style={{ color: "#9CA3AF", fontSize: "10px" }}>via {mp.triggerRef}</span>
                <MissingPurchaseActions id={mp.id} materialSku={mp.materialSku} materialName={mp.materialName} qtyShort={mp.qtyShort} estCost={mp.estCost} triggerRef={mp.triggerRef} />
              </div>
            ))}
          </div>
          <div className="fmd-note" style={{ marginTop: "8px", background: "#fff", borderColor: "#FECACA", color: "#991B1B" }}>
            These materials were used in a loss or execution but weren't in inventory. Log the missing purchase (with real price + supplier) or mark as donation if the materials were gifted.
          </div>
        </div>
      )}

      {/* Two-column: POs + Ad-hoc Purchases */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "16px", marginBottom: "16px" }}>
        {/* Purchase Orders (formal) */}
        <div className="fmd-box" style={{ marginBottom: 0 }}>
          <div className="fmd-box-label">Purchase Orders (formal) — {pos.length}</div>
          <div style={{ overflowX: "auto" }}>
            <table className="fmd-table">
              <thead><tr><th>PO #</th><th>Date</th><th>Supplier</th><th>Items</th><th style={{ textAlign: "right" }}>Total</th><th>Status</th></tr></thead>
              <tbody>
                {pos.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: "center", padding: "16px", color: "#9CA3AF" }}>No purchase orders yet.</td></tr>
                ) : (
                  pos.map((po) => (
                    <tr key={po.id}>
                      <td style={{ padding: "8px 12px" }}>
                        <PODetailDialog
                          po={{
                            id: po.id,
                            poNumber: po.poNumber,
                            supplier: po.supplier,
                            status: po.status,
                            totalCost: po.totalCost,
                            notes: po.notes,
                            createdAt: po.createdAt,
                            updatedAt: po.updatedAt,
                            lines: po.lines,
                          }}
                          trigger={
                            <button
                              className="font-mono text-[11px] font-bold text-stone-900 hover:text-rose-700 hover:underline transition"
                              title={`View details for ${po.poNumber}`}
                            >
                              {po.poNumber}
                            </button>
                          }
                        />
                      </td>
                      <td>{po.createdAt.toLocaleDateString("es-MX", { day: "2-digit", month: "short" })}</td>
                      <td style={{ color: "#44403C" }}>{po.supplier}</td>
                      <td>{po._count.lines} items</td>
                      <td style={{ textAlign: "right", fontWeight: 600, color: "#44403C" }}>${po.totalCost.toLocaleString("es-MX", { maximumFractionDigits: 0 })}</td>
                      <td><span className={`fmd-status ${po.status === "received" ? "accepted" : po.status === "cancelled" ? "cancelled" : "pending"}`}>{po.status}</span></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Ad-hoc Purchases (whim / market runs) */}
        <div className="fmd-box" style={{ marginBottom: 0 }}>
          <div className="fmd-box-label">Ad-hoc Purchases (whim / market runs) — {adHocs.length}</div>
          {adHocs.length === 0 ? (
            <div style={{ textAlign: "center", padding: "16px", color: "#9CA3AF", fontSize: "12px" }}>No ad-hoc purchases logged.</div>
          ) : (
            <>
              <div style={{ overflowX: "auto" }}>
                <table className="fmd-table">
                  <thead><tr><th>ID</th><th>Date</th><th>Vendor</th><th>Item</th><th style={{ textAlign: "right" }}>Qty</th><th style={{ textAlign: "right" }}>Cost</th></tr></thead>
                  <tbody>
                    {adHocs.map((a) => (
                      <tr key={a.id}>
                        <td style={{ fontFamily: "monospace", fontSize: "10px" }}>{a.adhocNumber}</td>
                        <td>{a.date.toLocaleDateString("es-MX", { day: "2-digit", month: "short" })}</td>
                        <td style={{ color: "#44403C" }}>{a.vendor}</td>
                        <td>
                          <div style={{ fontWeight: 600, color: "#44403C" }}>
                            {a.materialName ?? a.materialSku ?? "—"}
                          </div>
                          {a.materialSku ? (
                            <div style={{ fontSize: "10px", color: "#78716C", fontFamily: "monospace" }}>{a.materialSku}</div>
                          ) : (
                            <div style={{ fontSize: "10px", color: "#D97706" }}>no SKU · {a.materialType ?? "—"}</div>
                          )}
                        </td>
                        <td style={{ textAlign: "right" }}>{a.qtyPacks}</td>
                        <td style={{ textAlign: "right", fontWeight: 600, color: "#44403C" }}>${a.total.toLocaleString("es-MX", { maximumFractionDigits: 0 })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ fontSize: "13px", fontWeight: 600, color: "#44403C", marginTop: "8px", paddingTop: "8px", borderTop: "1px solid #D6D3D1" }}>
                Total ad-hoc: ${adHocTotal.toLocaleString("es-MX", { maximumFractionDigits: 0 })} ({adHocs.length} items)
              </div>
            </>
          )}
        </div>
      </div>

      {/* Supplier Comparison */}
      <div className="fmd-box">
        <div className="fmd-box-label">Supplier Comparison (side-by-side prices)</div>
        {comparison.length === 0 ? (
          <div style={{ textAlign: "center", padding: "16px", color: "#9CA3AF", fontSize: "12px" }}>No materials with multiple supplier prices yet. Log prices from different suppliers to see comparisons.</div>
        ) : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table className="fmd-table">
                <thead>
                  <tr>
                    <th>SKU</th>
                    {["LA FINCA", "Florería García", "BDF", "PRO Flor", "OASIS"].map((s) => (
                      <th key={s} style={{ textAlign: "right" }}>{s.replace("Florería García", "García").replace("BDF Palacio Floral SA de CV", "BDF")}</th>
                    ))}
                    <th>Cheapest</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.slice(0, 20).map((c) => {
                    const suppliers = ["LA FINCA", "Florería García", "BDF Palacio Floral SA de CV", "PRO Flor", "OASIS"]
                    return (
                      <tr key={c.sku}>
                        <td style={{ fontFamily: "monospace", fontSize: "10px" }}>{c.sku}</td>
                        {suppliers.map((supName) => {
                          const found = c.suppliers.find((s) => s.supplier === supName)
                          if (!found) return <td key={supName} style={{ textAlign: "right", color: "#D6D3D1" }}>—</td>
                          const isCheapest = found.supplier === c.cheapest.supplier && found.price === c.cheapest.price
                          const diff = c.lfPrice ? ((found.price - c.lfPrice) / c.lfPrice * 100) : 0
                          const diffColor = diff < 0 ? "#047857" : diff > 0 ? "#D97706" : "#78716C"
                          return (
                            <td key={supName} style={{ textAlign: "right" }}>
                              <span style={{ fontWeight: isCheapest ? 700 : 400, color: isCheapest ? "#047857" : "#44403C" }}>${found.price}</span>
                              {c.lfPrice && found.supplier !== "LA FINCA" && (
                                <span style={{ fontSize: "9px", color: diffColor, marginLeft: "2px" }}>
                                  {diff > 0 ? "+" : ""}{diff.toFixed(0)}%
                                </span>
                              )}
                            </td>
                          )
                        })}
                        <td style={{ fontWeight: 600, color: "#047857" }}>
                          {c.cheapest.supplier.replace("Florería García", "García").replace("BDF Palacio Floral SA de CV", "BDF")} ${c.cheapest.price}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {comparison.length > 20 && (
              <div style={{ textAlign: "center", padding: "8px", color: "#78716C", fontSize: "11px" }}>
                ... {comparison.length - 20} more materials with multi-supplier pricing
              </div>
            )}
            <div className="fmd-note" style={{ marginTop: "8px" }}>
              Green = cheaper than LA FINCA. To switch a material's price, change Preferred Supplier on Materials sheet.
            </div>
          </>
        )}
      </div>
    </div>
  )
}
