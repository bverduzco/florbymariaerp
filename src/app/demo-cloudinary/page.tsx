// src/app/demo-cloudinary/page.tsx
//
// Demo: how a Cloudinary image integrates with an ERP Product row.
//
// Product: PRD-PEACHY-S  (Peachy Bouquet, Small)
// Photo:   Matilde_Ramo_Mini.png in Cloudinary cloud 'mvtqdpen'
//
// This page shows the integration in 3 forms:
//   1. Product card with photo (catalogue-style)
//   2. Product detail page (full info + hero photo)
//   3. Same image at multiple sizes (proving transformation URLs work)
//
// No Prisma changes, no Excel changes — just an AssetImage component
// + a product lookup. This is the MVP path: Cloudinary → URL → ERP screen.

import { AssetImage, buildAssetUrl } from "@/components/asset-image"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

// ────────────────────────────────────────────────────────────────────────────
// Mock "database" of products → Cloudinary public_ids.
// In production this would come from a `cloudinary_public_id` column on the
// Products table, or from a separate MaterialImageMap table.
// ────────────────────────────────────────────────────────────────────────────

const PRODUCT_IMAGES: Record<string, string> = {
  "PRD-PEACHY-S": "Matilde_Ramo_Mini.png",
  // Add more as you wire them up:
  // "PRD-PEACHY-M": "Matilde_Ramo_Midi.png",
  // "PRD-PEACHY-L": "Matilde_Ramo_Maxi.png",
}

// Same product data as in seed.json — kept here for the demo only.
// In production this would be fetched from /api/products or Prisma directly.
const PEACHY_S = {
  sku: "PRD-PEACHY-S",
  name: "Peachy Bouquet",
  category: "Bouquet",
  size: "Small",
  description:
    "Peach and blush bouquet of roses, garden rose, lisianthus, peony and hydrangea, wrapped in blush paper.",
  flowersCost: 170.1,
  suggestedPriceWithIva: 690.61,
  actualPriceWithIva: 1073.0,
  marginPct: 0.816,
}

