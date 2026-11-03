export const dynamic = "force-dynamic"

import { db as prisma } from "@/lib/db"
import { AddSupplierDialog } from "./add-supplier-dialog"
import { PriceListDialog } from "./price-list-dialog"

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

async function getMaterials() {
  return prisma.material.findMany({
    where: { packPrice: { gt: 0 } },
    select: { sku: true, name: true, supplier: true, packPrice: true },
    orderBy: { name: "asc" },
  })
}

async function getSupplierComparison() {
  const prices = await prisma.supplierPrice.findMany({
    where: { isLatest: true },
    select: { materialSku: true, supplierName: true, packPrice: true },
  })
  const byMaterial = new Map<string, Array<{ supplier: string; price: number }>>()
  for (const p of prices) {
    if (!byMaterial.has(p.materialSku)) byMaterial.set(p.materialSku, [])
    byMaterial.get(p.materialSku)!.push({ supplier: p.supplierName, price: p.packPrice })
  }
  return Array.from(byMaterial.entries())
    .filter(([_, suppliers]) => suppliers.length >= 2)
    .map(([sku, suppliers]) => {
      const cheapest = suppliers.reduce((min, s) => s.price < min.price ? s : min, suppliers[0])
      return { sku, suppliers, cheapest }
    })
}

export default async function SuppliersPage() {
  const [suppliers, recentPrices, materials, comparison] = await Promise.all([
    getSuppliers(),
    getRecentPrices(),
    getMaterials(),
    getSupplierComparison(),
  ])
  const withContact = suppliers.filter((s) => s.phone || s.email).length
  const totalMaterials = suppliers.reduce((s, sup) => s + sup._count.materials, 0)
  const totalPrices = suppliers.reduce((s, sup) => s + sup._count.supplierPrices, 0)

  return (
    <div>
      <div className="fmd-screen-header">
        <div><h1>Suppliers</h1><div className="fmd-subtitle">Vendor directory · all COD (full payment upfront)</div></div>
        <AddSupplierDialog />
      </div>

      {/* KPI bar */}
      <div className="fmd-kpi-bar hidden lg:flex">
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
                    {s.contactPerson && <span style={{ fontSize: "10px", color: "#78716C", marginLeft: "4px" }}>· {s.contactPerson}</span>}
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
        {suppliers.length === 0 && (
          <div style={{ textAlign: "center", padding: "24px", color: "#9CA3AF", fontSize: "12px" }}>
            No suppliers yet. Click <b>+ Add Supplier</b> above to add your first vendor.
          </div>
        )}
      </div>

      {/* Price List Management */}
      <div className="fmd-box">
        <div className="fmd-box-label">Price List Management · update prices from received quotes</div>
        <div className="fmd-note blue" style={{ marginBottom: "8px" }}>
          When you receive a new price quote from a supplier (WhatsApp, email, photo), log it here. Each update creates a new SupplierPrice row (isLatest = true on new, false on old).
        </div>
        <PriceListDialog
          materials={materials.map((m) => ({ sku: m.sku, name: m.name, supplier: m.supplier, packPrice: m.packPrice }))}
          suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))}
        />
      </div>

      {/* Supplier Comparison */}
      {comparison.length > 0 && (
        <div className="fmd-box" style={{ borderColor: "#BE185D" }}>
          <div className="fmd-box-label" style={{ color: "#BE185D" }}>Supplier Comparison · {comparison.length} materials with 2+ suppliers</div>
          <div style={{ overflowX: "auto" }}>
            <table className="fmd-table">
              <thead>
                <tr>
                  <th>SKU</th>
                  {["LA FINCA", "BDF Palacio Floral SA de CV", "PRO Flor", "OASIS"].map((s) => (
                    <th key={s} style={{ textAlign: "right" }}>{s.replace("BDF Palacio Floral SA de CV", "BDF").replace("Palacio Floral", "")}</th>
                  ))}
                  <th>Cheapest</th>
                </tr>
              </thead>
              <tbody>
                {comparison.map((c) => {
                  const supplierNames = ["LA FINCA", "BDF Palacio Floral SA de CV", "PRO Flor", "OASIS"]
                  return (
                    <tr key={c.sku}>
                      <td style={{ fontFamily: "monospace", fontSize: "10px" }}>{c.sku}</td>
                      {supplierNames.map((supName) => {
                        const found = c.suppliers.find((s) => s.supplier === supName)
                        if (!found) return <td key={supName} style={{ textAlign: "right", color: "#D6D3D1" }}>—</td>
                        const isCheapest = found.supplier === c.cheapest.supplier && found.price === c.cheapest.price
                        return (
                          <td key={supName} style={{ textAlign: "right" }}>
                            <span style={{ fontWeight: isCheapest ? 700 : 400, color: isCheapest ? "#047857" : "#44403C" }}>
                              ${found.price}
                            </span>
                          </td>
                        )
                      })}
                      <td style={{ fontWeight: 600, color: "#047857" }}>
                        {c.cheapest.supplier.replace("BDF Palacio Floral SA de CV", "BDF")} ${c.cheapest.price}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="fmd-note" style={{ marginTop: "8px" }}>
            Green = cheapest. To switch a material's default supplier, change the Supplier field on the Materials page.
          </div>
        </div>
      )}

      {/* Price Update History */}
      <div className="fmd-box">
        <div className="fmd-box-label">Price Update History</div>
        <div style={{ overflowX: "auto" }}>
          <table className="fmd-table">
            <thead><tr><th>Date</th><th>Supplier</th><th>Material</th><th style={{ textAlign: "right" }}>Pack price</th><th>Latest?</th></tr></thead>
            <tbody>
              {recentPrices.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: "center", padding: "16px", color: "#9CA3AF" }}>No price quotes logged yet.</td></tr>
              ) : (
                recentPrices.map((p) => (
                  <tr key={`hist-${p.id}`}>
                    <td style={{ fontSize: "11px" }}>{p.date.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}</td>
                    <td style={{ color: "#44403C" }}>{p.supplierName}</td>
                    <td>{p.material?.name ?? p.materialSku} <span style={{ fontFamily: "monospace", fontSize: "10px", color: "#78716C" }}>{p.materialSku}</span></td>
                    <td style={{ textAlign: "right", fontWeight: 600 }}>${p.packPrice.toLocaleString("es-MX", { maximumFractionDigits: 2 })}</td>
                    <td>{p.isLatest ? <span className="fmd-status accepted">latest</span> : <span className="fmd-status expired">superseded</span>}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Business rules */}
      <div className="fmd-note">⚠️ All suppliers are COD — full payment upfront, no credit terms. Materials.Pack Price reads from the latest Supplier Price per (SKU, supplier). Preferred Supplier on Materials determines which price shows by default.</div>
    </div>
  )
}
