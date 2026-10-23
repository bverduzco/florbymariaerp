"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import {
  ShoppingCart,
  Truck,
  AlertTriangle,
  Download,
  RefreshCw,
  Package,
  Flower2,
  Leaf,
  Gift,
  FileDown,
  Loader2,
  ClipboardCheck,
} from "lucide-react"
import { usePlanStore } from "@/lib/plan-store"
import { toast } from "sonner"

interface UsedBy {
  productSku: string
  productName: string
  qty: number
  deliveryDate: string | null
  customerName: string | null
}

interface ShoppingLine {
  materialSku: string
  materialName: string
  category: string
  supplier: string
  unit: string
  totalQty: number
  unitCost: number
  totalCost: number
  packPrice: number | null
  unitsPerPack: number | null
  packsToBuy: number | null
  packQtyRounded: number | null
  totalPackCost: number | null
  usedBy: UsedBy[]
  warning: string | null
}

interface PlanResponse {
  planSummary: {
    weekStartDate: string | null
    totalBouquets: number
    totalRevenue: number
    totalCost: number
    estimatedProfit: number
    marginPct: number
    distinctMaterials: number
    distinctSuppliers: number
  }
  shoppingList: ShoppingLine[]
  bySupplier: Record<string, { lines: ShoppingLine[]; totalPackCost: number; lineCount: number }>
  byCategory: Record<string, { lines: ShoppingLine[]; totalCost: number }>
}

const CATEGORY_ICON: Record<string, typeof Flower2> = {
  flower: Flower2,
  foliage: Leaf,
  packaging: Gift,
  other: Package,
}

const CATEGORY_LABEL: Record<string, string> = {
  flower: "Flowers",
  foliage: "Foliage",
  packaging: "Packaging",
  other: "Other",
}

