"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { useState } from "react"
import { useRouter } from "next/navigation"

type MaterialOption = {
  id: string
  sku: string
  name: string
  unitCost: number
}

export function AddIngredientDialog({
  productId,
  materials,
}: {
  productId: string
  materials: MaterialOption[]
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    materialId: "",
    qty: "1",
    color: "",
    notes: "",
  })
  const router = useRouter()

  const selected = materials.find((m) => m.id === form.materialId)
  const lineCost = selected && form.qty ? selected.unitCost * Number(form.qty) : 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.materialId || !form.qty) return
    setLoading(true)
    try {
      const res = await fetch("/api/recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          materialId: form.materialId,
          qty: Number(form.qty),
          color: form.color || undefined,
          notes: form.notes || undefined,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? "Failed")
      }
      toast.success("Ingredient added", {
        description: `${selected?.name ?? "Material"} × ${form.qty}`,
      })
      setOpen(false)
      setForm({ materialId: "", qty: "1", color: "", notes: "" })
      router.refresh()
    } catch (e) {
      toast.error("Failed to add ingredient", {
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="text-xs text-stone-500 hover:text-stone-900 underline">
          + Add ingredient
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Add Ingredient to Recipe</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>Material *</Label>
            <Select value={form.materialId} onValueChange={(v) => setForm({ ...form, materialId: v })} required>
              <SelectTrigger><SelectValue placeholder="Select material..." /></SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {materials.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name} ({m.sku}) — ${m.unitCost?.toFixed(2) ?? "?"}/stem
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="qty">Quantity *</Label>
              <Input
                id="qty"
                type="number"
                min="0.5"
                step="0.5"
                value={form.qty}
                onChange={(e) => setForm({ ...form, qty: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="color">Color</Label>
              <Input
                id="color"
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
                placeholder="e.g. Pink"
              />
            </div>
          </div>
          {selected && Number(form.qty) > 0 && (
            <div className="p-3 bg-violet-50 border border-violet-200 rounded-md text-sm text-violet-800">
              <div className="text-xs uppercase tracking-wider">Line cost</div>
              <div className="text-lg font-bold">
                ${lineCost.toFixed(2)} MXN
              </div>
              <div className="text-xs mt-1">
                {form.qty} × ${selected.unitCost?.toFixed(2) ?? "?"} / stem
              </div>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Input
              id="notes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="e.g. Main peach roses"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={loading || !form.materialId || !form.qty}>
              {loading ? "Adding..." : "✓ Add Ingredient"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
