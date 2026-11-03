export const dynamic = "force-dynamic"

import { db as prisma } from "@/lib/db"
import { AddProductDialog } from "./add-product-dialog"
import { AssetImage } from "@/components/asset-image"

async function getProducts() {
  return prisma.product.findMany({ include: { _count: { select: { recipeLines: true } } }, orderBy: [{ sku: "asc" }] })
}

export default async function ProductsPage() {
  const products = await getProducts()
  const withPhoto = products.filter((p) => p.cloudinaryPublicId).length
  const avgMargin = products.length > 0 ? Math.round(products.reduce((s, p) => s + p.marginPct, 0) / products.length * 100) : 0
  const totalValue = products.reduce((s, p) => s + p.actualPriceWithIva, 0)

  return (
    <div>
      <div className="fmd-screen-header">
        <div><h1>Products</h1><div className="fmd-subtitle">Catalogue with Cloudinary photos</div></div>
        <AddProductDialog />
      </div>
      <div className="fmd-kpi-bar">
        <div className="fmd-kpi-cell"><div className="fmd-kpi-value" style={{ color: "#44403C" }}>{products.length}</div><div className="fmd-kpi-label">Total products</div></div>
        <div className="fmd-kpi-cell"><div className="fmd-kpi-value" style={{ color: "#047857" }}>{withPhoto}</div><div className="fmd-kpi-label">With photo</div></div>
        <div className="fmd-kpi-cell"><div className="fmd-kpi-value" style={{ color: "#BE185D" }}>{avgMargin}%</div><div className="fmd-kpi-label">Avg margin</div></div>
        <div className="fmd-kpi-cell"><div className="fmd-kpi-value" style={{ color: "#44403C" }}>${totalValue.toLocaleString("es-MX", { maximumFractionDigits: 0 })}</div><div className="fmd-kpi-label">Catalogue value</div></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "8px" }}>
        {products.map((product) => {
          const hasPhoto = Boolean(product.cloudinaryPublicId)
          return (
            <div key={product.id} className="fmd-box" style={{ marginBottom: 0, display: "flex", gap: "12px" }}>
              <div style={{ width: "80px", height: "80px", borderRadius: "8px", overflow: "hidden", background: "#F3F4F6", flexShrink: 0 }}>
                {hasPhoto ? <AssetImage publicId={product.cloudinaryPublicId!} alt={product.name} variant="square" className="h-full w-full" /> : <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center", fontSize: "24px", color: "#D6D3D1" }}>💐</div>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "4px" }}>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: "#44403C" }}>{product.name}</div>
                  {product.size && <span className="fmd-status" style={{ background: "#F3F4F6", color: "#44403C" }}>{product.size}</span>}
                </div>
                <div style={{ fontSize: "10px", color: "#78716C", fontFamily: "monospace" }}>{product.sku}</div>
                <div style={{ fontSize: "16px", fontWeight: 700, color: "#BE185D", marginTop: "4px" }}>${product.actualPriceWithIva.toLocaleString("es-MX", { maximumFractionDigits: 0 })} MXN</div>
                <div style={{ fontSize: "10px", color: "#78716C" }}>Margin: {Math.round(product.marginPct * 100)}% · {product._count.recipeLines} recipe items</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
