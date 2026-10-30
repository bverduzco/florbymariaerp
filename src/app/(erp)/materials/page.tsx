import { db as prisma } from "@/lib/db"
import { AddMaterialDialog } from "./add-material-dialog"
import { MaterialSearch } from "./material-search"

async function getMaterials() {
  return prisma.material.findMany({
    select: { id: true, sku: true, name: true, category: true, unit: true, unitCost: true, supplier: true, currentStockPacks: true, reorderLevelPacks: true, packPrice: true, unitsPerPack: true, colors: true, notes: true },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  })
}
async function getSuppliers() { return prisma.supplier.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }) }

export default async function MaterialsPage() {
  const [materials, suppliers] = await Promise.all([getMaterials(), getSuppliers()])
  const total = materials.length
  const inStock = materials.filter((m) => (m.currentStockPacks ?? 0) > 0).length
  const needsReorder = materials.filter((m) => m.reorderLevelPacks && (m.currentStockPacks ?? 0) <= m.reorderLevelPacks).length
  const invValue = materials.reduce((s, m) => s + (m.currentStockPacks ?? 0) * (m.packPrice ?? 0), 0)

  return (
    <div>
      <div className="fmd-screen-header">
        <div><h1>Materials</h1><div className="fmd-subtitle">Flowers, foliage & packaging · stock in packs</div></div>
        <AddMaterialDialog suppliers={suppliers} />
      </div>
      <div className="fmd-kpi-bar">
        <div className="fmd-kpi-cell"><div className="fmd-kpi-value" style={{ color: "#44403C" }}>{total}</div><div className="fmd-kpi-label">Total materials</div></div>
        <div className="fmd-kpi-cell"><div className="fmd-kpi-value" style={{ color: "#047857" }}>{inStock}</div><div className="fmd-kpi-label">In stock</div></div>
        <div className="fmd-kpi-cell"><div className="fmd-kpi-value" style={{ color: "#D97706" }}>{needsReorder}</div><div className="fmd-kpi-label">Needs reorder</div></div>
        <div className="fmd-kpi-cell"><div className="fmd-kpi-value" style={{ color: "#BE185D" }}>${invValue.toLocaleString("es-MX", { maximumFractionDigits: 0 })}</div><div className="fmd-kpi-label">Inventory value</div></div>
      </div>
      <div className="fmd-box">
        <div className="fmd-box-label">All Materials ({total})</div>
        <MaterialSearch materials={materials} />
      </div>
    </div>
  )
}
