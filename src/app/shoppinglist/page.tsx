// src/app/shoppinglist/page.tsx
//
// Shopping List — procurement plan for upcoming orders.
// Aggregates materials needed across all active orders, compares to stock on hand,
// and computes what needs to be bought per supplier.

import { db as prisma } from "@/lib/db"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { GeneratePdfButton } from "./generate-pdf-button"

async function getShoppingListData() {
  // Get all active orders with their line items
  const activeOrders = await prisma.order.findMany({
    where: {
      status: { in: ["payment_confirmed", "procuring", "producing"] },
    },
    include: {
      customer: { select: { name: true } },
      lineItems: true,
    },
    orderBy: { deliveryDate: "asc" },
  })

  // Collect all product SKUs referenced, then fetch products + their recipe lines in one go
  const allProductSkus = new Set<string>()
  for (const order of activeOrders) {
    for (const li of order.lineItems) {
      if (li.productSku) allProductSkus.add(li.productSku)
    }
  }
  const products = await prisma.product.findMany({
    where: { sku: { in: Array.from(allProductSkus) } },
    include: {
      recipeLines: {
        include: {
          material: {
            select: {
              sku: true,
              name: true,
              category: true,
              currentStockPacks: true,
              packPrice: true,
              unitsPerPack: true,
              supplier: true,
            },
          },
        },
      },
    },
  })
  const productBySku = new Map(products.map((p) => [p.sku, p]))

  // Aggregate material needs across all active orders
  const materialNeeds = new Map<string, {
    sku: string
    name: string
    category: string
    supplier: string | null
    currentStockPacks: number | null
    packPrice: number | null
    unitsPerPack: number | null
    totalStemsNeeded: number
    orders: string[]
  }>()

  for (const order of activeOrders) {
    for (const lineItem of order.lineItems) {
      const product = productBySku.get(lineItem.productSku)
      if (!product) continue
      for (const recipeLine of product.recipeLines) {
        const mat = recipeLine.material
        if (!mat) continue
        const existing = materialNeeds.get(mat.sku) ?? {
          sku: mat.sku,
          name: mat.name,
          category: mat.category,
          supplier: mat.supplier,
          currentStockPacks: mat.currentStockPacks,
          packPrice: mat.packPrice,
          unitsPerPack: mat.unitsPerPack,
          totalStemsNeeded: 0,
          orders: [],
        }
        existing.totalStemsNeeded += recipeLine.qty * lineItem.qty
        if (!existing.orders.includes(order.orderNumber)) {
          existing.orders.push(order.orderNumber)
        }
        materialNeeds.set(mat.sku, existing)
      }
    }
  }

  // Convert to array + compute packs to buy
  const materials = Array.from(materialNeeds.values()).map((m) => {
    const unitsPerPack = m.unitsPerPack ?? 12 // default assumption
    const packsNeeded = Math.ceil(m.totalStemsNeeded / unitsPerPack)
    const currentStock = m.currentStockPacks ?? 0
    const packsToBuy = Math.max(0, packsNeeded - currentStock)
    const estimatedCost = packsToBuy * (m.packPrice ?? 0)
    return { ...m, packsNeeded, packsToBuy, estimatedCost, unitsPerPack }
  })

  // Group by supplier
  const bySupplier = materials.reduce((acc, m) => {
    const supplier = m.supplier ?? "Unassigned"
    if (!acc[supplier]) acc[supplier] = { materials: [], totalCost: 0, packsToBuy: 0 }
    acc[supplier].materials.push(m)
    acc[supplier].totalCost += m.estimatedCost
    acc[supplier].packsToBuy += m.packsToBuy
    return acc
  }, {} as Record<string, { materials: typeof materials; totalCost: number; packsToBuy: number }>)

  return { activeOrders, materials, bySupplier }
}

const CATEGORY_COLORS: Record<string, string> = {
  flower: "bg-rose-50 text-rose-700 border-rose-300",
  foliage: "bg-emerald-50 text-emerald-700 border-emerald-300",
  packaging: "bg-amber-50 text-amber-700 border-amber-300",
  other: "bg-stone-100 text-stone-700 border-stone-300",
}

