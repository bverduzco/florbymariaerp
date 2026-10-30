"use client"

import { useEffect, useMemo, useState } from "react"
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
  Sparkles,
  Plus,
  Minus,
  Save,
  RotateCcw,
  Loader2,
  CheckCircle2,
  Flower2,
  Leaf,
  Search,
  PlusCircle,
  User,
  ArrowDownAZ,
  DollarSign,
  Type as TypeIcon,
} from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

interface CustomMaterial {
  id: string
  name: string
  pricePerStem: number
  type: string // flower | foliage
  class: string
  source: string
}

const FLOWERS_MULTIPLIER = 2.5
const OTHER_MULTIPLIER = 2.0
const LABOR_SURCHARGE = 0.40
const IVA = 0.16

export function CustomTab() {
  const router = useRouter()
  const [materials, setMaterials] = useState<CustomMaterial[]>([])
  const [loading, setLoading] = useState(true)
  const [materialsLoadError, setMaterialsLoadError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState<"all" | "flower" | "foliage">("all")
  const [sortBy, setSortBy] = useState<"name" | "price" | "type">("name")
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [saveOpen, setSaveOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  // Save dialog form state
  const [recipeName, setRecipeName] = useState("")
  const [recipeSize, setRecipeSize] = useState<string>("")
  const [recipeDescription, setRecipeDescription] = useState("")
  const [actualPrice, setActualPrice] = useState<string>("")

  // Create Order dialog state
  const [orderOpen, setOrderOpen] = useState(false)
  const [creatingOrder, setCreatingOrder] = useState(false)
  const [customers, setCustomers] = useState<{ id: string; name: string; phone: string; address: string }[]>([])
  const [orderCustomerId, setOrderCustomerId] = useState("")
  const [orderDeliveryDate, setOrderDeliveryDate] = useState("")
  const [orderDeliveryAddress, setOrderDeliveryAddress] = useState("")
  const [orderCardMessage, setOrderCardMessage] = useState("")
  const [orderDeliveryNotes, setOrderDeliveryNotes] = useState("")
  const [orderInternalNotes, setOrderInternalNotes] = useState("")
  const [orderPrice, setOrderPrice] = useState("")

  useEffect(() => {
    fetch("/api/custom-materials", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Unable to load El Gato prices (HTTP ${response.status}).`)
        }
        return response.json()
      })
      .then((data) => {
        if (!Array.isArray(data.materials)) {
          throw new Error("The El Gato prices response was invalid.")
        }
        setMaterials(data.materials)
        setMaterialsLoadError(null)
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "Failed to load El Gato prices."
        setMaterialsLoadError(message)
        toast.error(message)
        setMaterials([])
      })
      .finally(() => setLoading(false))

    // Also load customers for the Create Order dialog
    fetch("/api/customers", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { customers: [] }))
      .then((data) => setCustomers(data.customers ?? []))
      .catch(() => {})
  }, [])

  // Filtered + sorted materials
  const filtered = useMemo(() => {
    let list = materials
    if (typeFilter !== "all") list = list.filter((m) => m.type === typeFilter)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter((m) => m.name.toLowerCase().includes(q))
    }
    // Apply sort
    const sorted = [...list]
    if (sortBy === "name") {
      // Locale-aware sort handles Spanish accents (Tulipán vs Tulipan)
      sorted.sort((a, b) =>
        a.name.localeCompare(b.name, "es", { sensitivity: "base" }),
      )
    } else if (sortBy === "price") {
      // Lowest price first; ties broken by name
      sorted.sort((a, b) => {
        const diff = a.pricePerStem - b.pricePerStem
        if (Math.abs(diff) < 0.001) {
          return a.name.localeCompare(b.name, "es", { sensitivity: "base" })
        }
        return diff
      })
    } else if (sortBy === "type") {
      // Flowers first, then foliage; ties broken by name
      sorted.sort((a, b) => {
        if (a.type !== b.type) {
          // "flower" sorts before "foliage" alphabetically
          return a.type.localeCompare(b.type)
        }
        return a.name.localeCompare(b.name, "es", { sensitivity: "base" })
      })
    }
    return sorted
  }, [materials, search, typeFilter, sortBy])

  // Selected line items (qty > 0)
  const selectedLines = useMemo(() => {
    return materials
      .filter((m) => quantities[m.id] > 0)
      .map((m) => ({
        material: m,
        qty: quantities[m.id],
        lineTotal: m.pricePerStem * quantities[m.id],
      }))
  }, [materials, quantities])

  // Cost computations using El Gato prices
  const flowersCost = selectedLines
    .filter((l) => l.material.type === "flower")
    .reduce((s, l) => s + l.lineTotal, 0)
  const otherMaterialsCost = selectedLines
    .filter((l) => l.material.type === "foliage")
    .reduce((s, l) => s + l.lineTotal, 0)
  const totalCost = flowersCost + otherMaterialsCost

  // Apply ERP pricing rules
  const subtotal = flowersCost * FLOWERS_MULTIPLIER + otherMaterialsCost * OTHER_MULTIPLIER
  const withLabor = subtotal * (1 + LABOR_SURCHARGE)
  const suggestedPrice = withLabor
  const suggestedPriceWithIva = withLabor * (1 + IVA)
  const suggestedPriceRounded = Math.round(suggestedPrice / 5) * 5

  // Cost using ERP prices (for comparison) — needs the matched ERP material's unit cost
  const erpCost = selectedLines.reduce((s, l) => {
    // Approximate: use El Gato price if no ERP match (best-effort)
    return s + l.lineTotal
  }, 0)

  const totalStems = selectedLines.reduce((s, l) => s + l.qty, 0)

  function setQty(id: string, qty: number) {
    setQuantities((prev) => {
      const next = { ...prev }
      if (qty <= 0) delete next[id]
      else next[id] = qty
      return next
    })
  }

  function resetAll() {
    setQuantities({})
  }

  async function handleSave() {
    if (!recipeName.trim()) {
      toast.error("Recipe name is required")
      return
    }
    if (selectedLines.length === 0) {
      toast.error("Add at least one material")
      return
    }

    setSaving(true)
    try {
      const res = await fetch("/api/custom-recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: recipeName.trim(),
          size: recipeSize || undefined,
          description: recipeDescription || undefined,
          actualPrice: actualPrice ? parseFloat(actualPrice) : undefined,
          lines: selectedLines.map((l) => ({
            customMaterialId: l.material.id,
            qty: l.qty,
          })),
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${res.status}`)
      }
      const data = await res.json()
      const r = data.recipe
      toast.success(`Saved "${r.name}" as recipe`, {
        description: `SKU: ${r.erpProductSku} · Suggested: $${r.suggestedPrice.toFixed(0)} · Actual: $${r.actualPrice.toFixed(0)} · Now visible in Catalogue tab`,
        duration: 8000,
      })
      // Reset form
      setRecipeName("")
      setRecipeSize("")
      setRecipeDescription("")
      setActualPrice("")
      setQuantities({})
      setSaveOpen(false)
      // Switch to Catalogue tab
      router.push("/?tab=catalogue")
    } catch (e) {
      toast.error("Failed to save recipe", {
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setSaving(false)
    }
  }

  async function handleCreateOrder() {
    if (!orderCustomerId || orderCustomerId === "_new_customer") {
      toast.error("Please select a customer")
      return
    }
    if (selectedLines.length === 0) {
      toast.error("Add at least one material")
      return
    }

    setCreatingOrder(true)
    try {
      const res = await fetch("/api/custom-recipes/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: recipeName.trim() || `Custom ${selectedLines.length} stems`,
          size: recipeSize || undefined,
          actualPrice: orderPrice ? parseFloat(orderPrice) : undefined,
          customerId: orderCustomerId,
          deliveryDate: orderDeliveryDate || undefined,
          deliveryAddress: orderDeliveryAddress || undefined,
          cardMessage: orderCardMessage || undefined,
          deliveryNotes: orderDeliveryNotes || undefined,
          internalNotes: orderInternalNotes || undefined,
          lines: selectedLines.map((l) => ({
            customMaterialId: l.material.id,
            qty: l.qty,
          })),
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${res.status}`)
      }
      const data = await res.json()
      toast.success(`Order ${data.order.orderNumber} created`, {
        description: `Custom bouquet for ${data.order.customerName} · ${data.recipe.sku} · $${data.order.actualPrice.toFixed(0)} (pre-IVA)`,
        duration: 8000,
      })
      // Reset everything
      setQuantities({})
      setRecipeName("")
      setRecipeSize("")
      setOrderCustomerId("")
      setOrderDeliveryDate("")
      setOrderDeliveryAddress("")
      setOrderCardMessage("")
      setOrderDeliveryNotes("")
      setOrderInternalNotes("")
      setOrderPrice("")
      setOrderOpen(false)
      // Switch to Orders tab
      router.push("/?tab=orders")
    } catch (e) {
      toast.error("Failed to create order", {
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setCreatingOrder(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="border-rose-200 bg-rose-50/40 p-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-rose-700" />
            <h2 className="text-lg font-semibold text-stone-800">Custom Bouquet Builder</h2>
            <Badge variant="outline" className="text-xs">
              {materials.length} flowers to choose from!
            </Badge>
          </div>
        </div>
        <p className="text-xs text-stone-600 mt-1">
          Pick materials and quantities to design a custom bouquet. When you like it,
          save it as a recipe — it&apos;ll appear in the Catalogue tab following ERP pricing rules.
          El Gato&apos;s per-stem prices are independent and do not set ERP supplier prices.
        </p>
      </Card>

      {/* Search + filters + sort */}
      <Card className="bg-white p-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone-400 pointer-events-none" />
            <Input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search El Gato materials by name…"
              className="h-8 pl-7 text-sm"
            />
          </div>
          <div className="flex items-center gap-1">
            {(["all", "flower", "foliage"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors capitalize ${
                  typeFilter === t
                    ? "bg-rose-100 text-rose-800 border-rose-200"
                    : "bg-white text-stone-600 border-stone-200 hover:bg-stone-50"
                }`}
              >
                {t === "all" ? "All" : t + "s"}
              </button>
            ))}
          </div>
          {/* Sort buttons */}
          <div className="flex items-center gap-1 border-l border-stone-200 pl-2 ml-1">
            <span className="text-[10px] uppercase tracking-wide text-stone-400 mr-1 hidden sm:inline">
              Sort
            </span>
            <button
              onClick={() => setSortBy("name")}
              title="Sort alphabetically (A → Z)"
              className={`text-xs px-2 py-1 rounded-md border transition-colors inline-flex items-center gap-1 ${
                sortBy === "name"
                  ? "bg-rose-100 text-rose-800 border-rose-200"
                  : "bg-white text-stone-600 border-stone-200 hover:bg-stone-50"
              }`}
            >
              <ArrowDownAZ className="h-3 w-3" />
              <span className="hidden sm:inline">Name</span>
            </button>
            <button
              onClick={() => setSortBy("price")}
              title="Sort by price (low → high)"
              className={`text-xs px-2 py-1 rounded-md border transition-colors inline-flex items-center gap-1 ${
                sortBy === "price"
                  ? "bg-rose-100 text-rose-800 border-rose-200"
                  : "bg-white text-stone-600 border-stone-200 hover:bg-stone-50"
              }`}
            >
              <DollarSign className="h-3 w-3" />
              <span className="hidden sm:inline">Price</span>
            </button>
            <button
              onClick={() => setSortBy("type")}
              title="Sort by type (flowers, then foliage)"
              className={`text-xs px-2 py-1 rounded-md border transition-colors inline-flex items-center gap-1 ${
                sortBy === "type"
                  ? "bg-rose-100 text-rose-800 border-rose-200"
                  : "bg-white text-stone-600 border-stone-200 hover:bg-stone-50"
              }`}
            >
              <TypeIcon className="h-3 w-3" />
              <span className="hidden sm:inline">Type</span>
            </button>
          </div>
        </div>
      </Card>

      {/* Two-column layout: materials list (left) + live preview (right, sticky) */}
      <div className="grid lg:grid-cols-[1fr_360px] gap-4">
        {/* Materials list */}
        <Card className="bg-white p-3">
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-14 rounded-md bg-stone-100 animate-pulse" />
              ))}
            </div>
          ) : materialsLoadError ? (
            <div className="text-center py-8 text-red-700">
              <p className="text-sm">{materialsLoadError}</p>
            </div>
          ) : materials.length === 0 ? (
            <div className="text-center py-8 text-stone-500">
              <Flower2 className="h-8 w-8 mx-auto text-stone-300 mb-2" />
              <p className="text-sm">No El Gato prices have been imported yet.</p>
              <p className="text-xs mt-1">Import the supplier&apos;s per-stem catalogue to build custom items.</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-stone-500">
              <Flower2 className="h-8 w-8 mx-auto text-stone-300 mb-2" />
              <p className="text-sm">No materials match your search</p>
            </div>
          ) : (
            <div className="space-y-1 max-h-[700px] overflow-y-auto pr-1">
              {filtered.map((m) => {
                const qty = quantities[m.id] ?? 0
                const isFlower = m.type === "flower"
                return (
                  <div
                    key={m.id}
                    className={`flex items-center gap-3 rounded-md border p-2.5 text-sm transition-colors ${
                      qty > 0
                        ? "border-rose-300 bg-rose-50/40"
                        : "border-stone-200 bg-white hover:bg-stone-50"
                    }`}
                  >
                    <div className="shrink-0">
                      {isFlower ? (
                        <Flower2 className="h-4 w-4 text-rose-500" />
                      ) : (
                        <Leaf className="h-4 w-4 text-emerald-600" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-stone-800 truncate">{m.name}</div>
                      <div className="flex items-center gap-1.5 text-[10px] text-stone-500 flex-wrap">
                        <span className="capitalize">{m.type}</span>
                        {m.class && <span>· {m.class}</span>}
                        <span>· ${m.pricePerStem}/stem</span>
                      </div>
                    </div>
                    <div className="flex items-center rounded-md border border-stone-200 bg-stone-50 shrink-0">
                      <button
                        onClick={() => setQty(m.id, qty - 1)}
                        className="p-1.5 hover:bg-stone-200 rounded-l-md transition-colors disabled:opacity-30"
                        disabled={qty === 0}
                        aria-label="Decrease"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <Input
                        type="number"
                        min={0}
                        value={qty || ""}
                        onChange={(e) => setQty(m.id, parseInt(e.target.value) || 0)}
                        placeholder="0"
                        className="w-12 h-7 text-center text-sm border-0 bg-transparent px-0 focus-visible:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <button
                        onClick={() => setQty(m.id, qty + 1)}
                        className="p-1.5 hover:bg-stone-200 rounded-r-md transition-colors"
                        aria-label="Increase"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                    <div className="text-right shrink-0 w-20">
                      <div className="font-semibold text-stone-900 text-sm">
                        ${(m.pricePerStem * qty).toLocaleString("es-MX")}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>

        {/* Live preview panel (sticky) */}
        <div className="lg:sticky lg:top-4 lg:self-start">
          <Card className="border-rose-300 bg-gradient-to-br from-rose-50 via-pink-50 to-amber-50 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-rose-700" />
              <h3 className="text-sm font-semibold text-stone-800">Live preview</h3>
              {selectedLines.length > 0 && (
                <Badge variant="outline" className="text-[10px] ml-auto bg-white">
                  {selectedLines.length} materials
                </Badge>
              )}
            </div>

            {selectedLines.length === 0 ? (
              <div className="rounded-md border border-dashed border-rose-200 bg-white/60 p-4 text-center">
                <p className="text-xs text-stone-500">
                  Pick materials from the list to start building.
                </p>
              </div>
            ) : (
              <>
                {/* Selected items summary */}
                <div className="space-y-1 max-h-[180px] overflow-y-auto pr-1">
                  {selectedLines.map((l) => (
                    <div
                      key={l.material.id}
                      className="flex justify-between items-center text-xs bg-white/70 rounded px-2 py-1"
                    >
                      <div className="min-w-0 flex-1 truncate">
                        <span className="text-stone-700">{l.material.name}</span>
                        <span className="text-stone-400 ml-1">×{l.qty}</span>
                      </div>
                      <div className="font-medium text-stone-800 shrink-0 ml-2">
                        ${l.lineTotal.toLocaleString("es-MX")}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Cost breakdown */}
                <div className="space-y-1 pt-2 border-t border-rose-200 text-xs">
                  <div className="flex justify-between text-stone-600">
                    <span>Flowers cost</span>
                    <span>${flowersCost.toLocaleString("es-MX")}</span>
                  </div>
                  <div className="flex justify-between text-stone-600">
                    <span>Foliage cost</span>
                    <span>${otherMaterialsCost.toLocaleString("es-MX")}</span>
                  </div>
                  <div className="flex justify-between text-stone-700 font-medium">
                    <span>Total stems</span>
                    <span>{totalStems}</span>
                  </div>
                  <div className="flex justify-between text-stone-700 font-medium">
                    <span>Total material cost</span>
                    <span>${totalCost.toLocaleString("es-MX")}</span>
                  </div>
                </div>

                {/* ERP pricing rules applied */}
                <div className="space-y-1 pt-2 border-t border-rose-200 text-xs">
                  <div className="text-[10px] uppercase tracking-wide text-stone-500">
                    ERP pricing rules
                  </div>
                  <div className="flex justify-between text-stone-600">
                    <span>Flowers ×{FLOWERS_MULTIPLIER}</span>
                    <span>${(flowersCost * FLOWERS_MULTIPLIER).toLocaleString("es-MX")}</span>
                  </div>
                  <div className="flex justify-between text-stone-600">
                    <span>Foliage ×{OTHER_MULTIPLIER}</span>
                    <span>${(otherMaterialsCost * OTHER_MULTIPLIER).toLocaleString("es-MX")}</span>
                  </div>
                  <div className="flex justify-between text-stone-600">
                    <span>+{Math.round(LABOR_SURCHARGE * 100)}% labor</span>
                    <span>+${(subtotal * LABOR_SURCHARGE).toLocaleString("es-MX")}</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-rose-100">
                    <span className="font-semibold text-stone-700">Suggested (pre-IVA)</span>
                    <span className="font-bold text-rose-700">
                      ${suggestedPriceRounded.toLocaleString("es-MX")}
                    </span>
                  </div>
                  <div className="flex justify-between text-stone-500">
                    <span>With IVA (16%)</span>
                    <span>${Math.round(suggestedPriceWithIva).toLocaleString("es-MX")}</span>
                  </div>
                </div>

                {/* Save button */}
                <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
                  <DialogTrigger asChild>
                    <Button className="w-full bg-rose-600 hover:bg-rose-700 text-white gap-1.5 mt-2">
                      <Save className="h-4 w-4" />
                      Save as Recipe
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Save as recipe</DialogTitle>
                      <DialogDescription>
                        Creates a new product in the Catalogue tab. Cost: ${totalCost.toFixed(0)} · Suggested: ${suggestedPriceRounded.toFixed(0)} (pre-IVA).
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                      <div>
                        <Label htmlFor="recipe-name" className="text-xs">Recipe name *</Label>
                        <Input
                          id="recipe-name"
                          value={recipeName}
                          onChange={(e) => setRecipeName(e.target.value)}
                          placeholder="e.g. Garden Romance"
                          autoFocus
                        />
                      </div>
                      <div>
                        <Label htmlFor="recipe-size" className="text-xs">Size (optional)</Label>
                        <Input
                          id="recipe-size"
                          value={recipeSize}
                          onChange={(e) => setRecipeSize(e.target.value)}
                          placeholder="Large, Medium, or Small"
                        />
                      </div>
                      <div>
                        <Label htmlFor="recipe-desc" className="text-xs">Description (optional)</Label>
                        <Textarea
                          id="recipe-desc"
                          value={recipeDescription}
                          onChange={(e) => setRecipeDescription(e.target.value)}
                          rows={2}
                          placeholder="Custom bouquet of seasonal flowers…"
                        />
                      </div>
                      <div>
                        <Label htmlFor="recipe-price" className="text-xs">
                          Actual price (pre-IVA) — leave blank to use suggested (${suggestedPriceRounded.toFixed(0)})
                        </Label>
                        <Input
                          id="recipe-price"
                          type="number"
                          value={actualPrice}
                          onChange={(e) => setActualPrice(e.target.value)}
                          placeholder={String(suggestedPriceRounded)}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setSaveOpen(false)} disabled={saving}>
                        Cancel
                      </Button>
                      <Button
                        onClick={handleSave}
                        disabled={saving || !recipeName.trim()}
                        className="bg-rose-600 hover:bg-rose-700 text-white gap-1.5"
                      >
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Save recipe
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                {/* Create Order button + dialog */}
                <Dialog open={orderOpen} onOpenChange={setOrderOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full border-rose-300 text-rose-700 hover:bg-rose-50 gap-1.5 mt-2">
                      <PlusCircle className="h-4 w-4" />
                      Create Order
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Create custom order</DialogTitle>
                      <DialogDescription>
                        Saves the recipe (hidden — not in Catalogue) and creates a draft order.
                        Cost: ${totalCost.toFixed(0)} · Suggested: ${suggestedPriceRounded.toFixed(0)} (pre-IVA).
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                      {/* Customer */}
                      <div>
                        <Label htmlFor="order-customer" className="text-xs">Customer *</Label>
                        <Select value={orderCustomerId} onValueChange={(v) => {
                          setOrderCustomerId(v)
                          // Auto-fill delivery address from customer
                          const c = customers.find((c) => c.id === v)
                          if (c?.address) setOrderDeliveryAddress(c.address)
                        }}>
                          <SelectTrigger id="order-customer">
                            <SelectValue placeholder="Select customer…" />
                          </SelectTrigger>
                          <SelectContent>
                            {customers.map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.name}{c.phone ? ` · ${c.phone}` : ""}
                              </SelectItem>
                            ))}
                            <SelectItem value="_new_customer">
                              ➕ New customer…
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {orderCustomerId === "_new_customer" && (
                        <NewCustomerInline
                          onCreated={(c) => {
                            setCustomers(prev => [...prev, c].sort((a, b) => a.name.localeCompare(b.name)))
                            setOrderCustomerId(c.id)
                            if (c.address) setOrderDeliveryAddress(c.address)
                          }}
                          onCancel={() => setOrderCustomerId("")}
                        />
                      )}

                      {/* Name + delivery date */}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label htmlFor="order-name" className="text-xs">Bouquet name</Label>
                          <Input
                            id="order-name"
                            value={recipeName}
                            onChange={(e) => setRecipeName(e.target.value)}
                            placeholder={`Custom ${selectedLines.length} stems`}
                          />
                        </div>
                        <div>
                          <Label htmlFor="order-date" className="text-xs">Delivery date</Label>
                          <Input
                            id="order-date"
                            type="date"
                            value={orderDeliveryDate}
                            onChange={(e) => setOrderDeliveryDate(e.target.value)}
                          />
                        </div>
                      </div>

                      {/* Delivery address */}
                      <div>
                        <Label htmlFor="order-addr" className="text-xs">Delivery address</Label>
                        <Input
                          id="order-addr"
                          value={orderDeliveryAddress}
                          onChange={(e) => setOrderDeliveryAddress(e.target.value)}
                          placeholder="Calle, número, colonia, ciudad"
                        />
                      </div>

                      {/* Card message */}
                      <div>
                        <Label htmlFor="order-card" className="text-xs text-rose-700">Card message</Label>
                        <Textarea
                          id="order-card"
                          value={orderCardMessage}
                          onChange={(e) => setOrderCardMessage(e.target.value)}
                          rows={2}
                          placeholder="Para mi amor…"
                        />
                      </div>

                      {/* Delivery + internal notes */}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label htmlFor="order-dnotes" className="text-xs">Delivery notes</Label>
                          <Textarea
                            id="order-dnotes"
                            value={orderDeliveryNotes}
                            onChange={(e) => setOrderDeliveryNotes(e.target.value)}
                            rows={2}
                            placeholder="Timbre 2 veces"
                          />
                        </div>
                        <div>
                          <Label htmlFor="order-inotes" className="text-xs text-amber-700">Internal notes</Label>
                          <Textarea
                            id="order-inotes"
                            value={orderInternalNotes}
                            onChange={(e) => setOrderInternalNotes(e.target.value)}
                            rows={2}
                            placeholder="Notas privadas"
                          />
                        </div>
                      </div>

                      {/* Price */}
                      <div>
                        <Label htmlFor="order-price" className="text-xs">
                          Actual price (pre-IVA) — leave blank to use suggested (${suggestedPriceRounded.toFixed(0)})
                        </Label>
                        <Input
                          id="order-price"
                          type="number"
                          value={orderPrice}
                          onChange={(e) => setOrderPrice(e.target.value)}
                          placeholder={String(suggestedPriceRounded)}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setOrderOpen(false)} disabled={creatingOrder}>
                        Cancel
                      </Button>
                      <Button
                        onClick={handleCreateOrder}
                        disabled={creatingOrder || !orderCustomerId}
                        className="bg-rose-600 hover:bg-rose-700 text-white gap-1.5"
                      >
                        {creatingOrder ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />}
                        Create order
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetAll}
                  className="w-full text-xs text-stone-500"
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Clear all
                </Button>
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// NewCustomerInline — inline form to add a customer on the fly
// ============================================================

interface InlineCustomer {
  id: string
  name: string
  phone: string
  email: string
  address: string
}

function NewCustomerInline({
  onCreated,
  onCancel,
}: {
  onCreated: (customer: InlineCustomer) => void
  onCancel: () => void
}) {
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [address, setAddress] = useState("")
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Name is required")
      return
    }
    setSaving(true)
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), phone, email, address }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${res.status}`)
      }
      const data = await res.json()
      toast.success(`Customer added: ${data.customer.name}`)
      onCreated(data.customer)
    } catch (e) {
      toast.error("Failed to add customer", { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-md border border-rose-200 bg-rose-50/30 p-3 space-y-2">
      <div className="text-xs font-medium text-rose-700 flex items-center gap-1">
        <User className="h-3 w-3" /> New customer
      </div>
      <Input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Name *"
        className="h-7 text-xs"
        autoFocus
      />
      <div className="grid grid-cols-2 gap-2">
        <Input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Phone / WhatsApp"
          className="h-7 text-xs"
        />
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="h-7 text-xs"
        />
      </div>
      <Input
        type="text"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        placeholder="Address"
        className="h-7 text-xs"
      />
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={handleSave} disabled={saving || !name.trim()} className="bg-rose-600 hover:bg-rose-700 text-white text-xs gap-1">
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
          Save
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel} className="text-xs">
          Cancel
        </Button>
      </div>
    </div>
  )
}
