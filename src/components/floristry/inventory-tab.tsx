"use client"

import { useEffect, useState, useMemo } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Package,
  Loader2,
  AlertTriangle,
  Plus,
  Minus,
  Search,
  TrendingDown,
  Boxes,
} from "lucide-react"
import { toast } from "sonner"

interface InventoryItem {
  sku: string
  name: string
  category: string
  unit: string
  supplier: string
  packPrice: number | null
  unitsPerPack: number | null
  excelStockPacks: number | null
  adjustmentPacks: number
  currentStockPacks: number
  isTracked: boolean
  reorderLevel: number | null
  stockValue: number
  recentAdjustments: {
    id: string
    deltaPacks: number
    reason: string
    notes: string
    createdAt: string
  }[]
}

const REASONS = [
  { value: "loss", label: "Pérdida (loss/damage)" },
  { value: "expiration", label: "Caducidad (expiration)" },
  { value: "adjustment", label: "Ajuste (stocktake correction)" },
  { value: "receipt", label: "Recibido (PO received)" },
  { value: "sample", label: "Muestra (sample/photo use)" },
  { value: "other", label: "Otro" },
]

export function InventoryTab() {
  const [items, setItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [showLowOnly, setShowLowOnly] = useState(false)
  const [adjustOpen, setAdjustOpen] = useState<string | null>(null)

  async function fetchInventory() {
    setLoading(true)
    try {
      const res = await fetch("/api/inventory", { cache: "no-store" })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setItems(data.materials ?? [])
    } catch (e) {
      toast.error("Failed to load inventory", {
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchInventory()
  }, [])

  const filtered = useMemo(() => {
    let list = items
    if (categoryFilter !== "all") list = list.filter((m) => m.category === categoryFilter)
    if (showLowOnly) {
      list = list.filter((m) => m.reorderLevel !== null && m.currentStockPacks <= (m.reorderLevel ?? 0))
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter((m) => m.name.toLowerCase().includes(q) || m.sku.toLowerCase().includes(q))
    }
    return list
  }, [items, search, categoryFilter, showLowOnly])

  const totalValue = items.reduce((s, m) => s + m.stockValue, 0)
  const lowStockCount = items.filter((m) => m.reorderLevel !== null && m.currentStockPacks <= (m.reorderLevel ?? 0)).length
  const trackedCount = items.filter((m) => m.isTracked).length

  async function handleAdjust(sku: string, deltaPacks: number, reason: string, notes: string) {
    try {
      const res = await fetch("/api/inventory/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ materialSku: sku, deltaPacks, reason, notes: notes || undefined }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${res.status}`)
      }
      const data = await res.json()
      toast.success(`Stock adjusted by ${deltaPacks > 0 ? "+" : ""}${deltaPacks} packs`, {
        description: `New stock: ${data.newStockPacks} packs`,
      })
      setAdjustOpen(null)
      await fetchInventory()
    } catch (e) {
      toast.error("Adjustment failed", { description: e instanceof Error ? e.message : String(e) })
    }
  }

  return (
    <div className="space-y-4">
      {/* Header with stats */}
      <Card className="border-rose-200 bg-rose-50/40 p-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Boxes className="h-5 w-5 text-rose-700" />
            <h2 className="text-lg font-semibold text-stone-800">Inventory</h2>
            <Badge variant="outline" className="text-xs">{items.length} materials</Badge>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <div className="rounded-md bg-white/70 px-3 py-1.5 border border-stone-200">
              <span className="text-stone-500">Tracked:</span>{" "}
              <span className="font-semibold text-stone-700">{trackedCount}</span>
            </div>
            <div className="rounded-md bg-amber-50 px-3 py-1.5 border border-amber-200">
              <span className="text-amber-700">Low stock:</span>{" "}
              <span className="font-semibold text-amber-800">{lowStockCount}</span>
            </div>
            <div className="rounded-md bg-emerald-50 px-3 py-1.5 border border-emerald-200">
              <span className="text-emerald-700">Total value:</span>{" "}
              <span className="font-semibold text-emerald-800">${Math.round(totalValue).toLocaleString("es-MX")}</span>
            </div>
          </div>
        </div>
        <p className="text-xs text-stone-600 mt-2">
          Stock = Excel baseline + UI adjustments. Use the ± button on any material to log losses,
          expirations, or manual corrections. Flowers are perishable — trust but verify.
        </p>
      </Card>

      {/* Search + filters */}
      <Card className="bg-white p-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone-400 pointer-events-none" />
            <Input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or SKU…"
              className="h-8 pl-7 text-sm"
            />
          </div>
          <div className="flex items-center gap-1">
            {["all", "flower", "foliage", "packaging"].map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors capitalize ${
                  categoryFilter === cat
                    ? "bg-rose-100 text-rose-800 border-rose-200"
                    : "bg-white text-stone-600 border-stone-200 hover:bg-stone-50"
                }`}
              >
                {cat === "all" ? "All" : cat + "s"}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowLowOnly(!showLowOnly)}
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
              showLowOnly
                ? "bg-amber-100 text-amber-800 border-amber-200"
                : "bg-white text-stone-600 border-stone-200 hover:bg-stone-50"
            }`}
          >
            ⚠ Low stock only
          </button>
        </div>
      </Card>

      {/* Inventory list */}
      <Card className="bg-white p-4">
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-14 rounded-md bg-stone-100 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-8 text-stone-500">
            <Package className="h-8 w-8 mx-auto text-stone-300 mb-2" />
            <p className="text-sm">No materials match your filters</p>
          </div>
        ) : (
          <div className="space-y-1 max-h-[600px] overflow-y-auto pr-1">
            {filtered.map((m) => (
              <InventoryRow key={m.sku} item={m} onAdjust={(sku) => setAdjustOpen(sku)} />
            ))}
          </div>
        )}
      </Card>

      {/* Adjustment dialog */}
      {adjustOpen && (
        <AdjustDialog
          sku={adjustOpen}
          itemName={items.find((m) => m.sku === adjustOpen)?.name ?? ""}
          currentStock={items.find((m) => m.sku === adjustOpen)?.currentStockPacks ?? 0}
          open={!!adjustOpen}
          onOpenChange={(o) => !o && setAdjustOpen(null)}
          onSubmit={handleAdjust}
        />
      )}
    </div>
  )
}

function InventoryRow({ item, onAdjust }: { item: InventoryItem; onAdjust: (sku: string) => void }) {
  const isLow = item.reorderLevel !== null && item.currentStockPacks <= (item.reorderLevel ?? 0)
  const isUntracked = !item.isTracked

  return (
    <div
      className={`flex items-center gap-3 rounded-md border p-2.5 text-sm transition-colors ${
        isLow ? "border-amber-300 bg-amber-50/40" : isUntracked ? "border-stone-200 bg-stone-50/30" : "border-stone-200 bg-white hover:bg-stone-50"
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="font-medium text-stone-800 truncate">{item.name}</div>
        <div className="flex items-center gap-1.5 text-[10px] text-stone-500 flex-wrap">
          <span className="capitalize">{item.category}</span>
          <span>· {item.sku}</span>
          {item.supplier && <span>· {item.supplier}</span>}
          {item.packPrice != null && <span>· ${item.packPrice}/pack</span>}
        </div>
      </div>

      {/* Stock info */}
      <div className="text-right shrink-0">
        {isUntracked ? (
          <div className="text-xs text-stone-400">Not tracked</div>
        ) : (
          <>
            <div className={`font-semibold ${isLow ? "text-amber-700" : "text-stone-800"}`}>
              {item.currentStockPacks} <span className="text-xs font-normal text-stone-500">packs</span>
            </div>
            {item.reorderLevel != null && (
              <div className="text-[10px] text-stone-400">reorder @ {item.reorderLevel}</div>
            )}
            {item.adjustmentPacks !== 0 && (
              <div className="text-[10px] text-blue-500">
                {item.adjustmentPacks > 0 ? "+" : ""}{item.adjustmentPacks} adjusted
              </div>
            )}
          </>
        )}
      </div>

      {/* Stock value */}
      {!isUntracked && (
        <div className="text-right shrink-0 w-20">
          <div className="text-xs font-medium text-stone-700">
            ${Math.round(item.stockValue).toLocaleString("es-MX")}
          </div>
        </div>
      )}

      {/* Adjust button */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => onAdjust(item.sku)}
        className="shrink-0 h-7 px-2 text-xs gap-1"
      >
        ± Adjust
      </Button>
    </div>
  )
}

function AdjustDialog({
  sku,
  itemName,
  currentStock,
  open,
  onOpenChange,
  onSubmit,
}: {
  sku: string
  itemName: string
  currentStock: number
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (sku: string, delta: number, reason: string, notes: string) => void
}) {
  const [delta, setDelta] = useState("")
  const [reason, setReason] = useState("loss")
  const [notes, setNotes] = useState("")

  function handleSubmit() {
    const deltaNum = parseFloat(delta)
    if (isNaN(deltaNum) || deltaNum === 0) {
      toast.error("Enter a non-zero number of packs")
      return
    }
    onSubmit(sku, deltaNum, reason, notes)
    setDelta("")
    setReason("loss")
    setNotes("")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adjust stock</DialogTitle>
          <DialogDescription>
            {itemName} · Current: {currentStock} packs
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="delta" className="text-xs">
              Change in packs (use − for losses, + for receipts)
            </Label>
            <Input
              id="delta"
              type="number"
              value={delta}
              onChange={(e) => setDelta(e.target.value)}
              placeholder="e.g. -2 for 2 lost packs"
              autoFocus
            />
          </div>
          <div>
            <Label className="text-xs">Reason</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="notes" className="text-xs">Notes (optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="e.g. Stems broken in transit"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} className="bg-rose-600 hover:bg-rose-700 text-white gap-1.5">
            <TrendingDown className="h-4 w-4" />
            Apply adjustment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
