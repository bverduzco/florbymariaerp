// src/app/demo-cloudinary/page.tsx
//
// Demo: how a Cloudinary image integrates with an ERP Product row.
//
// Product: PRD-PEACHY-S  (Peachy Bouquet, Small)
// Photo:   Matilde_Ramo_Mini.png in Cloudinary cloud 'mvtqdpen'
//
// v1.8.3 + Prisma update: now reads cloudinaryPublicId from the Product model
// (instead of the hardcoded PRODUCT_IMAGES lookup used in the spike).
//
// This page shows the integration in 3 forms:
//   1. Product card with photo (catalogue-style)
//   2. Product detail page (full info + hero photo)
//   3. Same image at multiple sizes (proving transformation URLs work)

export const dynamic = "force-dynamic"

import { AssetImage, buildAssetUrl } from "@/components/asset-image"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { db as prisma } from "@/lib/db"

// ────────────────────────────────────────────────────────────────────────────
// Server component — fetches products from Prisma.
// Each Product row now has a `cloudinaryPublicId` column (added v1.8.3).
// Null = no photo yet. Set = render via <AssetImage>.
// ────────────────────────────────────────────────────────────────────────────

async function getProducts() {
  const products = await prisma.product.findMany({
    orderBy: [{ sku: "asc" }],
    select: {
      sku: true,
      name: true,
      category: true,
      size: true,
      description: true,
      flowersCost: true,
      suggestedPriceWithIva: true,
      actualPriceWithIva: true,
      marginPct: true,
      cloudinaryPublicId: true,
    },
  })
  return products
}

type ProductForDisplay = Awaited<ReturnType<typeof getProducts>>[number]

