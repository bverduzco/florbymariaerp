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
  { value: "Bouquet", label: "💐 Bouquet" },
  { value: "Arrangement", label: "🌸 Arrangement" },
  { value: "Centerpiece", label: "🏺 Centerpiece" },
  { value: "Other", label: "📦 Other" },
]

const SIZES = [
  { value: "Large", label: "Large" },
  { value: "Medium", label: "Medium" },
  { value: "Small", label: "Small" },
]

export function AddProductDialog() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    sku: "",
    name: "",
    category: "",
    size: "",
    actualPriceBeforeIva: "",
    description: "",
    cloudinaryPublicId: "",
  })
  const router = useRouter()

  // Live IVA preview
  const price = Number(form.actualPriceBeforeIva) || 0
  const priceWithIva = price * 1.16

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.sku || !form.name || !form.category) return
    setLoading(true)
    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          actualPriceBeforeIva: form.actualPriceBeforeIva || undefined,
          size: form.size || undefined,
          cloudinaryPublicId: form.cloudinaryPublicId || undefined,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? "Failed")
      }
      toast.success("Product added", { description: `${form.sku} — ${form.name}` })
      setOpen(false)
      setForm({ sku: "", name: "", category: "", size: "", actualPriceBeforeIva: "", description: "", cloudinaryPublicId: "" })
      router.refresh()
    } catch (e) {
      toast.error("Failed to add product", { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="px-4 py-2 text-sm font-medium bg-stone-900 text-white rounded-md hover:bg-stone-800 transition">
          + Add Product
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Product</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="sku">SKU *</Label>
              <Input id="sku" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="PRD-NEW-PRODUCT" required className="font-mono text-xs" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Peachy Bouquet" required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Category *</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })} required>
                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (<SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Size</Label>
              <Select value={form.size} onValueChange={(v) => setForm({ ...form, size: v })}>
                <SelectTrigger><SelectValue placeholder="Optional..." /></SelectTrigger>
                <SelectContent>
                  {SIZES.map((s) => (<SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="actualPriceBeforeIva">Actual price (before IVA, MXN)</Label>
            <Input id="actualPriceBeforeIva" type="number" step="0.01" value={form.actualPriceBeforeIva} onChange={(e) => setForm({ ...form, actualPriceBeforeIva: e.target.value })} placeholder="e.g. 925" />
          </div>
          {price > 0 && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-md text-sm text-emerald-800">
              <div className="text-xs uppercase tracking-wider">Price with IVA (16%)</div>
              <div className="text-lg font-bold">${priceWithIva.toLocaleString("es-MX", { maximumFractionDigits: 2 })} MXN</div>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="cloudinaryPublicId">Cloudinary public ID (optional)</Label>
            <Input id="cloudinaryPublicId" value={form.cloudinaryPublicId} onChange={(e) => setForm({ ...form, cloudinaryPublicId: e.target.value })} placeholder="e.g. Matilde_Ramo_Mini.png" className="font-mono text-xs" />
            <p className="text-xs text-stone-500">If set, the product photo will render automatically via Cloudinary.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description (for menu)</Label>
            <Textarea id="description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Customer-facing description..." rows={3} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={loading || !form.sku || !form.name || !form.category}>
              {loading ? "Adding..." : "✓ Add Product"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
