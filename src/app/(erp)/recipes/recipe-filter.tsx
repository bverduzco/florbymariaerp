"use client"

import { useState } from "react"
import { AddIngredientDialog } from "./add-ingredient-dialog"

type RecipeLine = {
  id: string
  componentSku: string
  componentName: string
  qty: number
  unit: string
  unitCost: number
  lineCost: number
  category: string
  color: string | null
  check: string | null
  material: { sku: string; name: string; currentStockPacks: number | null } | null
}

type ProductLite = {
  id: string
  sku: string
  name: string
  size: string | null
  linesToReview: number
  recipeLines: RecipeLine[]
}

type MaterialLite = {
  id: string
  sku: string
  name: string
  unitCost: number
}

type VersionLite = {
  id: string
  version: string
  status: string
  effectiveFrom: string
  product: { sku: string; name: string }
}

const CAT_COLOR: Record<string, string> = {
  flower: "#D1FAE5:#065F46",
  foliage: "#EFF6FF:#1E40AF",
  packaging: "#FEF3C7:#92400E",
  other: "#F3F4F6:#44403C",
}

export function RecipeFilter({
  products,
  materials,
  versionsByProduct,
}: {
  products: ProductLite[]
  materials: MaterialLite[]
  versionsByProduct: Record<string, VersionLite[]>
}) {
  const [productFilter, setProductFilter] = useState<string>("all")
  const [versionFilter, setVersionFilter] = useState<string>("all")

  const filtered = products.filter((p) => {
    if (productFilter !== "all" && p.id !== productFilter) return false
    return true
  })

  // Get versions for the selected product (or all products)
  const availableVersions = productFilter !== "all"
    ? (versionsByProduct[products.find((p) => p.id === productFilter)?.sku ?? ""] ?? [])
    : []

  return (
    <div>
      {/* Filter bar */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "12px" }}>
        <select
          value={productFilter}
          onChange={(e) => { setProductFilter(e.target.value); setVersionFilter("all") }}
          style={{ padding: "4px 10px", fontSize: "12px", border: "1px solid #D6D3D1", borderRadius: "4px", background: "#fff", color: "#44403C" }}
        >
          <option value="all">Filter: All products</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}{p.size ? ` (${p.size})` : ""} — {p.sku}
            </option>
          ))}
        </select>

        {productFilter !== "all" && availableVersions.length > 0 && (
          <select
            value={versionFilter}
            onChange={(e) => setVersionFilter(e.target.value)}
            style={{ padding: "4px 10px", fontSize: "12px", border: "1px solid #D6D3D1", borderRadius: "4px", background: "#fff", color: "#44403C" }}
          >
            <option value="all">Version: All</option>
            {availableVersions.map((v) => (
              <option key={v.id} value={v.version}>
                {v.version} ({v.status}) — {new Date(v.effectiveFrom).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}
              </option>
            ))}
          </select>
        )}

        <div style={{ fontSize: "11px", color: "#78716C", alignSelf: "center" }}>
          {filtered.length} of {products.length} products shown
        </div>
      </div>

      {/* Recipe cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {filtered.map((product) => {
          const totalCost = product.recipeLines.reduce((s, l) => s + l.lineCost, 0)
          const versions = versionsByProduct[product.sku] ?? []
          return (
            <div key={product.id} className="fmd-box" style={{ marginBottom: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px", paddingBottom: "8px", borderBottom: "1px solid #D6D3D1" }}>
                <div>
                  <div style={{ fontSize: "14px", fontWeight: 600, color: "#44403C" }}>
                    Recipe: {product.name}
                    {product.size ? ` (${product.size})` : ""}
                    {versions.length > 0 && (
                      <span style={{ fontSize: "11px", color: "#78716C", marginLeft: "6px" }}>
                        — {versions.map((v) => v.version).join(", ")}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: "10px", color: "#78716C", fontFamily: "monospace" }}>{product.sku}</div>
                  {versions.length > 0 && (
                    <div style={{ fontSize: "10px", color: "#78716C", marginTop: "2px" }}>
                      {versions.map((v) => `${v.version} (${v.status}, ${new Date(v.effectiveFrom).toLocaleDateString("es-MX", { day: "2-digit", month: "short" })})`).join(" · ")}
                    </div>
                  )}
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "10px", textTransform: "uppercase", color: "#78716C" }}>Total Cost</div>
                  <div style={{ fontSize: "18px", fontWeight: 700, color: "#44403C" }}>${totalCost.toLocaleString("es-MX", { maximumFractionDigits: 2 })}</div>
                  {product.linesToReview > 0 && <div style={{ fontSize: "10px", color: "#D97706", marginTop: "2px" }}>{product.linesToReview} to review</div>}
                </div>
              </div>

              <div style={{ marginBottom: "8px" }}>
                <AddIngredientDialog productId={product.id} materials={materials} />
              </div>

              <div style={{ overflowX: "auto" }}>
                <table className="fmd-table">
                  <thead>
                    <tr>
                      <th>Material SKU</th>
                      <th>Component</th>
                      <th>Category</th>
                      <th>Color</th>
                      <th style={{ textAlign: "right" }}>Qty</th>
                      <th style={{ textAlign: "right" }}>Unit Cost</th>
                      <th style={{ textAlign: "right" }}>Line Cost</th>
                      <th>Check</th>
                    </tr>
                  </thead>
                  <tbody>
                    {product.recipeLines.map((line) => {
                      const [bg, color] = (CAT_COLOR[line.category] ?? CAT_COLOR.other).split(":")
                      return (
                        <tr key={line.id}>
                          <td style={{ fontFamily: "monospace", fontSize: "10px" }}>{line.componentSku}</td>
                          <td style={{ fontWeight: 600, color: "#44403C" }}>{line.componentName}</td>
                          <td><span className="fmd-status" style={{ background: bg, color }}>{line.category}</span></td>
                          <td>{line.color ?? "—"}</td>
                          <td style={{ textAlign: "right" }}>{line.qty} {line.unit}</td>
                          <td style={{ textAlign: "right" }}>{line.unitCost ? `$${line.unitCost.toFixed(2)}` : <span style={{ color: "#D6D3D1" }}>—</span>}</td>
                          <td style={{ textAlign: "right", fontWeight: 600, color: "#44403C" }}>{line.lineCost ? `$${line.lineCost.toFixed(2)}` : <span style={{ color: "#D6D3D1" }}>—</span>}</td>
                          <td><span className={`fmd-status ${line.check === "OK" ? "accepted" : "pending"}`}>{line.check ?? "OK"}</span></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
