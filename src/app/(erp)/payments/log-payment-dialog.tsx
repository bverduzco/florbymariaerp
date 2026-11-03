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

const DIRECTIONS = [
  { value: "inbound", label: "→ In (customer pays Maria)" },
  { value: "outbound", label: "← Out (Maria pays supplier)" },
]

const INBOUND_TYPES = [
  { value: "order_full", label: "Order (full payment)" },
  { value: "event_deposit", label: "Event deposit (50%)" },
  { value: "event_final", label: "Event final balance" },
  { value: "other", label: "Other" },
]

const OUTBOUND_TYPES = [
  { value: "po", label: "Supplier PO (COD)" },
  { value: "expense", label: "Operating expense" },
  { value: "other", label: "Other" },
]

const METHODS = [
  { value: "cash", label: "Cash" },
  { value: "spei", label: "SPEI transfer" },
  { value: "transfer", label: "Bank transfer" },
  { value: "card", label: "Card" },
]

export function LogPaymentDialog() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    direction: "",
    type: "",
    linkedName: "",
    amount: "",
    method: "",
    reference: "",
    notes: "",
  })
  const router = useRouter()

  const typeOptions = form.direction === "inbound" ? INBOUND_TYPES : form.direction === "outbound" ? OUTBOUND_TYPES : []

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.direction || !form.type || !form.amount) return
    setLoading(true)
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          direction: form.direction,
          type: form.type,
          linkedName: form.linkedName || undefined,
          amount: Number(form.amount),
          method: form.method || undefined,
          reference: form.reference || undefined,
          notes: form.notes || undefined,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed")
      const data = await res.json()
      toast.success("Payment logged", { description: `${data.payment.paymentNumber} — $${data.payment.amount}` })
      setOpen(false)
      setForm({ direction: "", type: "", linkedName: "", amount: "", method: "", reference: "", notes: "" })
      router.refresh()
    } catch (e) {
      toast.error("Failed to log payment", { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="px-4 py-2 text-sm font-medium bg-stone-900 text-white rounded-md hover:bg-stone-800 transition">
          + Log Payment
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Log a Payment</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>Direction *</Label>
            <Select
              value={form.direction}
              onValueChange={(v) => setForm({ ...form, direction: v, type: "" })}
              required
            >
              <SelectTrigger><SelectValue placeholder="Select direction..." /></SelectTrigger>
              <SelectContent>
                {DIRECTIONS.map((d) => (<SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          {form.direction && (
            <div className="space-y-2">
              <Label>Type *</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })} required>
                <SelectTrigger><SelectValue placeholder="Select type..." /></SelectTrigger>
                <SelectContent>
                  {typeOptions.map((t) => (<SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="linkedName">Linked to (name)</Label>
              <Input
                id="linkedName"
                value={form.linkedName}
                onChange={(e) => setForm({ ...form, linkedName: e.target.value })}
                placeholder="Customer or supplier"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Amount (MXN) *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="e.g. 1000"
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Method</Label>
              <Select value={form.method} onValueChange={(v) => setForm({ ...form, method: v })}>
                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  {METHODS.map((m) => (<SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reference">Reference</Label>
              <Input
                id="reference"
                value={form.reference}
                onChange={(e) => setForm({ ...form, reference: e.target.value })}
                placeholder="SPEI ref, ticket #"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="e.g. Full payment for ORD-1001"
              rows={2}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={loading || !form.direction || !form.type || !form.amount}>
              {loading ? "Logging..." : "✓ Log Payment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
