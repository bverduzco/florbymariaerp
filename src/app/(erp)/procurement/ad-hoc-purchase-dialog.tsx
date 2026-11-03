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

export function AdHocPurchaseDialog({ materials }: { materials: MaterialOption[] }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    vendor: "",
    materialSku: "",
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
    if (!form.vendor || !form.materialSku || !form.qtyPacks || !form.unitCost) return
    setLoading(true)
    try {
      const res = await fetch("/api/ad-hoc-purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed")
      toast.success("Ad-hoc purchase logged", {
        description: `${form.vendor} · ${selected?.name ?? form.materialSku} · $${total.toFixed(0)}`,
      })
      setOpen(false)
      setForm({ vendor: "", materialSku: "", qtyPacks: "1", unitCost: "", ticketNumber: "", paymentMethod: "cash", notes: "" })
      router.refresh()
    } catch (e) {
      toast.error("Failed to log purchase", { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
            <Input id="ah-vendor" value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} placeholder="e.g. Mercado de Jamaica" required />
          </div>
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
            <Button type="submit" disabled={loading || !form.vendor || !form.materialSku || !form.unitCost}>
              {loading ? "Logging..." : "✓ Log Purchase"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
