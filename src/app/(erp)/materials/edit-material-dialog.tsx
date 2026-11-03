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

type MaterialData = {
  id: string
  name: string
  sku: string
  category: string
  unit: string
  unitCost: number | null
  packPrice: number | null
  currentStockPacks: number | null
  supplier: string | null
  unitsPerPack: number | null
  notes: string | null
}

const CATEGORIES = [
  { value: "flower", label: "🌸 Flower" },
  { value: "foliage", label: "🌿 Foliage" },
  { value: "packaging", label: "📦 Packaging" },
  { value: "other", label: "📦 Other" },
]

const UNITS = [
  { value: "pack", label: "pack" },
  { value: "stem", label: "stem" },
  { value: "wrap", label: "wrap" },
  { value: "piece", label: "piece" },
  { value: "meter", label: "meter" },
]

export function EditMaterialDialog({ material, trigger }: { material: MaterialData; trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: material.name,
    category: material.category,
    unit: material.unit,
    unitCost: material.unitCost?.toString() ?? "",
    packPrice: material.packPrice?.toString() ?? "",
    currentStockPacks: material.currentStockPacks?.toString() ?? "",
    supplier: material.supplier ?? "",
    unitsPerPack: material.unitsPerPack?.toString() ?? "",
    notes: material.notes ?? "",
  })
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const payload = {
        name: form.name,
        category: form.category,
        unit: form.unit,
        unitCost: form.unitCost ? Number(form.unitCost) : undefined,
        packPrice: form.packPrice ? Number(form.packPrice) : undefined,
        currentStockPacks: form.currentStockPacks ? Number(form.currentStockPacks) : undefined,
        supplier: form.supplier || undefined,
        unitsPerPack: form.unitsPerPack ? Number(form.unitsPerPack) : undefined,
        notes: form.notes || undefined,
      }
      const res = await fetch(`/api/materials/${material.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed")
      toast.success("Material updated", { description: form.name })
      setOpen(false)
      router.refresh()
    } catch (e) {
      toast.error("Failed to update material", { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-[480px] max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Material</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>SKU (read-only)</Label>
            <div className="font-mono text-xs text-stone-500 px-3 py-2 border border-stone-200 rounded bg-stone-50">{material.sku}</div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="mat-name">Name *</Label>
            <Input id="mat-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="mat-unitCost">Unit cost ($)</Label>
              <Input id="mat-unitCost" type="number" step="0.01" value={form.unitCost} onChange={(e) => setForm({ ...form, unitCost: e.target.value })} placeholder="0.00" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mat-packPrice">Pack price ($)</Label>
              <Input id="mat-packPrice" type="number" step="0.01" value={form.packPrice} onChange={(e) => setForm({ ...form, packPrice: e.target.value })} placeholder="0.00" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="mat-stock">Current stock (packs)</Label>
              <Input id="mat-stock" type="number" step="0.5" value={form.currentStockPacks} onChange={(e) => setForm({ ...form, currentStockPacks: e.target.value })} placeholder="0" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mat-upp">Units per pack</Label>
              <Input id="mat-upp" type="number" step="1" value={form.unitsPerPack} onChange={(e) => setForm({ ...form, unitsPerPack: e.target.value })} placeholder="12" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="mat-supplier">Supplier</Label>
            <Input id="mat-supplier" value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} placeholder="LA FINCA" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mat-notes">Notes</Label>
            <Textarea id="mat-notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={loading || !form.name}>
              {loading ? "Saving..." : "✓ Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