export default function DemoCloudinaryPage() {
  const publicId = PRODUCT_IMAGES[PEACHY_S.sku]!

  return (
    <main className="min-h-screen bg-stone-50 px-6 py-10">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8">
          <div className="text-xs uppercase tracking-wider text-stone-500">
            Cloudinary Integration Demo · v1.9 spike
          </div>
          <h1 className="mt-1 text-3xl font-bold text-stone-900">
            One product image, end-to-end
          </h1>
          <p className="mt-2 text-sm text-stone-600">
            Proof of concept: how a single Cloudinary photo wires into the ERP
            for <code className="rounded bg-stone-100 px-1.5 py-0.5 text-stone-900">PRD-PEACHY-S</code>.
            No Prisma changes, no Excel changes — just one React component
            (<code className="rounded bg-stone-100 px-1.5 py-0.5 text-stone-900">&lt;AssetImage&gt;</code>)
            + one env var.
          </p>
        </header>

        {/* ───────── 1. CATALOGUE CARD ───────── */}
        <section className="mb-12">
          <h2 className="mb-3 text-lg font-semibold text-stone-800">
            1. Catalogue card
          </h2>
          <p className="mb-4 text-sm text-stone-600">
            The product photo lives in Cloudinary; the rest of the card renders
            from Product data. Click any other Cloudinary-backed product to
            swap the photo without server changes.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card className="overflow-hidden border-stone-200">
              <div className="aspect-[4/3] bg-stone-100">
                <AssetImage
                  publicId={publicId}
                  alt={`${PEACHY_S.name} (${PEACHY_S.size})`}
                  variant="card"
                  className="h-full w-full"
                />
              </div>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{PEACHY_S.name}</CardTitle>
                  <Badge variant="outline">{PEACHY_S.size}</Badge>
                </div>
                <div className="text-xs text-stone-500 font-mono">
                  {PEACHY_S.sku}
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-xs text-stone-600 line-clamp-2 mb-2">
                  {PEACHY_S.description}
                </p>
                <div className="flex items-baseline justify-between">
                  <div>
                    <div className="text-lg font-semibold text-stone-900">
                      ${PEACHY_S.actualPriceWithIva.toLocaleString("es-MX", { maximumFractionDigits: 0 })} MXN
                    </div>
                    <div className="text-[11px] text-stone-400 line-through">
                      ${PEACHY_S.suggestedPriceWithIva.toLocaleString("es-MX", { maximumFractionDigits: 0 })} MXN
                    </div>
                  </div>
                  <div className="text-xs text-emerald-600 font-medium">
                    {Math.round(PEACHY_S.marginPct * 100)}% margin
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="overflow-hidden border-dashed border-stone-200">
              <div className="aspect-[4/3] bg-stone-50 flex items-center justify-center text-stone-400 text-xs">
                [PRD-PEACHY-M photo TBD]
              </div>
              <CardHeader className="pb-2">
                <div className="text-base font-medium text-stone-400">Peachy Bouquet (Medium)</div>
              </CardHeader>
              <CardContent>
                <div className="text-xs text-stone-400">Waiting on Cloudinary upload</div>
              </CardContent>
            </Card>

            <Card className="overflow-hidden border-dashed border-stone-200">
              <div className="aspect-[4/3] bg-stone-50 flex items-center justify-center text-stone-400 text-xs">
                [PRD-PEACHY-L photo TBD]
              </div>
              <CardHeader className="pb-2">
                <div className="text-base font-medium text-stone-400">Peachy Bouquet (Large)</div>
              </CardHeader>
              <CardContent>
                <div className="text-xs text-stone-400">Waiting on Cloudinary upload</div>
              </CardContent>
            </Card>
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
                <AssetImage
                  publicId={publicId}
                  alt={`${PEACHY_S.name} — hero photo`}
                  variant="hero"
                  className="h-full w-full object-contain"
                />
              </div>
              <div className="p-6">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline">{PEACHY_S.category}</Badge>
                  <Badge variant="outline">{PEACHY_S.size}</Badge>
                </div>
                <h3 className="text-2xl font-bold text-stone-900">{PEACHY_S.name}</h3>
                <div className="text-xs font-mono text-stone-500 mt-1">{PEACHY_S.sku}</div>
                <p className="mt-4 text-sm text-stone-700 leading-relaxed">
                  {PEACHY_S.description}
                </p>
                <div className="mt-6 pt-6 border-t border-stone-200 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-stone-500 text-xs">Price (with IVA)</div>
                    <div className="text-xl font-bold text-stone-900">
                      ${PEACHY_S.actualPriceWithIva.toLocaleString("es-MX", { maximumFractionDigits: 0 })} MXN
                    </div>
                  </div>
                  <div>
                    <div className="text-stone-500 text-xs">Flower cost</div>
                    <div className="text-xl font-semibold text-stone-700">
                      ${PEACHY_S.flowersCost.toLocaleString("es-MX", { maximumFractionDigits: 2 })} MXN
                    </div>
                  </div>
                </div>
                <div className="mt-6 text-xs text-stone-400 font-mono break-all">
                  URL: {buildAssetUrl(publicId, "hero")}
                </div>
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
                <strong>2. ERP knows the public_id.</strong> For this demo,
                it&apos;s a hard-coded lookup in{" "}
                <code className="rounded bg-white px-1.5 py-0.5 border border-stone-200 text-stone-900">PRODUCT_IMAGES</code>.
                In production you&apos;d add a{" "}
                <code className="rounded bg-white px-1.5 py-0.5 border border-stone-200 text-stone-900">cloudinary_public_id</code>{" "}
                column on the Products table (one migration, one column).
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
                <strong>What&apos;s missing for production:</strong>
                <ul className="list-disc list-inside ml-4 mt-2 space-y-1 text-xs text-stone-600">
                  <li>Set <code className="rounded bg-white px-1.5 py-0.5 border border-stone-200">NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME</code> env var (= <code>mvtqdpen</code>) so the hardcoded fallback goes away.</li>
                  <li>Add <code className="rounded bg-white px-1.5 py-0.5 border border-stone-200">cloudinary_public_id</code> column to the Products Prisma model.</li>
                  <li>Replace the <code className="rounded bg-white px-1.5 py-0.5 border border-stone-200">PRODUCT_IMAGES</code> lookup with a real Prisma fetch.</li>
                  <li>Wire <code className="rounded bg-white px-1.5 py-0.5 border border-stone-200">&lt;AssetImage&gt;</code> into the actual catalogue-grid component on the Products tab.</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  )
}
