// src/app/catalogue/page.tsx
//
// Customer-facing price list. Mirrors Products but only shows the info a customer
// would see: name, description, price. No costs, no margins, no internal notes.

import { db as prisma } from "@/lib/db"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AssetImage } from "@/components/asset-image"

async function getCatalogue() {
  return prisma.product.findMany({
    where: { actualPriceBeforeIva: { gt: 0 } },
    orderBy: [{ category: "asc" }, { actualPriceBeforeIva: "asc" }],
  })
}

export default async function CataloguePage() {
  const products = await getCatalogue()

  // Group by category for the menu
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

  return (
    <main className="min-h-screen bg-gradient-to-b from-rose-50 to-stone-50 px-6 py-10">
      <div className="mx-auto max-w-5xl">
        {/* ─── Florist header (customer-facing) ─── */}
        <header className="text-center mb-10">
          <div className="text-5xl mb-2">✿</div>
          <h1 className="text-4xl font-bold text-stone-900" style={{ fontFamily: "Georgia, serif" }}>
            Flor by Maria
          </h1>
          <p className="mt-2 text-sm text-stone-600 italic">
            Bouquets, arrangements &amp; event flowers · Monterrey, NL
          </p>
        </header>

        {/* ─── Intro blurb ─── */}
        <Card className="mb-8 border-rose-200 bg-white/70">
          <CardContent className="pt-6 text-center text-sm text-stone-700 italic">
            &ldquo;Cada flor, cada arreglo, cada detalle — hecho con cariño para tus momentos especiales.&rdquo;
            <br />
            <span className="text-xs text-stone-500 mt-2 inline-block">
              Prices in MXN. IVA included. Delivery is extra (case by case). WhatsApp us to order: 81 1234 5678
            </span>
          </CardContent>
        </Card>

        {/* ─── Menu sections by category ─── */}
        {Object.entries(byCategory).map(([category, items]) => (
          <section key={category} className="mb-10">
            <h2 className="text-2xl font-bold text-stone-900 mb-4 flex items-center gap-2" style={{ fontFamily: "Georgia, serif" }}>
              <span className="text-3xl">{categoryEmojis[category] ?? "🌸"}</span>
              {category}s
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {items.map((product) => {
                const hasPhoto = Boolean(product.cloudinaryPublicId)
                return (
                  <Card
                    key={product.id}
                    className="overflow-hidden border-rose-100 bg-white hover:shadow-md transition"
                  >
                    <div className="grid grid-cols-3 gap-0">
                      {/* Photo or placeholder (1/3 width on desktop) */}
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
                              <div className="text-[10px]">Photo soon</div>
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
                        {product.description && (
                          <p className="text-xs text-stone-600 line-clamp-3 mb-3 italic">
                            {product.description}
                          </p>
                        )}
                        <div className="flex items-baseline justify-between mt-2 pt-2 border-t border-stone-100">
                          <div>
                            <div className="text-xs text-stone-500">Price (IVA included)</div>
                            <div className="text-lg font-bold text-rose-700">
                              ${product.actualPriceWithIva.toLocaleString("es-MX", { maximumFractionDigits: 0 })} MXN
                            </div>
                          </div>
                          <a
                            href={`https://wa.me/528112345678?text=${encodeURIComponent(
                              `Hola! Me gustaría ordenar: ${product.name}${product.size ? ` (${product.size})` : ""} — $${product.actualPriceWithIva.toLocaleString("es-MX", { maximumFractionDigits: 0 })} MXN`
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 text-xs font-medium bg-rose-600 text-white rounded-md hover:bg-rose-700 transition inline-block"
                          >
                            Order
                          </a>
                        </div>
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          </section>
        ))}

        {/* ─── Footer / contact ─── */}
        <Card className="mt-12 border-rose-200 bg-white/70">
          <CardContent className="pt-6 text-center text-sm text-stone-700 space-y-2">
            <div className="font-bold text-stone-900 text-lg" style={{ fontFamily: "Georgia, serif" }}>
              ✿ Flor by Maria
            </div>
            <div>Monterrey, Nuevo León, México</div>
            <div className="text-xs text-stone-500">
              📱 WhatsApp: 81 1234 5678 · ✉️ hola@florbymaria.com
            </div>
            <div className="text-xs text-stone-400 mt-4">
              Prices valid for 15 days. Flowers may vary by season — we&apos;ll substitute with equal or greater value, respecting your color palette.
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
