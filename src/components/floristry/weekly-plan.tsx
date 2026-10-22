"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Trash2,
  Minus,
  Plus,
  CalendarDays,
  ClipboardList,
  CalendarClock,
  User,
  ShoppingCart,
} from "lucide-react"
import { useCatalogue } from "@/lib/catalogue-store"
import { usePlanStore } from "@/lib/plan-store"
import { useMemo } from "react"

function nextMondayIso() {
  const d = new Date()
  const day = d.getDay() // 0=Sun,1=Mon
  const diff = day === 1 ? 7 : (8 - day) % 7 || 7
  d.setDate(d.getDate() + diff)
  return d.toISOString().split("T")[0]
}

/** Format ISO yyyy-mm-dd as dd-mm-yyyy (Mexican style). */
function isoToDdMmYyyy(iso: string): string {
  const [y, m, d] = iso.split("-")
  return `${d}-${m}-${y}`
}

/** Given a Monday ISO date, return the Sunday ISO date 6 days later. */
function weekEndIso(mondayIso: string): string {
  const d = new Date(mondayIso + "T00:00:00")
  d.setDate(d.getDate() + 6)
  return d.toISOString().split("T")[0]
}

export function WeeklyPlan() {
  const products = useCatalogue((s) => s.products)
  const items = usePlanStore((s) => s.items)
  const setQty = usePlanStore((s) => s.setQty)
  const setDeliveryDate = usePlanStore((s) => s.setDeliveryDate)
  const setCustomerName = usePlanStore((s) => s.setCustomerName)
  const removeItem = usePlanStore((s) => s.removeItem)
  const clear = usePlanStore((s) => s.clear)
  const weekStartDate = usePlanStore((s) => s.weekStartDate)
  const setWeekStartDate = usePlanStore((s) => s.setWeekStartDate)
  const setShoppingListOpen = usePlanStore((s) => s.setShoppingListOpen)

  const productBySku = useMemo(() => {
    return new Map(products.map((p) => [p.sku, p]))
  }, [products])

  const lineItems = items
    .map((it) => {
      const p = productBySku.get(it.productSku)
      if (!p) return null
      return {
        product: p,
        qty: it.qty,
        deliveryDate: it.deliveryDate,
        customerName: it.customerName,
      }
    })
    .filter(
      (x): x is {
        product: typeof products[number]
        qty: number
        deliveryDate: string | null
        customerName: string | null
      } => x !== null,
    )

  const totalRevenue = lineItems.reduce(
    (sum, i) => sum + i.product.actualPriceBeforeIva * i.qty,
    0,
  )
  const totalCost = lineItems.reduce((sum, i) => sum + i.product.totalCost * i.qty, 0)
  const totalBouquets = lineItems.reduce((sum, i) => sum + i.qty, 0)

  // Resolve week start; show date range "26-10-2026 to 01-11-2026"
  const mondayIso = weekStartDate ?? nextMondayIso()
  const sundayIso = weekEndIso(mondayIso)
  const weekRangeLabel = `${isoToDdMmYyyy(mondayIso)} to ${isoToDdMmYyyy(sundayIso)}`

  return (
    <div className="space-y-4">
      {/* Header card: week date range + actions */}
      <Card className="border-rose-200 bg-rose-50/40 p-5">
        <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-rose-700" />
            <h2 className="text-lg font-semibold text-stone-800">Weekly Plan</h2>
          </div>
          <div className="flex items-center gap-2">
            {items.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clear}
                className="text-xs text-stone-500 hover:text-rose-700"
              >
                Clear
              </Button>
            )}
            <Button
              size="sm"
              onClick={() => setShoppingListOpen(true)}
              disabled={items.length === 0}
              className="bg-rose-600 hover:bg-rose-700 text-white gap-1.5"
            >
              <ShoppingCart className="h-4 w-4" />
              Shopping List
            </Button>
          </div>
        </div>

        <div className="grid sm:grid-cols-[200px_1fr] gap-3 items-end">
          <div>
            <Label
              htmlFor="week-start"
              className="text-xs text-stone-600 flex items-center gap-1.5 mb-1.5"
            >
              <CalendarDays className="h-3.5 w-3.5" /> Week starting (Monday)
            </Label>
            <Input
              id="week-start"
              type="date"
              value={mondayIso}
              onChange={(e) => setWeekStartDate(e.target.value || null)}
              className="bg-white"
            />
          </div>
          <div className="rounded-md bg-white/70 px-3 py-2 border border-rose-100">
            <div className="text-[10px] uppercase tracking-wide text-stone-500">Week range</div>
            <div className="text-sm font-semibold text-stone-800 mt-0.5">{weekRangeLabel}</div>
          </div>
        </div>
      </Card>

      {/* Plan items */}
      <Card className="border-rose-200 bg-white p-4">
        {lineItems.length === 0 ? (
          <div className="rounded-lg border border-dashed border-rose-200 bg-rose-50/30 p-8 text-center">
            <ClipboardList className="h-10 w-10 mx-auto text-stone-300 mb-3" />
            <p className="text-sm text-stone-500 font-medium">No bouquets yet</p>
            <p className="text-xs text-stone-400 mt-1">
              Go to the Catalogue tab to add bouquets to your weekly plan.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {lineItems.map(({ product, qty, deliveryDate, customerName }) => (
              <div
                key={product.sku}
                className="rounded-lg border border-rose-200 bg-white p-3 text-sm"
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-stone-800 truncate">{product.name}</div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {product.size && (
                        <Badge variant="outline" className="text-[10px] py-0">
                          {product.size}
                        </Badge>
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

                {/* Customer + delivery date row */}
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="relative">
                    <User className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-stone-400 pointer-events-none" />
                    <Input
                      type="text"
                      value={customerName ?? ""}
                      onChange={(e) => setCustomerName(product.sku, e.target.value || null)}
                      placeholder="Customer name"
                      aria-label={`Customer name for ${product.name}`}
                      className="h-7 pl-7 pr-2 text-xs bg-stone-50 border-stone-200 text-stone-700"
                    />
                  </div>
                  <div className="relative">
                    <CalendarClock className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-stone-400 pointer-events-none" />
                    <Input
                      type="date"
                      value={deliveryDate ?? ""}
                      onChange={(e) => setDeliveryDate(product.sku, e.target.value || null)}
                      aria-label={`Delivery date for ${product.name}`}
                      placeholder="Delivery date"
                      className="h-7 pl-7 pr-2 text-xs bg-stone-50 border-stone-200 text-stone-700"
                    />
                  </div>
                </div>
                {deliveryDate && (
                  <div className="mt-1.5">
                    <Badge variant="outline" className="text-[10px] py-0">
                      {new Date(deliveryDate + "T00:00:00").toLocaleDateString("es-MX", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                      })}
                    </Badge>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Totals */}
      {lineItems.length > 0 && (
        <Card className="border-rose-200 bg-white p-4 space-y-1.5 text-sm">
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
        </Card>
      )}
    </div>
  )
}
