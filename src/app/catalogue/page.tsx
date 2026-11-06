// src/app/catalogue/page.tsx
//
// Internal product catalogue — reference view for Maria.
// Shows products with prices, margins, and Cloudinary photos.
// "Add to Quote" button adds the product as a Quote Line to an existing or new quote.

import { db as prisma } from "@/lib/db"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AssetImage } from "@/components/asset-image"
import { AddToQuoteDialog } from "./add-to-quote-dialog"

async function getProducts() {
  return prisma.product.findMany({
    where: { actualPriceBeforeIva: { gt: 0 } },
    orderBy: [{ category: "asc" }, { actualPriceBeforeIva: "asc" }],
  })
}

async function getActiveQuotes() {
  return prisma.quote.findMany({
    where: { status: { in: ["draft", "sent", "viewed", "negotiating"] } },
    orderBy: { quoteDate: "desc" },
    select: { id: true, quoteNumber: true, customerName: true, status: true },
  })
}

export default async function CataloguePage() {
  const [products, activeQuotes] = await Promise.all([getProducts(), getActiveQuotes()])

  // Group by category
  const byCategory = products.reduce((acc, p) => {
    if (!acc[p.category]) acc[p.category] = []
    acc[p.category].push(p)
    return acc
  }, {} as Record<string, typeof products>)

  const categoryEmojis: Record<string, string> = {
    Bouquet: "💐",
    Arrangement: "🌸",
    Centerpiece: "🏺",
  }

  // KPIs
  const total = products.length
  const withPhoto = products.filter((p) => p.cloudinaryPublicId).length
  const avgPrice = total > 0
    ? products.reduce((s, p) => s + p.actualPriceWithIva, 0) / total
    : 0

  return (
    <main className="min-h-screen bg-stone-50 px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6">
          <div className="text-xs uppercase tracking-wider text-stone-500">
            Internal product catalogue · v1.9
          </div>
          <h1 className="mt-1 text-3xl font-bold text-stone-900">Catalogue</h1>
          <p className="mt-1 text-sm text-stone-600">
            Reference view for building quotes. Click &quot;Add to Quote&quot; on any product to add it to an existing quote or create a new one.
          </p>
        </header>

        {/* KPI bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 mb-6 border border-stone-200 rounded-lg overflow-hidden bg-white">
          <KpiCell value={`${total}`} label="Total products" />
          <KpiCell value={`${withPhoto}`} label="With photo" color="green" />
          <KpiCell value={`${activeQuotes.length}`} label="Active quotes" color="amber" />
          <KpiCell
            value={`$${avgPrice.toLocaleString("es-MX", { maximumFractionDigits: 0 })}`}
            label="Avg price (w/ IVA)"
            color="purple"
          />
        </div>

        {/* Menu sections by category */}
        {Object.entries(byCategory).map(([category, items]) => (
          <section key={category} className="mb-10">
            <h2 className="text-xl font-bold text-stone-900 mb-4 flex items-center gap-2">
              <span className="text-2xl">{categoryEmojis[category] ?? "🌸"}</span>
              {category}s
              <Badge variant="outline" className="text-xs bg-stone-100 text-stone-600 border-stone-300">
                {items.length}
              </Badge>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map((product) => {
                const hasPhoto = Boolean(product.cloudinaryPublicId)
                return (
                  <Card key={product.id} className="overflow-hidden border-stone-200 hover:shadow-sm transition">
                    <div className="grid grid-cols-3 gap-0">
                      {/* Photo or placeholder (1/3 width) */}
                      <div className="aspect-square bg-stone-100">
                        {hasPhoto ? (
                          <AssetImage
                            publicId={product.cloudinaryPublicId!}
                            alt={`${product.name} (${product.size ?? ""})`.trim()}
                            variant="square"
                            className="h-full w-full"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-stone-300 text-xs p-2 text-center">
                            <div>
                              <div className="text-3xl mb-1">💐</div>
                              <div className="text-[10px]">No photo</div>
                            </div>
                          </div>
                        )}
                      </div>
                      {/* Details (2/3 width) */}
                      <div className="col-span-2 p-4">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h3 className="font-bold text-stone-900">{product.name}</h3>
                          {product.size && <Badge variant="outline" className="text-xs">{product.size}</Badge>}
                        </div>
                        <div className="text-xs text-stone-500 font-mono mb-2">{product.sku}</div>
                        {product.description && (
                          <p className="text-xs text-stone-600 line-clamp-2 mb-3">
                            {product.description}
                          </p>
                        )}
                        <div className="flex items-baseline justify-between mt-2 pt-2 border-t border-stone-100">
                          <div>
                            <div className="text-xs text-stone-500">Price (w/ IVA)</div>
                            <div className="text-lg font-bold text-stone-900">
                              ${product.actualPriceWithIva.toLocaleString("es-MX", { maximumFractionDigits: 0 })} MXN
                            </div>
                          </div>
                          <AddToQuoteDialog product={product} existingQuotes={activeQuotes} />
                        </div>
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </main>
  )
}

function KpiCell({
  value,
  label,
  color = "default",
}: {
  value: string
  label: string
  color?: "default" | "green" | "amber" | "purple"
}) {
  const colorMap = {
    default: "text-stone-900",
    green: "text-emerald-700",
    amber: "text-amber-700",
    purple: "text-violet-700",
  }
  return (
    <div className="p-3 border-r border-stone-200 last:border-r-0 min-w-[120px]">
      <div className={`text-xl font-bold ${colorMap[color]}`}>{value}</div>
      <div className="text-xs text-stone-500 mt-0.5">{label}</div>
    </div>
  )
}
