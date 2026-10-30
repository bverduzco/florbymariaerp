// src/app/products/page.tsx
//
// Products catalogue screen — uses <AssetImage> for products with cloudinaryPublicId.
// Pulls live data from Prisma (Product + RecipeLine count).

import { db as prisma } from "@/lib/db"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AssetImage } from "@/components/asset-image"
import { AddProductDialog } from "./add-product-dialog"

async function getProducts() {
  return prisma.product.findMany({
    include: {
      _count: { select: { recipeLines: true } },
    },
    orderBy: [{ sku: "asc" }],
  })
}

export default async function ProductsPage() {
  const products = await getProducts()

  const total = products.length
  const withPhoto = products.filter((p) => p.cloudinaryPublicId).length
  const withoutPhoto = total - withPhoto
  const avgMargin = total > 0
    ? Math.round((products.reduce((s, p) => s + p.marginPct, 0) / total) * 100)
    : 0
  const totalCatalogueValue = products.reduce((s, p) => s + p.actualPriceWithIva, 0)

  return (
    <main className="min-h-screen bg-stone-50 px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-wrap justify-between items-start gap-4">
          <div>
            <div className="text-xs uppercase tracking-wider text-stone-500">
              Product catalogue · v1.8.3 + v1.9
            </div>
            <h1 className="mt-1 text-3xl font-bold text-stone-900">Products</h1>
            <p className="mt-1 text-sm text-stone-600">
              Each row in the catalogue. Products with a Cloudinary public_id render a photo automatically — others show a placeholder.
            </p>
          </div>
          <AddProductDialog />
        </header>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-0 mb-6 border border-stone-200 rounded-lg overflow-hidden bg-white">
          <KpiCell value={`${total}`} label="Total products" />
          <KpiCell value={`${withPhoto}`} label="With photo" color="green" />
          <KpiCell value={`${withoutPhoto}`} label="Missing photo" color="amber" />
          <KpiCell value={`${avgMargin}%`} label="Avg margin" color="purple" />
          <KpiCell
            value={`$${totalCatalogueValue.toLocaleString("es-MX", { maximumFractionDigits: 0 })}`}
            label="Catalogue value"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((product) => {
            const hasPhoto = Boolean(product.cloudinaryPublicId)
            return (
              <Card
                key={product.id}
                className={`overflow-hidden ${
                  hasPhoto ? "border-stone-200" : "border-dashed border-stone-200"
                }`}
              >
                <div className="aspect-[4/3] bg-stone-100">
                  {hasPhoto ? (
                    <AssetImage
                      publicId={product.cloudinaryPublicId!}
                      alt={`${product.name} (${product.size ?? ""})`.trim()}
                      variant="card"
                      className="h-full w-full"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-stone-400 text-xs p-6 text-center">
                      <div>
                        <div className="text-3xl mb-2">📸</div>
                        <div>No photo yet</div>
                        <div className="text-[10px] mt-1 font-mono text-stone-500">{product.sku}</div>
                      </div>
                    </div>
                  )}
                </div>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{product.name}</CardTitle>
                    {product.size && <Badge variant="outline">{product.size}</Badge>}
                  </div>
                  <div className="text-xs text-stone-500 font-mono">
                    {product.sku}
                    {hasPhoto && (
                      <span className="ml-2 text-violet-600">· has photo</span>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  {product.description && (
                    <p className="text-xs text-stone-600 line-clamp-2 mb-3">
                      {product.description}
                    </p>
                  )}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex flex-col">
                      <span className="text-stone-500">Price (with IVA)</span>
                      <span className="text-base font-bold text-stone-900">
                        ${product.actualPriceWithIva.toLocaleString("es-MX", { maximumFractionDigits: 0 })} MXN
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-stone-500">Margin</span>
                      <span className="text-base font-semibold text-emerald-700">
                        {Math.round(product.marginPct * 100)}%
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-stone-500">Flower cost</span>
                      <span className="text-sm font-medium text-stone-700">
                        ${product.flowersCost.toLocaleString("es-MX", { maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-stone-500">Recipe items</span>
                      <span className="text-sm font-medium text-stone-700">
                        {product._count.recipeLines}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-stone-100 flex justify-between items-center">
                    {hasPhoto ? (
                      <span className="text-xs text-violet-700 font-mono truncate">
                        📷 {product.cloudinaryPublicId}
                      </span>
                    ) : (
                      <span className="text-xs text-stone-400">No Cloudinary public_id set</span>
                    )}
                    <button className="text-xs text-stone-500 hover:text-stone-900 underline">
                      Edit
                    </button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        <Card className="mt-8 border-stone-200 bg-stone-50/50">
          <CardContent className="pt-6 text-sm text-stone-700 space-y-2">
            <div className="font-semibold text-stone-900">How photos work</div>
            <div>
              1. <strong>Photo already in Cloudinary.</strong> It has a <code className="rounded bg-white px-1.5 py-0.5 border border-stone-200 text-stone-900">public_id</code> like{" "}
              <code className="rounded bg-white px-1.5 py-0.5 border border-stone-200 text-stone-900">Matilde_Ramo_Mini.png</code>.
            </div>
            <div>
              2. <strong>ERP knows the public_id.</strong> Stored on the Product row in the{" "}
              <code className="rounded bg-white px-1.5 py-0.5 border border-stone-200 text-stone-900">cloudinaryPublicId</code> column (added v1.8.3). Mirrored in the Excel Products sheet column X.
            </div>
            <div>
              3. <strong><code>&lt;AssetImage&gt;</code> builds the URL.</strong> The component takes the public_id + a size variant (thumb / card / hero) and emits a URL like{" "}
              <code className="block mt-1 rounded bg-white px-2 py-1 border border-stone-200 text-stone-900 text-[11px] break-all">
                https://res.cloudinary.com/mvtqdpen/image/upload/c_fill,w_400,h_300,q_auto,f_auto/Matilde_Ramo_Mini.png
              </code>
            </div>
            <div>
              4. <strong>Browser loads the image from Cloudinary&apos;s CDN.</strong> No ERP server round-trip. Cloudinary does the resize / format conversion on-the-fly. WebP / AVIF served automatically where the browser supports them.
            </div>
          </CardContent>
        </Card>
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
