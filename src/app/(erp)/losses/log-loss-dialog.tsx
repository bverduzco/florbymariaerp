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

const REASONS = [
  { value: "damaged", label: "🔧 Damaged (dropped, crushed)" },
  { value: "spoiled", label: "🥀 Spoiled (wilted, too warm)" },
  { value: "broken", label: "💔 Broken (hardgoods)" },
  { value: "expired", label: "⏰ Expired (past vase life)" },
  { value: "lost", label: "❓ Lost (misplaced)" },
  { value: "other", label: "📦 Other" },
]

type MaterialOption = {
  sku: string
  name: string
  packPrice: number | null
  currentStockPacks: number | null
}

export function LogLossDialog({ materials }: { materials: MaterialOption[] }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    materialSku: "",
    qtyLostPacks: "",
    reason: "",
    notes: "",
  })
  const router = useRouter()

  // Find selected material to show price preview
  const selected = materials.find((m) => m.sku === form.materialSku)
  const estCostImpact = selected?.packPrice
    ? selected.packPrice * (Number(form.qtyLostPacks) || 0)
    : 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.materialSku || !form.qtyLostPacks || !form.reason) return
    setLoading(true)
    try {
      const res = await fetch("/api/losses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed")
      const data = await res.json()
      toast.success("Loss logged", {
        description: `${data.loss?.lossNumber} — ${form.qtyLostPacks} pack(s) of ${selected?.name ?? form.materialSku}`,
      })
      setOpen(false)
      setForm({ materialSku: "", qtyLostPacks: "", reason: "", notes: "" })
      router.refresh()
    } catch (e) {
      toast.error("Failed to log loss", { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="px-4 py-2 text-sm font-medium bg-stone-900 text-white rounded-md hover:bg-stone-800 transition">
          + Log Loss
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Log a Loss</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>Material *</Label>
            <Select value={form.materialSku} onValueChange={(v) => setForm({ ...form, materialSku: v })} required>
              <SelectTrigger><SelectValue placeholder="Select material..." /></SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {materials.length === 0 ? (
                  <SelectItem value="_none" disabled>No materials with stock — nothing to lose</SelectItem>
                ) : (
                  materials.map((m) => (
                    <SelectItem key={m.sku} value={m.sku}>
                      {m.name} — {m.currentStockPacks ?? 0} packs · ${m.packPrice ?? 0}/pack
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="qtyLostPacks">Qty lost (packs) *</Label>
              <Input
                id="qtyLostPacks"
                type="number"
                step="0.5"
                min="0.5"
                value={form.qtyLostPacks}
                onChange={(e) => setForm({ ...form, qtyLostPacks: e.target.value })}
                placeholder="e.g. 1"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Reason *</Label>
              <Select value={form.reason} onValueChange={(v) => setForm({ ...form, reason: v })} required>
                <SelectTrigger><SelectValue placeholder="Select reason..." /></SelectTrigger>
                <SelectContent>
                  {REASONS.map((r) => (<SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {selected && Number(form.qtyLostPacks) > 0 && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-800">
              <div className="text-xs uppercase tracking-wider">Estimated cost impact</div>
              <div className="text-lg font-bold">
                -${estCostImpact.toLocaleString("es-MX", { maximumFractionDigits: 2 })} MXN
              </div>
              <div className="text-xs mt-1">
                {form.qtyLostPacks} pack(s) × ${selected.packPrice ?? 0}/pack
              </div>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="What happened? Where was it discovered?"
              rows={2}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={loading || !form.materialSku || !form.qtyLostPacks || !form.reason}>
              {loading ? "Logging..." : "✓ Log Loss"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
