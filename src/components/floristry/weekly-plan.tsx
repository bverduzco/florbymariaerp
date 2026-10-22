"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Trash2, Minus, Plus, CalendarDays, ClipboardList, CalendarClock } from "lucide-react"
import { useCatalogue } from "@/lib/catalogue-store"
import { usePlanStore } from "@/lib/plan-store"
import { useMemo } from "react"

export function WeeklyPlan() {
  const products = useCatalogue((s) => s.products)
  const items = usePlanStore((s) => s.items)
  const setQty = usePlanStore((s) => s.setQty)
  const setDeliveryDate = usePlanStore((s) => s.setDeliveryDate)
  const removeItem = usePlanStore((s) => s.removeItem)
  const clear = usePlanStore((s) => s.clear)
  const weekStartDate = usePlanStore((s) => s.weekStartDate)
  const setWeekStartDate = usePlanStore((s) => s.setWeekStartDate)

  // Build a lookup map
  const productBySku = useMemo(() => {
    const m = new Map(products.map((p) => [p.sku, p]))
    return m
  }, [products])

  const lineItems = items
    .map((it) => {
      const p = productBySku.get(it.productSku)
      return p ? { product: p, qty: it.qty, deliveryDate: it.deliveryDate } : null
    })
    .filter((x): x is { product: typeof products[number]; qty: number; deliveryDate: string | null } => x !== null)

  const totalRevenue = lineItems.reduce(
    (sum, i) => sum + i.product.actualPriceBeforeIva * i.qty,
    0,
  )
  const totalCost = lineItems.reduce((sum, i) => sum + i.product.totalCost * i.qty, 0)
  const totalBouquets = lineItems.reduce((sum, i) => sum + i.qty, 0)

  // Default week start to next Monday if not set
  function nextMondayIso() {
    const d = new Date()
    const day = d.getDay() // 0=Sun,1=Mon
    const diff = day === 1 ? 7 : (8 - day) % 7 || 7
    d.setDate(d.getDate() + diff)
    return d.toISOString().split("T")[0]
  }

  return (
    <Card className="border-rose-200 bg-rose-50/40 p-5 sticky top-4">
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-rose-700" />
          <h2 className="text-lg font-semibold text-stone-800">Weekly Plan</h2>
        </div>
        {items.length > 0 && (
          <Button variant="ghost" size="sm" onClick={clear} className="text-xs text-stone-500 hover:text-rose-700">
            Clear
          </Button>
        )}
      </div>

      <div className="mb-4">
        <Label htmlFor="week-start" className="text-xs text-stone-600 flex items-center gap-1.5 mb-1.5">
          <CalendarDays className="h-3.5 w-3.5" /> Week starting (Monday)
        </Label>
        <Input
          id="week-start"
          type="date"
          value={weekStartDate ?? nextMondayIso()}
          onChange={(e) => setWeekStartDate(e.target.value || null)}
          className="bg-white"
        />
      </div>

      {lineItems.length === 0 ? (
        <div className="rounded-lg border border-dashed border-rose-200 bg-white/60 p-6 text-center">
          <p className="text-sm text-stone-500">No bouquets yet</p>
          <p className="text-xs text-stone-400 mt-1">
            Pick from the catalogue on the left to start your weekly plan.
          </p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1 -mr-1">
          {lineItems.map(({ product, qty, deliveryDate }) => (
            <div
              key={product.sku}
              className="rounded-lg border border-rose-200 bg-white p-2.5 text-sm"
            >
              <div className="flex justify-between items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-stone-800 truncate">{product.name}</div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {product.size && (
                      <Badge variant="outline" className="text-[10px] py-0">{product.size}</Badge>
                    )}
                    <span className="text-xs text-stone-500">
                      ${product.actualPriceBeforeIva.toLocaleString("es-MX")} ea
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => removeItem(product.sku)}
                  className="text-stone-300 hover:text-rose-600 transition-colors p-1"
                  aria-label="Remove"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <div className="flex items-center rounded-md border border-stone-200 bg-stone-50">
                  <button
                    onClick={() => setQty(product.sku, qty - 1)}
                    className="p-1.5 hover:bg-stone-200 rounded-l-md transition-colors"
                    aria-label="Decrease"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <Input
                    type="number"
                    min={0}
                    value={qty}
                    onChange={(e) => setQty(product.sku, parseInt(e.target.value) || 0)}
                    className="w-12 h-7 text-center border-0 bg-transparent px-0 focus-visible:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <button
                    onClick={() => setQty(product.sku, qty + 1)}
                    className="p-1.5 hover:bg-stone-200 rounded-r-md transition-colors"
                    aria-label="Increase"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
                <span className="ml-auto font-semibold text-stone-800">
                  ${(product.actualPriceBeforeIva * qty).toLocaleString("es-MX")}
                </span>
              </div>
              <div className="mt-2 flex items-center gap-1.5">
                <CalendarClock className="h-3 w-3 text-stone-400 shrink-0" />
                <Input
                  type="date"
                  value={deliveryDate ?? ""}
                  onChange={(e) => setDeliveryDate(product.sku, e.target.value || null)}
                  aria-label={`Delivery date for ${product.name}`}
                  placeholder="Delivery date"
                  className="h-7 text-xs bg-stone-50 border-stone-200 text-stone-700 flex-1"
                />
                {deliveryDate && (
                  <Badge variant="outline" className="text-[10px] py-0 shrink-0">
                    {new Date(deliveryDate + "T00:00:00").toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short" })}
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {lineItems.length > 0 && (
        <div className="mt-4 pt-3 border-t border-rose-200 space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-stone-600">Bouquets</span>
            <span className="font-medium">{totalBouquets}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-stone-600">Revenue (pre-IVA)</span>
            <span className="font-medium">${totalRevenue.toLocaleString("es-MX")}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-stone-600">Cost</span>
            <span className="font-medium">${Math.round(totalCost).toLocaleString("es-MX")}</span>
          </div>
          <div className="flex justify-between pt-1.5 border-t border-rose-100">
            <span className="text-stone-700 font-medium">Est. profit</span>
            <span className="font-semibold text-emerald-700">
              ${Math.round(totalRevenue - totalCost).toLocaleString("es-MX")}
            </span>
          </div>
        </div>
      )}
    </Card>
  )
}
