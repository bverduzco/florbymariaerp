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

type MaterialOption = {
  sku: string
  name: string
  supplier: string | null
  packPrice: number | null
}

type SupplierOption = {
  id: string
  name: string
}

export function PriceListDialog({ materials, suppliers }: { materials: MaterialOption[]; suppliers: SupplierOption[] }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    materialSku: "",
    supplierName: "",
    packPrice: "",
    unitsPerPack: "",
    notes: "",
  })
  const router = useRouter()

  const selected = materials.find((m) => m.sku === form.materialSku)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.materialSku || !form.supplierName || !form.packPrice) return
    setLoading(true)
    try {
      const supplier = suppliers.find((s) => s.name === form.supplierName)
      const res = await fetch("/api/supplier-prices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          materialSku: form.materialSku,
          supplierName: form.supplierName,
          supplierId: supplier?.id,
          packPrice: Number(form.packPrice),
          unitsPerPack: form.unitsPerPack ? Number(form.unitsPerPack) : undefined,
          notes: form.notes || undefined,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed")
      toast.success("Price updated", {
        description: `${form.supplierName} → ${selected?.name ?? form.materialSku}: $${form.packPrice}`,
      })
      setOpen(false)
      setForm({ materialSku: "", supplierName: "", packPrice: "", unitsPerPack: "", notes: "" })
      router.refresh()
    } catch (e) {
      toast.error("Failed to update price", { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="px-4 py-2 text-sm font-medium bg-rose-600 text-white rounded-md hover:bg-rose-700 transition">
          + Update Price
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[520px] max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Update Supplier Price</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>Material *</Label>
            <Select value={form.materialSku} onValueChange={(v) => {
              const mat = materials.find((m) => m.sku === v)
              setForm({
                ...form,
                materialSku: v,
                supplierName: mat?.supplier ?? form.supplierName,
                packPrice: mat?.packPrice ? mat.packPrice.toString() : form.packPrice,
              })
            }}>
              <SelectTrigger><SelectValue placeholder="Select material..." /></SelectTrigger>
              <SelectContent className="max-h-[260px]">
                {materials.map((m) => (
                  <SelectItem key={m.sku} value={m.sku}>
                    {m.name} · {m.sku} · ${m.packPrice ?? 0}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Supplier *</Label>
              <Select value={form.supplierName} onValueChange={(v) => setForm({ ...form, supplierName: v })}>
                <SelectTrigger><SelectValue placeholder="Select supplier..." /></SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pl-packPrice">Pack price ($) *</Label>
              <Input id="pl-packPrice" type="number" step="0.01" min="0" value={form.packPrice} onChange={(e) => setForm({ ...form, packPrice: e.target.value })} placeholder="e.g. 135" required />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="pl-upp">Units per pack</Label>
              <Input id="pl-upp" type="number" min="1" value={form.unitsPerPack} onChange={(e) => setForm({ ...form, unitsPerPack: e.target.value })} placeholder="e.g. 12" />
            </div>
            <div className="space-y-2 flex items-end">
              {form.packPrice && form.unitsPerPack && (
                <div className="text-xs text-stone-500 pb-2">
                  ≈ ${(Number(form.packPrice) / Number(form.unitsPerPack)).toFixed(2)}/stem
                </div>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pl-notes">Notes</Label>
            <Textarea id="pl-notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="Quote reference, date received, etc." />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={loading || !form.materialSku || !form.supplierName || !form.packPrice}>
              {loading ? "Saving..." : "✓ Save Price"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
