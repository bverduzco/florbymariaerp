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

const EVENT_TYPES = [
  { value: "wedding", label: "Wedding" },
  { value: "birthday", label: "Birthday" },
  { value: "corporate", label: "Corporate" },
  { value: "quinceanera", label: "Quinceañera" },
  { value: "anniversary", label: "Anniversary" },
  { value: "other", label: "Other" },
]

const LEAD_SOURCES = [
  { value: "instagram", label: "Instagram" },
  { value: "referral", label: "Referral" },
  { value: "walk_in", label: "Walk-in" },
  { value: "wedding_planner", label: "Wedding planner" },
  { value: "google", label: "Google" },
  { value: "other", label: "Other" },
]

export function NewQuoteDialog() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    customerName: "",
    eventType: "",
    eventDate: "",
    subtotal: "",
    leadSource: "",
    notes: "",
  })
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.customerName || !form.subtotal) return
    setLoading(true)
    try {
      const res = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: form.customerName,
          eventType: form.eventType || undefined,
          eventDate: form.eventDate || undefined,
          subtotal: Number(form.subtotal),
          leadSource: form.leadSource || undefined,
          notes: form.notes || undefined,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed")
      const data = await res.json()
      toast.success("Quote created", { description: `${data.quote.quoteNumber} — $${data.quote.total.toFixed(0)}` })
      setOpen(false)
      setForm({ customerName: "", eventType: "", eventDate: "", subtotal: "", leadSource: "", notes: "" })
      router.refresh()
    } catch (e) {
      toast.error("Failed to create quote", { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="px-4 py-2 text-sm font-medium bg-stone-900 text-white rounded-md hover:bg-stone-800 transition">
          + New Quote
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>New Quote</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="customerName">Customer name *</Label>
            <Input
              id="customerName"
              value={form.customerName}
              onChange={(e) => setForm({ ...form, customerName: e.target.value })}
              placeholder="e.g. María González"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Event type</Label>
              <Select value={form.eventType} onValueChange={(v) => setForm({ ...form, eventType: v })}>
                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map((t) => (<SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="eventDate">Event date</Label>
              <Input
                id="eventDate"
                type="date"
                value={form.eventDate}
                onChange={(e) => setForm({ ...form, eventDate: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="subtotal">Subtotal (MXN, before IVA) *</Label>
            <Input
              id="subtotal"
              type="number"
              step="0.01"
              value={form.subtotal}
              onChange={(e) => setForm({ ...form, subtotal: e.target.value })}
              placeholder="e.g. 3500"
              required
            />
            <p className="text-xs text-stone-500">IVA (16%) and total are calculated automatically.</p>
          </div>
          <div className="space-y-2">
            <Label>Lead source</Label>
            <Select value={form.leadSource} onValueChange={(v) => setForm({ ...form, leadSource: v })}>
              <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
              <SelectContent>
                {LEAD_SOURCES.map((s) => (<SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="What does the customer want?"
              rows={2}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={loading || !form.customerName || !form.subtotal}>
              {loading ? "Creating..." : "✓ Create Quote"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
