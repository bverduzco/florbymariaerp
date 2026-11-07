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

const UNIT_OPTIONS = [
  { value: "stem", label: "stems" },
  { value: "pack", label: "packs" },
  { value: "piece", label: "pieces" },
  { value: "meter", label: "meters" },
  { value: "wrap", label: "wraps" },
]

type MaterialOption = {
  sku: string
  name: string
  packPrice: number | null
  currentStockPacks: number | null
  unitsPerPack: number | null
  unit: string | null
}

export function LogLossDialog({ materials }: { materials: MaterialOption[] }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    materialSku: "",
    qtyLost: "",
    unit: "",
    reason: "",
    notes: "",
  })
  const router = useRouter()

  // Find selected material
  const selected = materials.find((m) => m.sku === form.materialSku)

  // Default the unit to the material's native unit when material changes
  function handleMaterialChange(sku: string) {
    const mat = materials.find((m) => m.sku === sku)
    const defaultUnit = mat?.unit || "pack"
    setForm({ ...form, materialSku: sku, unit: defaultUnit })
  }

  // Compute cost preview
  const qtyNum = Number(form.qtyLost) || 0
  const upp = selected?.unitsPerPack && selected.unitsPerPack > 0 ? selected.unitsPerPack : 1
  const perUnitCost = form.unit === "pack"
    ? (selected?.packPrice ?? 0)
    : (selected?.packPrice ?? 0) / upp
  const estCostImpact = qtyNum * perUnitCost

  // Compute equivalent packs for display
  const packsEquivalent = form.unit === "pack"
    ? qtyNum
    : qtyNum / upp

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.materialSku || !form.qtyLost || !form.reason || !form.unit) return
    setLoading(true)
    try {
      const res = await fetch("/api/losses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          materialSku: form.materialSku,
          qtyLost: Number(form.qtyLost),
          unit: form.unit,
          reason: form.reason,
          notes: form.notes || undefined,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed")
      const data = await res.json()

      // Show success toast
      toast.success("Loss logged", {
        description: `${data.loss?.lossNumber} — ${form.qtyLost} ${form.unit} of ${selected?.name ?? form.materialSku} ($${estCostImpact.toFixed(2)})`,
      })

      // Show warning if stock discrepancy
      if (data.warning) {
        toast.warning("⚠ Stock discrepancy", {
          description: data.warning,
          duration: 8000,
        })
        toast.info("Check Procurement tab", {
          description: "A missing purchase log was created.",
          duration: 8000,
        })
      }

      setOpen(false)
      setForm({ materialSku: "", qtyLost: "", unit: "", reason: "", notes: "" })
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
            <Select value={form.materialSku} onValueChange={handleMaterialChange} required>
              <SelectTrigger><SelectValue placeholder="Select material..." /></SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {materials.length === 0 ? (
                  <SelectItem value="_none" disabled>No materials with stock — nothing to lose</SelectItem>
                ) : (
                  materials.map((m) => (
                    <SelectItem key={m.sku} value={m.sku}>
                      {m.name} — {m.currentStockPacks ?? 0} packs · ${m.packPrice ?? 0}/pack
                      {m.unitsPerPack ? ` (${m.unitsPerPack}/pack)` : ""}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Qty + Unit + Reason row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="qtyLost">Qty lost *</Label>
              <Input
                id="qtyLost"
                type="number"
                step="1"
                min="1"
                value={form.qtyLost}
                onChange={(e) => setForm({ ...form, qtyLost: e.target.value })}
                placeholder="e.g. 3"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Unit *</Label>
              <Select value={form.unit} onValueChange={(v) => setForm({ ...form, unit: v })} required>
                <SelectTrigger><SelectValue placeholder="..." /></SelectTrigger>
                <SelectContent>
                  {UNIT_OPTIONS.map((u) => (
                    <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Reason *</Label>
              <Select value={form.reason} onValueChange={(v) => setForm({ ...form, reason: v })} required>
                <SelectTrigger><SelectValue placeholder="..." /></SelectTrigger>
                <SelectContent>
                  {REASONS.map((r) => (<SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Cost preview + packs equivalent */}
          {selected && qtyNum > 0 && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-800">
              <div className="text-xs uppercase tracking-wider">Estimated cost impact</div>
              <div className="text-lg font-bold">
                -${estCostImpact.toLocaleString("es-MX", { maximumFractionDigits: 2 })} MXN
              </div>
              <div className="text-xs mt-1">
                {qtyNum} {form.unit} × ${perUnitCost.toFixed(2)}/{form.unit === "pack" ? "pack" : "stem"}
                {form.unit !== "pack" && (
                  <> · {packsEquivalent.toFixed(2)} packs deducted from stock</>
                )}
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
            <Button type="submit" disabled={loading || !form.materialSku || !form.qtyLost || !form.reason || !form.unit}>
              {loading ? "Logging..." : "✓ Log Loss"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