export default async function ShoppingListPage() {
  const { activeOrders, materials, bySupplier } = await getShoppingListData()

  // KPIs
  const totalOrders = activeOrders.length
  const totalMaterials = materials.length
  const totalPacksToBuy = materials.reduce((s, m) => s + m.packsToBuy, 0)
  const totalEstimatedCost = materials.reduce((s, m) => s + m.estimatedCost, 0)
  const totalSuppliers = Object.keys(bySupplier).length

  return (
    <main className="min-h-screen bg-stone-50 px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-wrap justify-between items-start gap-4">
          <div>
            <div className="text-xs uppercase tracking-wider text-stone-500">
              Procurement plan · v1.9
            </div>
            <h1 className="mt-1 text-3xl font-bold text-stone-900">Shopping List</h1>
            <p className="mt-1 text-sm text-stone-600">
              Aggregated materials needed across all active orders. Compares to stock on hand and computes what to buy per supplier.
            </p>
          </div>
          <GeneratePdfButton activeOrders={activeOrders} />
        </header>

        {/* KPI bar */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-0 mb-6 border border-stone-200 rounded-lg overflow-hidden bg-white">
          <KpiCell value={`${totalOrders}`} label="Active orders" />
          <KpiCell value={`${totalMaterials}`} label="Materials needed" color="purple" />
          <KpiCell value={`${totalPacksToBuy}`} label="Packs to buy" color="amber" />
          <KpiCell value={`${totalSuppliers}`} label="Suppliers" />
          <KpiCell
            value={`$${totalEstimatedCost.toLocaleString("es-MX", { maximumFractionDigits: 0 })}`}
            label="Est. procurement cost"
            color="red"
          />
        </div>

        {/* Active orders */}
        {activeOrders.length > 0 && (
          <Card className="mb-6 border-stone-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Active Orders Feeding This List ({activeOrders.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {activeOrders.map((o) => (
                  <Badge key={o.id} variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">
                    {o.orderNumber} · {o.customer.name}
                    {o.deliveryDate && (
                      <span className="ml-2 text-xs">
                        ({o.deliveryDate.toLocaleDateString("es-MX", { day: "2-digit", month: "short" })})
                      </span>
                    )}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Shopping list grouped by supplier */}
        {Object.keys(bySupplier).length === 0 ? (
          <Card className="border-dashed border-stone-300">
            <CardContent className="py-12 text-center text-stone-400">
              No active orders in the pipeline. The shopping list will populate once orders move to &quot;payment_confirmed&quot; or &quot;procuring&quot; status.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {Object.entries(bySupplier).map(([supplier, data]) => (
              <Card key={supplier} className="border-stone-200">
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">🏭 {supplier}</CardTitle>
                      <div className="text-xs text-stone-500 mt-1">
                        {data.materials.length} materials · {data.packsToBuy} packs to buy
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-stone-500 uppercase tracking-wider">Subtotal</div>
                      <div className="text-xl font-bold text-stone-900">
                        ${data.totalCost.toLocaleString("es-MX", { maximumFractionDigits: 0 })}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-stone-200 text-stone-600 text-xs uppercase tracking-wider">
                          <th className="text-left py-2 px-2">SKU</th>
                          <th className="text-left py-2 px-2">Material</th>
                          <th className="text-left py-2 px-2">Category</th>
                          <th className="text-right py-2 px-2">Stems needed</th>
                          <th className="text-right py-2 px-2">Units/pack</th>
                          <th className="text-right py-2 px-2">Packs needed</th>
                          <th className="text-right py-2 px-2">In stock</th>
                          <th className="text-right py-2 px-2 font-bold">To buy</th>
                          <th className="text-right py-2 px-2">Est. cost</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.materials.map((m) => (
                          <tr key={m.sku} className="border-b border-stone-50 hover:bg-stone-50">
                            <td className="py-2 px-2 font-mono text-xs text-stone-500">{m.sku}</td>
                            <td className="py-2 px-2 font-medium text-stone-900">{m.name}</td>
                            <td className="py-2 px-2">
                              <Badge
                                variant="outline"
                                className={`text-xs ${CATEGORY_COLORS[m.category] ?? CATEGORY_COLORS.other}`}
                              >
                                {m.category}
                              </Badge>
                            </td>
                            <td className="py-2 px-2 text-right text-stone-700">{m.totalStemsNeeded}</td>
                            <td className="py-2 px-2 text-right text-stone-500">{m.unitsPerPack}</td>
                            <td className="py-2 px-2 text-right text-stone-700">{m.packsNeeded}</td>
                            <td className="py-2 px-2 text-right text-stone-500">{m.currentStockPacks ?? 0}</td>
                            <td className={`py-2 px-2 text-right font-bold ${
                              m.packsToBuy > 0 ? "text-amber-700" : "text-emerald-700"
                            }`}>
                              {m.packsToBuy > 0 ? m.packsToBuy : "✓ covered"}
                            </td>
                            <td className="py-2 px-2 text-right text-stone-700">
                              ${m.estimatedCost.toLocaleString("es-MX", { maximumFractionDigits: 0 })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Business rules */}
        <Card className="mt-6 border-stone-200 bg-stone-50/50">
          <CardContent className="pt-6 text-sm text-stone-700 space-y-2">
            <div className="font-semibold text-stone-900">How the shopping list works</div>
            <ul className="list-disc list-inside ml-2 space-y-1 text-xs">
              <li><strong>Aggregates across all active orders</strong> — orders in payment_confirmed / procuring / producing status.</li>
              <li><strong>Multiplies order qty × recipe qty</strong> per material to compute total stems needed.</li>
              <li><strong>Divides by units/pack</strong> (default 12 if not set) to compute packs needed.</li>
              <li><strong>Subtracts current stock</strong> to determine what to actually buy.</li>
              <li><strong>Groups by Preferred Supplier</strong> — each supplier becomes a separate PO when generated.</li>
              <li><strong>Warns (doesn&apos;t block)</strong> when capacity exceeded or dates are near blocked. Maria can override.</li>
            </ul>
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
  color?: "default" | "purple" | "amber" | "red"
}) {
  const colorMap = {
    default: "text-stone-900",
    purple: "text-violet-700",
    amber: "text-amber-700",
    red: "text-red-700",
  }
  return (
    <div className="p-3 border-r border-stone-200 last:border-r-0 min-w-[120px]">
      <div className={`text-xl font-bold ${colorMap[color]}`}>{value}</div>
      <div className="text-xs text-stone-500 mt-0.5">{label}</div>
    </div>
  )
}
