"use client"

import { useMemo, useState } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Plus, Sparkles, ShoppingBag } from "lucide-react"
import { useCatalogue, type CatalogueProduct } from "@/lib/catalogue-store"
import { usePlanStore } from "@/lib/plan-store"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"

function ProductCard({ product }: { product: CatalogueProduct }) {
  const addItem = usePlanStore((s) => s.addItem)
  const items = usePlanStore((s) => s.items)
  const inCart = items.find((i) => i.productSku === product.sku)

  // Pick a soft gradient based on category for visual variety
  const gradient =
    product.category === "Arrangement"
      ? "from-amber-50 via-orange-50 to-rose-50"
      : product.size === "Large"
        ? "from-rose-50 via-pink-50 to-fuchsia-50"
        : product.size === "Medium"
          ? "from-pink-50 via-rose-50 to-orange-50"
          : "from-orange-50 via-amber-50 to-yellow-50"

  return (
    <Card
      className={`relative flex flex-col gap-3 p-4 bg-gradient-to-br ${gradient} border-rose-100 hover:border-rose-300 hover:shadow-md transition-all`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-stone-800 leading-tight">{product.name}</h3>
          <div className="mt-1 flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="text-xs">
              {product.category}
            </Badge>
            {product.size && (
              <Badge variant="outline" className="text-xs">
                {product.size}
              </Badge>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold text-stone-900">
            ${product.actualPriceBeforeIva.toLocaleString("es-MX")}
          </div>
          <div className="text-[10px] text-stone-500">MXN · before IVA</div>
        </div>
      </div>

      {product.description && (
        <p className="text-xs text-stone-600 line-clamp-3 leading-relaxed">{product.description}</p>
      )}

      <div className="mt-1 grid grid-cols-3 gap-2 text-xs">
        <div className="rounded-md bg-white/70 px-2 py-1.5">
          <div className="text-stone-500">Cost</div>
          <div className="font-semibold text-stone-700">
            ${Math.round(product.totalCost).toLocaleString("es-MX")}
          </div>
        </div>
        <div className="rounded-md bg-white/70 px-2 py-1.5">
          <div className="text-stone-500">Margin</div>
          <div className="font-semibold text-emerald-700">{(product.marginPct * 100).toFixed(0)}%</div>
        </div>
        <div className="rounded-md bg-white/70 px-2 py-1.5">
          <div className="text-stone-500">Recipe</div>
          <div className="font-semibold text-stone-700">{product.recipeLines.length} items</div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={() => addItem(product.sku, 1)}
          className="flex-1 bg-rose-600 hover:bg-rose-700 text-white gap-1"
        >
          <Plus className="h-4 w-4" />
          Add to weekly plan
        </Button>
        {inCart && (
          <Badge className="bg-rose-100 text-rose-700 border border-rose-200 px-2">
            {inCart.qty} in plan
          </Badge>
        )}
      </div>

      {product.linesToReview > 0 && (
        <div className="text-[10px] text-amber-700 bg-amber-50 rounded px-2 py-1">
          {product.linesToReview} recipe line{product.linesToReview > 1 ? "s" : ""} need attention (see ERP)
        </div>
      )}
    </Card>
  )
}

function RecipeSheet({ product }: { product: CatalogueProduct }) {
  return (
    <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
      <SheetHeader>
        <SheetTitle className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-rose-600" />
          {product.name} {product.size && <span className="text-stone-500 text-sm">({product.size})</span>}
        </SheetTitle>
        <p className="text-xs text-stone-500">
          SKU {product.sku} · Recipe ({product.recipeLines.length} components)
        </p>
      </SheetHeader>
      <div className="mt-4 space-y-3">
        {product.recipeLines.map((line, i) => (
          <div key={i} className="rounded-lg border border-stone-200 p-3 text-sm">
            <div className="flex justify-between items-baseline">
              <span className="font-medium text-stone-800">{line.componentName}</span>
              <span className="text-rose-700 font-semibold">
                {line.qty} {line.unit}
                {line.qty > 1 && line.unit !== "pack" ? "s" : ""}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-2 text-xs text-stone-500">
              <Badge variant="outline" className="text-[10px] capitalize">{line.category}</Badge>
              {line.color && <span>· {line.color}</span>}
              <span>· {line.componentSku}</span>
            </div>
          </div>
        ))}
      </div>
    </SheetContent>
  )
}

export function CatalogueGrid() {
  const products = useCatalogue((s) => s.products)
  const loading = useCatalogue((s) => s.loading)
  const [selected, setSelected] = useCatalogueSelector()

  const grouped = useMemo(() => {
    const byName = new Map<string, CatalogueProduct[]>()
    for (const p of products) {
      const arr = byName.get(p.name) ?? []
      arr.push(p)
      byName.set(p.name, arr)
    }
    return Array.from(byName.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [products])

  if (loading && products.length === 0) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-64 rounded-xl bg-stone-100 animate-pulse" />
        ))}
      </div>
    )
  }

  if (products.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-stone-300 p-12 text-center text-stone-500">
        <ShoppingBag className="h-10 w-10 mx-auto mb-3 text-stone-300" />
        <p className="font-medium">No products in catalogue yet</p>
        <p className="text-sm">Upload an ERP Excel file to get started</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {grouped.map(([name, sizes]) => (
        <section key={name}>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-lg font-semibold text-stone-800">{name}</h2>
            <span className="text-xs text-stone-500">
              {sizes.length} size{sizes.length > 1 ? "s" : ""}
            </span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sizes.map((p) => (
              <Sheet key={p.sku} open={selected === p.sku} onOpenChange={(o) => setSelected(o ? p.sku : null)}>
                <div className="flex flex-col gap-2">
                  <ProductCard product={p} />
                  <SheetTrigger asChild>
                    <Button variant="link" size="sm" className="text-xs text-stone-500">
                      View recipe ({p.recipeLines.length} components)
                    </Button>
                  </SheetTrigger>
                </div>
                <RecipeSheet product={p} />
              </Sheet>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

// Small helper hook to track which product's recipe sheet is open
function useCatalogueSelector(): [string | null, (v: string | null) => void] {
  const [state, setState] = useState<string | null>(null)
  return [state, setState]
}
