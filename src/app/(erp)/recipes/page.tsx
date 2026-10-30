import { db as prisma } from "@/lib/db"
import { AddIngredientDialog } from "./add-ingredient-dialog"

async function getRecipes() {
  return prisma.product.findMany({ include: { recipeLines: { include: { material: { select: { sku: true, name: true, currentStockPacks: true } } }, orderBy: [{ category: "asc" }, { lineCost: "desc" }] } }, orderBy: [{ sku: "asc" }] })
}
async function getMaterials() { return prisma.material.findMany({ where: { unitCost: { gt: 0 } }, select: { id: true, sku: true, name: true, unitCost: true }, orderBy: { name: "asc" } }) }

const CAT_COLOR: Record<string, string> = { flower: "#D1FAE5:#065F46", foliage: "#EFF6FF:#1E40AF", packaging: "#FEF3C7:#92400E", other: "#F3F4F6:#44403C" }

export default async function RecipesPage() {
  const [products, materials] = await Promise.all([getRecipes(), getMaterials()])
  const totalLines = products.reduce((s, p) => s + p.recipeLines.length, 0)
  const issues = products.reduce((s, p) => s + p.recipeLines.filter((l) => l.check !== "OK" && l.check !== null).length, 0)

  return (
    <div>
      <div className="fmd-screen-header">
        <div><h1>Recipes</h1><div className="fmd-subtitle">Bill of materials · what goes into each product</div></div>
      </div>
      <div className="fmd-kpi-bar">
        <div className="fmd-kpi-cell"><div className="fmd-kpi-value" style={{ color: "#44403C" }}>{products.length}</div><div className="fmd-kpi-label">Products</div></div>
        <div className="fmd-kpi-cell"><div className="fmd-kpi-value" style={{ color: "#BE185D" }}>{totalLines}</div><div className="fmd-kpi-label">Recipe lines</div></div>
        <div className="fmd-kpi-cell"><div className="fmd-kpi-value" style={{ color: "#D97706" }}>{issues}</div><div className="fmd-kpi-label">Lines to review</div></div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {products.map((product) => {
          const totalCost = product.recipeLines.reduce((s, l) => s + l.lineCost, 0)
          return (
            <div key={product.id} className="fmd-box" style={{ marginBottom: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px", paddingBottom: "8px", borderBottom: "1px solid #D6D3D1" }}>
                <div>
                  <div style={{ fontSize: "14px", fontWeight: 600, color: "#44403C" }}>{product.name}</div>
                  <div style={{ fontSize: "10px", color: "#78716C", fontFamily: "monospace" }}>{product.sku}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "10px", textTransform: "uppercase", color: "#78716C" }}>Recipe cost</div>
                  <div style={{ fontSize: "18px", fontWeight: 700, color: "#44403C" }}>${totalCost.toLocaleString("es-MX", { maximumFractionDigits: 2 })}</div>
                </div>
              </div>
              <div style={{ marginBottom: "8px" }}><AddIngredientDialog productId={product.id} materials={materials} /></div>
              <div style={{ overflowX: "auto" }}>
                <table className="fmd-table">
                  <thead><tr><th>Component</th><th>Category</th><th>Color</th><th style={{ textAlign: "right" }}>Qty</th><th style={{ textAlign: "right" }}>Unit cost</th><th style={{ textAlign: "right" }}>Line cost</th><th>Check</th></tr></thead>
                  <tbody>
                    {product.recipeLines.map((line) => {
                      const [bg, color] = (CAT_COLOR[line.category] ?? CAT_COLOR.other).split(":")
                      return (
                        <tr key={line.id}>
                          <td style={{ fontWeight: 600, color: "#44403C" }}>{line.componentName}<div style={{ fontSize: "9px", color: "#78716C", fontFamily: "monospace" }}>{line.componentSku}</div></td>
                          <td><span className="fmd-status" style={{ background: bg, color }}>{line.category}</span></td>
                          <td>{line.color ?? "—"}</td>
                          <td style={{ textAlign: "right" }}>{line.qty} {line.unit}</td>
                          <td style={{ textAlign: "right" }}>${line.unitCost?.toFixed(2) ?? "—"}</td>
                          <td style={{ textAlign: "right", fontWeight: 600, color: "#44403C" }}>${line.lineCost?.toFixed(2) ?? "—"}</td>
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