export function ShoppingListPanel({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const items = usePlanStore((s) => s.items)
  const weekStartDate = usePlanStore((s) => s.weekStartDate)

  const [data, setData] = useState<PlanResponse | null>(null)
  const [orders, setOrders] = useState<any[]>([])
  const [ordersLoaded, setOrdersLoaded] = useState(false)
  const [printingPdf, setPrintingPdf] = useState(false)
  const [creatingPOs, setCreatingPOs] = useState(false)
  const [inventory, setInventory] = useState<Record<string, number>>({})

  // Fetch orders + inventory from DB whenever the panel opens
  useEffect(() => {
    if (open) {
      setOrdersLoaded(false)
      Promise.all([
        fetch("/api/orders", { cache: "no-store" }).then(r => r.ok ? r.json() : { orders: [] }),
        fetch("/api/inventory", { cache: "no-store" }).then(r => r.ok ? r.json() : { materials: [] }),
      ]).then(([ordersData, invData]) => {
        setOrders(ordersData.orders ?? [])
        // Build inventory lookup: { sku: currentStockPacks }
        const invMap: Record<string, number> = {}
        for (const m of invData.materials ?? []) {
          invMap[m.sku] = m.currentStockPacks ?? 0
        }
        setInventory(invMap)
        setOrdersLoaded(true)
      }).catch(() => {
        setOrders([])
        setInventory({})
        setOrdersLoaded(true)
      })
    }
  }, [open])

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function fetchPlan() {
    // Combine localStorage plan items + order line items from DB
    const planItems = items.map((i) => ({
      productSku: i.productSku,
      qty: i.qty,
      deliveryDate: i.deliveryDate ?? null,
      customerName: i.customerName ?? null,
    }))

    // Add order line items — for custom bouquets, use the productSku as-is
    // (the /api/plan endpoint will try to look up the recipe; if the SKU is a
    // custom hidden recipe, it won't find recipe lines, but at least the
    // qty/revenue will be counted)
    const orderItems = orders.flatMap((o: any) =>
      (o.lineItems ?? []).map((li: any) => ({
        productSku: li.productSku,
        qty: li.qty,
        deliveryDate: o.deliveryDate ?? null,
        customerName: o.customerName ?? null,
      })),
    )

    const allItems = [...planItems, ...orderItems]

    if (allItems.length === 0) {
      setData(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: allItems,
          weekStartDate,
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = (await res.json()) as PlanResponse
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  // Re-fetch when panel opens + orders have loaded, or when plan items change
  useEffect(() => {
    if (!open || !ordersLoaded) return
    if (items.length > 0 || orders.length > 0) {
      fetchPlan()
    } else {
      setData(null)
    }
  }, [open, items, orders, ordersLoaded, weekStartDate])

  function downloadCsv() {
    if (!data) return
    const rows = [
      ["Supplier", "Category", "Material SKU", "Material Name", "Unit", "Total Qty Needed", "Pack Size", "Packs to Buy", "Pack Price", "Total Pack Cost", "Warning", "Used By (with customer + delivery dates)"],
      ...data.shoppingList.map((l) => [
        l.supplier,
        l.category,
        l.materialSku,
        l.materialName,
        l.unit,
        l.totalQty.toString(),
        l.unitsPerPack?.toString() ?? "unknown",
        l.packQtyRounded?.toString() ?? "?",
        l.packPrice?.toString() ?? "?",
        l.totalPackCost?.toFixed(2) ?? "?",
        l.warning ?? "",
        l.usedBy.map((u) => {
          const parts = [u.productName, `x${u.qty}`]
          if (u.customerName) parts.push(`[customer: ${u.customerName}]`)
          if (u.deliveryDate) parts.push(`(delivery ${u.deliveryDate})`)
          return parts.join(" ")
        }).join("; "),
      ]),
    ]
    const csv = rows.map((r) => r.map((c) => `"${(c ?? "").toString().replace(/"/g, '""')}"`).join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `shopping-list-${weekStartDate ?? "weekly"}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function printPdf() {
    setPrintingPdf(true)
    try {
      // Build the same items payload that fetchPlan uses
      const planItems = items.map((i) => ({
        productSku: i.productSku,
        qty: i.qty,
        deliveryDate: i.deliveryDate ?? null,
        customerName: i.customerName ?? null,
      }))
      const orderItems = orders.flatMap((o: any) =>
        (o.lineItems ?? []).map((li: any) => ({
          productSku: li.productSku,
          qty: li.qty,
          deliveryDate: o.deliveryDate ?? null,
          customerName: o.customerName ?? null,
        })),
      )
      const allItems = [...planItems, ...orderItems]

      const res = await fetch("/api/plan/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: allItems, weekStartDate }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${res.status}`)
      }
      const result = await res.json()
      toast.success("Shopping list PDF generated", {
        description: result.fileName,
        duration: 5000,
      })
      // Trigger browser download
      const link = document.createElement("a")
      link.href = `/download/${encodeURIComponent(result.fileName)}`
      link.download = result.fileName
      link.target = "_blank"
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (e) {
      toast.error("Failed to generate PDF", {
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setPrintingPdf(false)
    }
  }

  async function createPOs() {
    if (!data) return
    setCreatingPOs(true)
    try {
      // Create one PO per supplier
      const suppliers = Object.keys(data.bySupplier)
      const createdPOs: string[] = []

      for (const supplier of suppliers) {
        const group = data.bySupplier[supplier]
        const lines = group.lines
          .filter((l) => l.packQtyRounded && l.packQtyRounded > 0)
          .map((l) => ({
            materialSku: l.materialSku,
            materialName: l.materialName,
            qtyPacks: l.packQtyRounded!,
            costPerPack: l.packPrice ?? 0,
          }))

        if (lines.length === 0) continue

        const res = await fetch("/api/purchase-orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ supplier, lines }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.error || `HTTP ${res.status}`)
        }
        const poData = await res.json()
        createdPOs.push(poData.purchaseOrder.poNumber)
      }

      if (createdPOs.length > 0) {
        toast.success(`Created ${createdPOs.length} Purchase Order${createdPOs.length > 1 ? "s" : ""}`, {
          description: createdPOs.join(", ") + " — view them in the Purchase Orders section",
          duration: 8000,
        })
      } else {
        toast.info("No POs created — all materials have unknown pack sizes")
      }
    } catch (e) {
      toast.error("Failed to create POs", {
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setCreatingPOs(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl p-0 gap-0 flex flex-col overflow-hidden">
        <SheetHeader className="p-5 pb-3 border-b border-stone-200 shrink-0">
          <SheetTitle className="flex items-center gap-2 text-xl">
            <ShoppingCart className="h-5 w-5 text-rose-600" />
            Shopping List
          </SheetTitle>
          <SheetDescription className="text-stone-500">
            Auto-generated from the recipes in your ERP. Quantities are per pack (round up).
          </SheetDescription>
        </SheetHeader>

        {items.length === 0 && orders.length === 0 && !loading ? (
          <div className="flex-1 flex items-center justify-center p-8 overflow-y-auto">
            <div className="text-center">
              <ShoppingCart className="h-12 w-12 mx-auto text-stone-300 mb-3" />
              <p className="text-stone-600 font-medium">Your plan is empty</p>
              <p className="text-sm text-stone-400 mt-1">Add bouquets to the weekly plan first.</p>
            </div>
          </div>
        ) : loading ? (
          <div className="p-5 space-y-3 overflow-y-auto">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : error ? (
          <div className="p-5 overflow-y-auto">
            <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-red-700">
              <p className="font-medium">Failed to generate shopping list</p>
              <p className="text-sm mt-1">{error}</p>
            </div>
          </div>
        ) : data ? (
          <>
            {/* Summary card */}
            <div className="p-5 grid grid-cols-2 sm:grid-cols-4 gap-3 border-b border-stone-200 shrink-0">
              <StatCard label="Bouquets" value={String(data.planSummary.totalBouquets)} />
              <StatCard label="Materials" value={String(data.planSummary.distinctMaterials)} />
              <StatCard label="Suppliers" value={String(data.planSummary.distinctSuppliers)} />
              <StatCard
                label="Est. Cost"
                value={`$${Math.round(
                  data.shoppingList.reduce((s, l) => s + (l.totalPackCost ?? 0), 0),
                ).toLocaleString("es-MX")}`}
              />
              {data.shoppingList.some((l) => l.warning) && (
                <div className="col-span-2 sm:col-span-4 rounded-md bg-amber-50 border border-amber-200 p-2 text-xs text-amber-800 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  Some materials have unknown pack sizes — see flags below.
                </div>
              )}
            </div>

            {/* Toolbar */}
            <div className="px-5 py-2 border-b border-stone-200 flex justify-end gap-2 shrink-0">
              <Button variant="outline" size="sm" onClick={fetchPlan} className="gap-1.5 text-xs">
                <RefreshCw className="h-3.5 w-3.5" /> Refresh
              </Button>
              <Button variant="outline" size="sm" onClick={downloadCsv} className="gap-1.5 text-xs">
                <Download className="h-3.5 w-3.5" /> Download CSV
              </Button>
              <Button variant="outline" size="sm" onClick={printPdf} disabled={printingPdf} className="gap-1.5 text-xs">
                {printingPdf ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
                Print PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={createPOs}
                disabled={creatingPOs || !data}
                className="gap-1.5 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50"
              >
                {creatingPOs ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ClipboardCheck className="h-3.5 w-3.5" />}
                Create POs
              </Button>
            </div>

            {/* Body — grouped by supplier; scrollable */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-5 space-y-6">
                {Object.entries(data.bySupplier)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([supplier, group]) => (
                    <div key={supplier}>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-stone-800 flex items-center gap-2">
                          <Truck className="h-4 w-4 text-stone-500" />
                          {supplier || "Unknown supplier"}
                        </h3>
                        <span className="text-xs text-stone-500">
                          {group.lineCount} items · ${Math.round(group.totalPackCost).toLocaleString("es-MX")}
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        {group.lines.map((line) => {
                          const Icon = CATEGORY_ICON[line.category] ?? Package
                          return (
                            <div
                              key={line.materialSku}
                              className="rounded-lg border border-stone-200 bg-white p-3"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <Icon className="h-4 w-4 text-stone-500 shrink-0" />
                                    <span className="font-medium text-stone-800 truncate">{line.materialName}</span>
                                  </div>
                                  <div className="mt-0.5 ml-6 flex items-center gap-2 text-xs text-stone-500 flex-wrap">
                                    <Badge variant="outline" className="text-[10px] py-0">
                                      {CATEGORY_LABEL[line.category] ?? line.category}
                                    </Badge>
                                    <span>{line.materialSku}</span>
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  <div className="text-lg font-bold text-rose-700">
                                    {line.packQtyRounded ?? "?"}{" "}
                                    <span className="text-xs font-normal text-stone-500">packs</span>
                                  </div>
                                  {line.packPrice != null && (
                                    <div className="text-[10px] text-stone-500">
                                      @ ${line.packPrice.toLocaleString("es-MX")}/pack
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="mt-2 ml-6 text-xs text-stone-500 flex flex-wrap items-center gap-x-3 gap-y-1">
                                <span>
                                  Need <strong className="text-stone-700">{line.totalQty}</strong> {line.unit}
                                  {line.totalQty > 1 && line.unit !== "pack" ? "s" : ""}
                                </span>
                                {/* Stock-aware columns */}
                                {(() => {
                                  const stockPacks = inventory[line.materialSku] ?? 0
                                  const packsNeeded = line.packQtyRounded ?? 0
                                  const actualBuy = Math.max(0, packsNeeded - stockPacks)
                                  return (
                                    <>
                                      <span>
                                        Have: <strong className={stockPacks > 0 ? "text-emerald-700" : "text-stone-400"}>{stockPacks}</strong> packs
                                      </span>
                                      {stockPacks > 0 && (
                                        <span>
                                          Buy: <strong className={actualBuy > 0 ? "text-rose-700" : "text-emerald-700"}>{actualBuy}</strong> packs
                                        </span>
                                      )}
                                    </>
                                  )
                                })()}
                                {line.unitsPerPack && (
                                  <span>
                                    Pack size: <strong className="text-stone-700">{line.unitsPerPack}</strong>
                                  </span>
                                )}
                                {line.totalPackCost != null && (
                                  <span>
                                    ={" "}
                                    <strong className="text-stone-700">
                                      ${Math.round(line.totalPackCost).toLocaleString("es-MX")}
                                    </strong>
                                  </span>
                                )}
                              </div>

                              {/* Perishable warning */}
                              {(() => {
                                const stockPacks = inventory[line.materialSku] ?? 0
                                const packsNeeded = line.packQtyRounded ?? 0
                                const hasStock = stockPacks > 0
                                return hasStock ? (
                                  <div className="mt-1 ml-6 text-[10px] text-amber-600 italic">
                                    ⚠ Flowers are perishable — verify stock quality before using existing inventory
                                  </div>
                                ) : null
                              })()}

                              {line.warning && (
                                <div className="mt-2 ml-6 text-xs text-amber-700 flex items-center gap-1.5">
                                  <AlertTriangle className="h-3 w-3" />
                                  {line.warning}
                                </div>
                              )}

                              <div className="mt-2 ml-6 text-[11px] text-stone-400">
                                Used by:{" "}
                                {line.usedBy.map((u, i) => (
                                  <span key={i}>
                                    {i > 0 && ", "}
                                    {u.customerName && (
                                      <span className="text-stone-600 font-medium">{u.customerName}</span>
                                    )}{" "}
                                    {u.productName} ×{u.qty}
                                    {u.deliveryDate && (
                                      <span className="text-rose-600 ml-1">
                                        (deliver {new Date(u.deliveryDate + "T00:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short" })})
                                      </span>
                                    )}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-stone-50 border border-stone-200 p-2.5">
      <div className="text-[10px] uppercase tracking-wide text-stone-500">{label}</div>
      <div className="text-base font-semibold text-stone-800 mt-0.5">{value}</div>
    </div>
  )
}