export default async function DemoCloudinaryPage() {
  const products = await getProducts()
  // Find PRD-PEACHY-S for the hero section + multi-sizes demo
  const peachyS = products.find((p) => p.sku === "PRD-PEACHY-S")
  const publicId = peachyS?.cloudinaryPublicId

  return (
    <main className="min-h-screen bg-stone-50 px-6 py-10">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8">
          <div className="text-xs uppercase tracking-wider text-stone-500">
            Cloudinary Integration Demo · v1.8.3 + Prisma
          </div>
          <h1 className="mt-1 text-3xl font-bold text-stone-900">
            One product image, end-to-end
          </h1>
          <p className="mt-2 text-sm text-stone-600">
            Proof of concept: how a single Cloudinary photo wires into the ERP
            for <code className="rounded bg-stone-100 px-1.5 py-0.5 text-stone-900">PRD-PEACHY-S</code>.
            v1.8.3 added a <code className="rounded bg-stone-100 px-1.5 py-0.5 text-stone-900">cloudinaryPublicId</code> column
            to the Product Prisma model — this page reads it live from the database
            (no hardcoded lookup).
          </p>
        </header>

        {/* ───────── 1. CATALOGUE CARD ───────── */}
        <section className="mb-12">
          <h2 className="mb-3 text-lg font-semibold text-stone-800">
            1. Catalogue card
          </h2>
          <p className="mb-4 text-sm text-stone-600">
            All 4 products from the Prisma database. PRD-PEACHY-S has a
            cloudinaryPublicId set → renders a photo. The other 3 are blank
            in the DB → show placeholder cards.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {products.map((product) => {
              const hasPhoto = Boolean(product.cloudinaryPublicId)
              return (
                <Card
                  key={product.sku}
                  className={
                    hasPhoto
                      ? "overflow-hidden border-stone-200"
                      : "overflow-hidden border-dashed border-stone-200"
                  }
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
                      <div className="flex h-full items-center justify-center text-stone-400 text-xs p-4 text-center">
                        [{product.sku} photo TBD]
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
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {product.description && (
                      <p className="text-xs text-stone-600 line-clamp-2 mb-2">
                        {product.description}
                      </p>
                    )}
                    <div className="flex items-baseline justify-between">
                      <div>
                        <div className="text-lg font-semibold text-stone-900">
                          ${product.actualPriceWithIva.toLocaleString("es-MX", { maximumFractionDigits: 0 })} MXN
                        </div>
                        {product.suggestedPriceWithIva > 0 && (
                          <div className="text-[11px] text-stone-400 line-through">
                            ${product.suggestedPriceWithIva.toLocaleString("es-MX", { maximumFractionDigits: 0 })} MXN
                          </div>
                        )}
                      </div>
                      <div className="text-xs text-emerald-600 font-medium">
                        {Math.round(product.marginPct * 100)}% margin
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </section>

        {/* ───────── 2. PRODUCT DETAIL PAGE ───────── */}
        <section className="mb-12">
          <h2 className="mb-3 text-lg font-semibold text-stone-800">
            2. Product detail page (hero photo)
          </h2>
          <p className="mb-4 text-sm text-stone-600">
            Same Cloudinary asset, served larger. Note the URL — your browser
            fetched a different transformation than the catalogue card above,
            but it&apos;s the same source image. No variants to manage.
          </p>
          <Card className="overflow-hidden border-stone-200">
            <div className="grid grid-cols-1 md:grid-cols-2">
              <div className="bg-stone-100">
                {publicId ? (
                  <AssetImage
                    publicId={publicId}
                    alt={`${peachyS?.name ?? "Product"} — hero photo`}
                    variant="hero"
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-stone-400 text-sm p-8 text-center">
                    No cloudinaryPublicId set on PRD-PEACHY-S in the database.
                  </div>
                )}
              </div>
              <div className="p-6">
                <div className="flex items-center gap-2 mb-2">
                  {peachyS?.category && <Badge variant="outline">{peachyS.category}</Badge>}
                  {peachyS?.size && <Badge variant="outline">{peachyS.size}</Badge>}
                </div>
                <h3 className="text-2xl font-bold text-stone-900">{peachyS?.name ?? "(product not found)"}</h3>
                <div className="text-xs font-mono text-stone-500 mt-1">{peachyS?.sku}</div>
                {peachyS?.description && (
                  <p className="mt-4 text-sm text-stone-700 leading-relaxed">
                    {peachyS.description}
                  </p>
                )}
                <div className="mt-6 pt-6 border-t border-stone-200 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-stone-500 text-xs">Price (with IVA)</div>
                    <div className="text-xl font-bold text-stone-900">
                      ${peachyS?.actualPriceWithIva.toLocaleString("es-MX", { maximumFractionDigits: 0 }) ?? "—"} MXN
                    </div>
                  </div>
                  <div>
                    <div className="text-stone-500 text-xs">Flower cost</div>
                    <div className="text-xl font-semibold text-stone-700">
                      ${peachyS?.flowersCost.toLocaleString("es-MX", { maximumFractionDigits: 2 }) ?? "—"} MXN
                    </div>
                  </div>
                </div>
                {publicId && (
                  <div className="mt-6 text-xs text-stone-400 font-mono break-all">
                    URL: {buildAssetUrl(publicId, "hero")}
                  </div>
                )}
              </div>
            </div>
          </Card>
        </section>

        {/* ───────── 3. MULTIPLE SIZES ───────── */}
        <section className="mb-12">
          <h2 className="mb-3 text-lg font-semibold text-stone-800">
            3. Same image, multiple sizes
          </h2>
          <p className="mb-4 text-sm text-stone-600">
            Each thumbnail below is a different Cloudinary URL. The same source
            asset becomes: a 200×200 catalogue thumb, a 60×60 cart icon, a
            600×600 detail shot. One upload, infinite variants.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {publicId ? (
              <>
                <Card className="p-3 border-stone-200">
                  <div className="w-full aspect-square bg-stone-100 mb-2">
                    <AssetImage publicId={publicId} alt="thumb" variant="thumb" className="h-full w-full" />
                  </div>
                  <div className="text-[11px] text-stone-500 font-mono">thumb · 200×200</div>
                </Card>
                <Card className="p-3 border-stone-200">
                  <div className="w-full aspect-square bg-stone-100 mb-2">
                    <AssetImage publicId={publicId} alt="square" variant="square" className="h-full w-full" />
                  </div>
                  <div className="text-[11px] text-stone-500 font-mono">square · 600×600</div>
                </Card>
                <Card className="p-3 border-stone-200">
                  <div className="w-full aspect-[4/3] bg-stone-100 mb-2">
                    <AssetImage publicId={publicId} alt="card" variant="card" className="h-full w-full" />
                  </div>
                  <div className="text-[11px] text-stone-500 font-mono">card · 400×300</div>
                </Card>
                <Card className="p-3 border-stone-200">
                  <div className="w-full aspect-[4/3] bg-stone-100 mb-2">
                    <AssetImage publicId={publicId} alt="hero" variant="hero" className="h-full w-full object-contain" />
                  </div>
                  <div className="text-[11px] text-stone-500 font-mono">hero · 800×600 (fit)</div>
                </Card>
              </>
            ) : (
              <div className="col-span-full text-sm text-stone-500 p-4 text-center">
                No photo to display — cloudinaryPublicId not set.
              </div>
            )}
          </div>
        </section>

        {/* ───────── 4. HOW IT WORKS ───────── */}
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold text-stone-800">
            4. How it works
          </h2>
          <Card className="border-stone-200 bg-stone-50/50">
            <CardContent className="pt-6 space-y-3 text-sm text-stone-700">
              <div>
                <strong>1. Photo already in Cloudinary.</strong> You uploaded
                it via the Cloudinary dashboard or API. It has a{" "}
                <code className="rounded bg-white px-1.5 py-0.5 border border-stone-200 text-stone-900">public_id</code> like{" "}
                <code className="rounded bg-white px-1.5 py-0.5 border border-stone-200 text-stone-900">Matilde_Ramo_Mini.png</code>.
              </div>
              <div>
                <strong>2. ERP knows the public_id.</strong> Stored on the Product row in the <code className="rounded bg-white px-1.5 py-0.5 border border-stone-200 text-stone-900">cloudinaryPublicId</code> column (added v1.8.3 to both the Excel Products sheet col X and the Prisma <code className="rounded bg-white px-1.5 py-0.5 border border-stone-200 text-stone-900">Product</code> model). This page reads it live via <code className="rounded bg-white px-1.5 py-0.5 border border-stone-200 text-stone-900">prisma.product.findMany()</code>.
              </div>
              <div>
                <strong>3. <code className="rounded bg-white px-1.5 py-0.5 border border-stone-200 text-stone-900">&lt;AssetImage&gt;</code> builds the URL.</strong>{" "}
                The component takes the public_id + a size variant (thumb /
                card / hero) and emits a URL like{" "}
                <code className="block mt-1 rounded bg-white px-2 py-1 border border-stone-200 text-stone-900 text-[11px] break-all">
                  https://res.cloudinary.com/mvtqdpen/image/upload/c_fill,w_400,h_300,q_auto,f_auto/Matilde_Ramo_Mini.png
                </code>
              </div>
              <div>
                <strong>4. Browser loads the image from Cloudinary&apos;s CDN.</strong>{" "}
                No ERP server round-trip. Cloudinary does the resize / format
                conversion on-the-fly. WebP / AVIF served automatically where
                the browser supports them.
              </div>
              <div className="pt-3 border-t border-stone-200">
                <strong>Done ✅</strong>
                <ul className="list-disc list-inside ml-4 mt-2 space-y-1 text-xs text-stone-600">
                  <li><code className="rounded bg-white px-1.5 py-0.5 border border-stone-200">NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME</code> env var set to <code>mvtqdpen</code> in <code>.env</code>.</li>
                  <li><code className="rounded bg-white px-1.5 py-0.5 border border-stone-200">cloudinaryPublicId</code> column added to the <code>Product</code> Prisma model (v1.8.3).</li>
                  <li>PRD-PEACHY-S row updated in the local SQLite database with <code>Matilde_Ramo_Mini.png</code>.</li>
                  <li>This page reads from Prisma — no more hardcoded lookup.</li>
                </ul>
                <strong className="block mt-3">Still TODO</strong>
                <ul className="list-disc list-inside ml-4 mt-2 space-y-1 text-xs text-stone-600">
                  <li>Wire <code className="rounded bg-white px-1.5 py-0.5 border border-stone-200">&lt;AssetImage&gt;</code> into the actual catalogue-grid component on the Products tab (currently this is just a demo page).</li>
                  <li>When Turso databases are provisioned (demo + prod), re-run <code className="rounded bg-white px-1.5 py-0.5 border border-stone-200">prisma db push</code> against each to apply the new column.</li>
                  <li>Add an &quot;Edit photo&quot; UI for Maria to set <code className="rounded bg-white px-1.5 py-0.5 border border-stone-200">cloudinaryPublicId</code> per product from the ERP (deferred — Excel-first for now, per project convention).</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  )
}
