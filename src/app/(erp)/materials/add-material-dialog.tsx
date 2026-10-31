"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"

const CATEGORIES = [
  { value: "flower", label: "🌹 Flower" },
  { value: "foliage", label: "🌿 Foliage" },
  { value: "packaging", label: "📦 Packaging" },
  { value: "other", label: "📦 Other" },
]

const UNITS = [
  { value: "stem", label: "Stem" },
  { value: "pack", label: "Pack" },
  { value: "piece", label: "Piece" },
  { value: "wrap", label: "Wrap" },
  { value: "meter", label: "Meter" },
]

const SKU_PREFIXES: Record<string, string> = {
  flower: "FLR-",
  foliage: "FOL-",
  packaging: "PKG-",
  other: "",
}

type SupplierOption = { id: string; name: string }

export function AddMaterialDialog({ suppliers }: { suppliers: SupplierOption[] }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    sku: "",
    name: "",
    category: "",
    unit: "stem",
    packPrice: "",
    unitsPerPack: "",
    supplier: "",
    colors: "",
    notes: "",
  })
  const router = useRouter()

  // Auto-fill SKU prefix when category changes
  function onCategoryChange(cat: string) {
    const prefix = SKU_PREFIXES[cat] ?? ""
    const currentSkuBase = form.sku.replace(/^(FLR-|FOL-|PKG-)/, "")
    setForm({ ...form, category: cat, sku: prefix + currentSkuBase })
  }

  // Live unit cost preview
  const packPrice = Number(form.packPrice) || 0
  const unitsPerPack = Number(form.unitsPerPack) || 0
  const unitCost = packPrice > 0 && unitsPerPack > 0 ? packPrice / unitsPerPack : 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.sku || !form.name || !form.category) return
    setLoading(true)
    try {
      const res = await fetch("/api/materials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          packPrice: form.packPrice || undefined,
          unitsPerPack: form.unitsPerPack || undefined,
          supplier: form.supplier || undefined,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? "Failed")
      }
      toast.success("Material added", { description: `${form.sku} — ${form.name}` })
      setOpen(false)
      setForm({ sku: "", name: "", category: "", unit: "stem", packPrice: "", unitsPerPack: "", supplier: "", colors: "", notes: "" })
      router.refresh()
    } catch (e) {
      toast.error("Failed to add material", { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="px-4 py-2 text-sm font-medium bg-stone-900 text-white rounded-md hover:bg-stone-800 transition">
          + Add Material
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Material</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="sku">SKU *</Label>
              <Input id="sku" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="FLR-NEW-FLOWER" required className="font-mono text-xs" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Rosa Larga" required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Category *</Label>
              <Select value={form.category} onValueChange={onCategoryChange} required>
                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (<SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Unit</Label>
              <Select value={form.unit} onValueChange={(v) => setForm({ ...form, unit: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {UNITS.map((u) => (<SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="packPrice">Pack price (MXN)</Label>
              <Input id="packPrice" type="number" step="0.01" value={form.packPrice} onChange={(e) => setForm({ ...form, packPrice: e.target.value })} placeholder="e.g. 190" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="unitsPerPack">Units per pack</Label>
              <Input id="unitsPerPack" type="number" step="0.5" value={form.unitsPerPack} onChange={(e) => setForm({ ...form, unitsPerPack: e.target.value })} placeholder="e.g. 24" />
            </div>
          </div>
          {unitCost > 0 && (
            <div className="p-3 bg-violet-50 border border-violet-200 rounded-md text-sm text-violet-800">
              <div className="text-xs uppercase tracking-wider">Computed unit cost</div>
              <div className="text-lg font-bold">${unitCost.toFixed(2)} MXN / {form.unit}</div>
              <div className="text-xs mt-1">${packPrice} ÷ {unitsPerPack} units</div>
            </div>
          )}
          <div className="space-y-2">
            <Label>Preferred supplier</Label>
            <Select value={form.supplier} onValueChange={(v) => setForm({ ...form, supplier: v })}>
              <SelectTrigger><SelectValue placeholder="Select supplier (optional)..." /></SelectTrigger>
              <SelectContent>
                {suppliers.map((s) => (<SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="colors">Available colors</Label>
            <Input id="colors" value={form.colors} onChange={(e) => setForm({ ...form, colors: e.target.value })} placeholder="e.g. Red, Pink, White" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Assumed pack size? Seasonal availability?" rows={2} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={loading || !form.sku || !form.name || !form.category}>
              {loading ? "Adding..." : "✓ Add Material"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
