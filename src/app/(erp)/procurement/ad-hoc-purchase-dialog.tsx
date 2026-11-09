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
  unit: string
  packPrice: number | null
}

const MATERIAL_TYPES = [
  { value: "flower", label: "🌹 Flower" },
  { value: "foliage", label: "🌿 Foliage" },
  { value: "packaging", label: "📦 Packaging" },
  { value: "other", label: "📦 Other" },
]

export function AdHocPurchaseDialog({ materials }: { materials: MaterialOption[] }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [noSku, setNoSku] = useState(false)
  const [form, setForm] = useState({
    vendor: "",
    materialSku: "",
    materialName: "",     // free-text when noSku=true
    materialType: "flower", // free-text type when noSku=true
    qtyPacks: "1",
    unitCost: "",
    ticketNumber: "",
    paymentMethod: "cash",
    notes: "",
  })
  const router = useRouter()

  const selected = materials.find((m) => m.sku === form.materialSku)
  const total = (Number(form.qtyPacks) || 0) * (Number(form.unitCost) || 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.vendor || !form.qtyPacks || !form.unitCost) return
    // When noSku is on, materialName is required. When off, materialSku is required.
    if (noSku && !form.materialName.trim()) return
    if (!noSku && !form.materialSku) return

    setLoading(true)
    try {
      const payload: Record<string, unknown> = {
        vendor: form.vendor,
        qtyPacks: form.qtyPacks,
        unitCost: form.unitCost,
        ticketNumber: form.ticketNumber || undefined,
        paymentMethod: form.paymentMethod,
        notes: form.notes || undefined,
      }
      if (noSku) {
        payload.materialSku = null
        payload.materialName = form.materialName.trim()
        payload.materialType = form.materialType
      } else {
        payload.materialSku = form.materialSku
        // materialName + materialType are denormalized by the API from Material
      }

      const res = await fetch("/api/ad-hoc-purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed")
      const displayName = noSku ? form.materialName : (selected?.name ?? form.materialSku)
      toast.success("Ad-hoc purchase logged", {
        description: `${form.vendor} · ${displayName} · $${total.toFixed(0)}`,
      })
      setOpen(false)
      setNoSku(false)
      setForm({ vendor: "", materialSku: "", materialName: "", materialType: "flower", qtyPacks: "1", unitCost: "", ticketNumber: "", paymentMethod: "cash", notes: "" })
      router.refresh()
    } catch (e) {
      toast.error("Failed to log purchase", { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setLoading(false)
    }
  }

  const canSubmit = form.vendor && form.qtyPacks && form.unitCost && (noSku ? form.materialName.trim() : form.materialSku)

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setNoSku(false) }}>
      <DialogTrigger asChild>
        <button className="px-4 py-2 text-sm font-medium bg-stone-900 text-white rounded-md hover:bg-stone-800 transition">
          + Log Ad-hoc
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[520px] max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Log Ad-hoc Purchase</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="ah-vendor">Vendor *</Label>
            <Input id="ah-vendor" value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} placeholder="e.g. Mercado de Jamaica, Costco" required />
          </div>

          {/* ─── No-SKU toggle ──────────────────────────────────── */}
          <div className="flex items-center gap-2 p-2 bg-stone-50 border border-stone-200 rounded-md">
            <input
              type="checkbox"
              id="ah-nosku"
              checked={noSku}
              onChange={(e) => {
                setNoSku(e.target.checked)
                // Clear the opposing field when toggling
                if (e.target.checked) {
                  setForm({ ...form, materialSku: "" })
                } else {
                  setForm({ ...form, materialName: "", materialType: "flower" })
                }
              }}
              className="cursor-pointer"
            />
            <Label htmlFor="ah-nosku" className="text-xs font-normal cursor-pointer text-stone-700">
              No SKU — first-time purchase (free-text item name)
            </Label>
          </div>

          {/* ─── Material picker OR free-text fields ───────────── */}
          {noSku ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="ah-name">Item name *</Label>
                <Input
                  id="ah-name"
                  value={form.materialName}
                  onChange={(e) => setForm({ ...form, materialName: e.target.value })}
                  placeholder="e.g. Costco foliage mix (eucalyptus + ruscus)"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={form.materialType} onValueChange={(v) => setForm({ ...form, materialType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MATERIAL_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-800">
                ⚠ No-SKU purchases are logged for financial records but do <strong>not</strong> bump
                inventory (since there&apos;s no Material to bump stock on). The purchase will appear in
                the Ad-hoc Purchases list and in financial reports. You can create a Material record
                later if this becomes a recurring item.
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <Label>Material *</Label>
              <Select value={form.materialSku} onValueChange={(v) => {
                const mat = materials.find((m) => m.sku === v)
                setForm({ ...form, materialSku: v, unitCost: mat?.packPrice ? mat.packPrice.toString() : form.unitCost })
              }}>
                <SelectTrigger><SelectValue placeholder="Select material..." /></SelectTrigger>
                <SelectContent className="max-h-[260px]">
                  {materials.map((m) => (
                    <SelectItem key={m.sku} value={m.sku}>
                      {m.name} · ${m.packPrice ?? 0}/{m.unit}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="ah-qty">Qty (packs) *</Label>
              <Input id="ah-qty" type="number" step="0.5" min="0.5" value={form.qtyPacks} onChange={(e) => setForm({ ...form, qtyPacks: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ah-cost">Unit cost ($) *</Label>
              <Input id="ah-cost" type="number" step="0.01" min="0" value={form.unitCost} onChange={(e) => setForm({ ...form, unitCost: e.target.value })} placeholder="e.g. 135" required />
            </div>
          </div>
          {total > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-sm">
              <span className="text-amber-700">Total:</span>{" "}
              <span className="font-bold text-amber-900">${total.toLocaleString("es-MX", { maximumFractionDigits: 2 })}</span>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="ah-ticket">Ticket / receipt #</Label>
              <Input id="ah-ticket" value={form.ticketNumber} onChange={(e) => setForm({ ...form, ticketNumber: e.target.value })} placeholder="Optional" />
            </div>
            <div className="space-y-2">
              <Label>Payment method</Label>
              <Select value={form.paymentMethod} onValueChange={(v) => setForm({ ...form, paymentMethod: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">💵 Cash</SelectItem>
                  <SelectItem value="card">💳 Card</SelectItem>
                  <SelectItem value="transfer">🏦 Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ah-notes">Notes</Label>
            <Textarea id="ah-notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="What did you buy and why?" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={loading || !canSubmit}>
              {loading ? "Logging..." : "✓ Log Purchase"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
