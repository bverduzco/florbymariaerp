"use client"

import { useMemo, useState } from "react"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { DollarSign, Truck, Percent, TrendingUp, Package, ShoppingCart } from "lucide-react"
import { useCatalogue } from "@/lib/catalogue-store"
import { usePlanStore } from "@/lib/plan-store"

const DELIVERY_FLAT_RATE_PER_ADDRESS = 100 // MXN per unique address

/**
 * "Moneys" totals section — shown at the bottom of the Catalogue tab.
 * Aggregates all current plan items and shows financial summary:
 *   Bouquets · Est. Cost · Subtotal · Delivery · Discount · Est. Profit
 */
export function MoneysSection() {
  const products = useCatalogue((s) => s.products)
  const items = usePlanStore((s) => s.items)
  const [discount, setDiscount] = useState<number>(0)

  const productBySku = useMemo(() => {
    return new Map(products.map((p) => [p.sku, p]))
  }, [products])

  const totals = useMemo(() => {
    let bouquets = 0
    let estCost = 0
    let subtotal = 0
    const uniqueAddresses = new Set<string>()

    for (const item of items) {
      const product = productBySku.get(item.productSku)
      if (!product) continue
      bouquets += item.qty
      estCost += product.totalCost * item.qty
      subtotal += product.actualPriceBeforeIva * item.qty
      // Treat each distinct customer name as a distinct delivery address
      if (item.customerName && item.customerName.trim().length > 0) {
        uniqueAddresses.add(item.customerName.trim().toLowerCase())
      }
    }

    const delivery = uniqueAddresses.size * DELIVERY_FLAT_RATE_PER_ADDRESS
    const profit = subtotal - estCost - delivery - (discount || 0)

    return {
      bouquets,
      estCost,
      subtotal,
      deliveryAddresses: uniqueAddresses.size,
      delivery,
      discount: discount || 0,
      profit,
    }
  }, [items, productBySku, discount])

  if (items.length === 0) {
    return null
  }

  return (
    <Card className="border-rose-300 bg-gradient-to-br from-rose-50 via-pink-50 to-amber-50 p-5 mt-6">
      <div className="flex items-center gap-2 mb-4">
        <DollarSign className="h-5 w-5 text-rose-700" />
        <h2 className="text-lg font-semibold text-stone-800">Moneys</h2>
        <Badge variant="outline" className="text-xs ml-auto">
          {totals.bouquets} bouquet{totals.bouquets !== 1 ? "s" : ""} in plan
        </Badge>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <MoneyCell
          label="Bouquets"
          value={String(totals.bouquets)}
          icon={<Package className="h-3.5 w-3.5 text-stone-400" />}
        />
        <MoneyCell
          label="Est. Cost"
          value={`$${Math.round(totals.estCost).toLocaleString("es-MX")}`}
          sublabel="materials"
          icon={<ShoppingCart className="h-3.5 w-3.5 text-stone-400" />}
        />
        <MoneyCell
          label="Subtotal"
          value={`$${Math.round(totals.subtotal).toLocaleString("es-MX")}`}
          sublabel="pre-IVA"
          icon={<DollarSign className="h-3.5 w-3.5 text-stone-400" />}
        />
        <MoneyCell
          label="Delivery"
          value={`$${totals.delivery.toLocaleString("es-MX")}`}
          sublabel={`${totals.deliveryAddresses} address${totals.deliveryAddresses !== 1 ? "es" : ""} × $${DELIVERY_FLAT_RATE_PER_ADDRESS}`}
          icon={<Truck className="h-3.5 w-3.5 text-stone-400" />}
        />

        {/* Discount — editable */}
        <div className="rounded-lg bg-white/70 border border-stone-200 p-2.5">
          <div className="text-[10px] uppercase tracking-wide text-stone-500 flex items-center gap-1">
            <Percent className="h-3.5 w-3.5 text-stone-400" />
            Discount
          </div>
          <div className="mt-1 flex items-center gap-1">
            <span className="text-stone-500 text-sm">$</span>
            <Input
              type="number"
              min={0}
              value={discount || ""}
              onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
              placeholder="0"
              aria-label="Discount amount"
              className="h-7 text-sm font-semibold text-stone-800 border-0 bg-transparent px-0 focus-visible:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none w-full"
            />
          </div>
        </div>

        {/* Est. profit */}
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-2.5">
          <div className="text-[10px] uppercase tracking-wide text-emerald-700 flex items-center gap-1">
            <TrendingUp className="h-3.5 w-3.5" />
            Est. profit
          </div>
          <div className="mt-1 text-lg font-bold text-emerald-800">
            ${Math.round(totals.profit).toLocaleString("es-MX")}
          </div>
        </div>
      </div>

      {/* Calculation breakdown */}
      <div className="mt-3 pt-3 border-t border-rose-200 text-xs text-stone-500">
        <strong className="text-stone-700">How this is calculated:</strong>{" "}
        Subtotal = sum of (bouquet price × qty). Est. Cost = sum of material costs from ERP recipes.
        Delivery = $100 MXN per unique customer name in the plan (treated as one delivery address each).
        Est. profit = Subtotal − Est. Cost − Delivery − Discount. All amounts pre-IVA.
      </div>
    </Card>
  )
}

function MoneyCell({
  label,
  value,
  sublabel,
  icon,
}: {
  label: string
  value: string
  sublabel?: string
  icon?: React.ReactNode
}) {
  return (
    <div className="rounded-lg bg-white/70 border border-stone-200 p-2.5">
      <div className="text-[10px] uppercase tracking-wide text-stone-500 flex items-center gap-1">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-base font-semibold text-stone-800">{value}</div>
      {sublabel && <div className="text-[10px] text-stone-500 mt-0.5">{sublabel}</div>}
    </div>
  )
}
