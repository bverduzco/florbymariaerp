export const dynamic = "force-dynamic"

import { db as prisma } from "@/lib/db"
import { AddToQuoteDialog } from "./add-to-quote-dialog"
import { AssetImage } from "@/components/asset-image"

async function getProducts() { return prisma.product.findMany({ where: { actualPriceBeforeIva: { gt: 0 } }, orderBy: [{ category: "asc" }, { actualPriceBeforeIva: "asc" }] }) }
async function getActiveQuotes() { return prisma.quote.findMany({ where: { status: { in: ["draft", "sent", "viewed", "negotiating"] } }, orderBy: { quoteDate: "desc" }, select: { id: true, quoteNumber: true, customerName: true, status: true } }) }

export default async function CataloguePage() {
  // Fetch products, active quotes, all products (for line items dropdown), customers + events (for new-quote mode)
  const [products, activeQuotes, allProducts, customers, events] = await Promise.all([
    getProducts(),
    getActiveQuotes(),
    prisma.product.findMany({
      orderBy: [{ name: "asc" }],
      select: { id: true, sku: true, name: true, size: true, actualPriceBeforeIva: true },
    }),
    prisma.customer.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.event.findMany({
      orderBy: { eventDate: "asc" },
      select: { id: true, eventNumber: true, name: true, eventDate: true },
    }),
  ])
  const byCategory = products.reduce((acc, p) => { if (!acc[p.category]) acc[p.category] = []; acc[p.category].push(p); return acc }, {} as Record<string, typeof products>)
  const catEmoji: Record<string, string> = { Bouquet: "💐", Arrangement: "🌸", Centerpiece: "🏺" }
  const withPhoto = products.filter((p) => p.cloudinaryPublicId).length

  return (
    <div>
      <div className="fmd-screen-header hidden lg:flex"><div><h1>Catalogue</h1><div className="fmd-subtitle">Internal product reference · click "Add to Quote" to build quotes</div></div></div>
      <div className="fmd-kpi-bar hidden lg:flex">
        <div className="fmd-kpi-cell"><div className="fmd-kpi-value" style={{ color: "#44403C" }}>{products.length}</div><div className="fmd-kpi-label">Products</div></div>
        <div className="fmd-kpi-cell"><div className="fmd-kpi-value" style={{ color: "#047857" }}>{withPhoto}</div><div className="fmd-kpi-label">With photo</div></div>
        <div className="fmd-kpi-cell"><div className="fmd-kpi-value" style={{ color: "#D97706" }}>{activeQuotes.length}</div><div className="fmd-kpi-label">Active quotes</div></div>
      </div>
      {products.length === 0 ? (
        <div className="fmd-box" style={{ textAlign: "center", padding: "32px" }}>
          <div style={{ fontSize: "13px", color: "#78716C" }}>No products in catalogue yet. Add products from the Products tab.</div>
        </div>
      ) : (
        Object.entries(byCategory).map(([category, items]) => (
        <div key={category} className="fmd-box">
          <div className="fmd-box-label">{catEmoji[category] ?? "🌸"} {category}s ({items.length})</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "8px" }}>
            {items.map((product) => {
              const hasPhoto = Boolean(product.cloudinaryPublicId)
              return (
                <div key={product.id} style={{ display: "flex", gap: "10px", padding: "10px", border: "1px solid #D6D3D1", borderRadius: "8px", background: "#ffffff" }}>
                  <div style={{ width: "60px", height: "60px", borderRadius: "6px", overflow: "hidden", background: "#F3F4F6", flexShrink: 0 }}>
                    {hasPhoto ? <AssetImage publicId={product.cloudinaryPublicId!} alt={product.name} variant="square" className="h-full w-full" /> : <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center", fontSize: "20px", color: "#D6D3D1" }}>💐</div>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "13px", fontWeight: 600, color: "#44403C" }}>{product.name}{product.size && <span style={{ fontSize: "10px", color: "#78716C", marginLeft: "4px" }}>({product.size})</span>}</div>
                    <div style={{ fontSize: "10px", color: "#78716C", fontFamily: "monospace" }}>{product.sku}</div>
                    <div style={{ fontSize: "16px", fontWeight: 700, color: "#BE185D", marginTop: "2px" }}>${product.actualPriceWithIva.toLocaleString("es-MX", { maximumFractionDigits: 0 })} MXN</div>
                    <div style={{ marginTop: "6px" }}>
                      <AddToQuoteDialog
                        product={product}
                        existingQuotes={activeQuotes}
                        products={allProducts}
                        customers={customers}
                        events={events}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))
      )}
    </div>
  )
}
