"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

export function AddLoanDialog() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const today = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState({
    itemName: "",
    description: "",
    owner: "",
    qty: "1",
    dateBorrowed: today,
    datePromised: "",
    notes: "",
  })
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.itemName.trim() || !form.owner.trim()) return
    setLoading(true)
    try {
      const res = await fetch("/api/loans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemName: form.itemName,
          description: form.description || undefined,
          owner: form.owner,
          qty: form.qty || 1,
          dateBorrowed: form.dateBorrowed || undefined,
          datePromised: form.datePromised || undefined,
          notes: form.notes || undefined,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed")
      const data = await res.json()
      toast.success("Loan recorded", {
        description: `${data.loan?.loanNumber} — ${form.itemName} borrowed from ${form.owner}`,
      })
      setOpen(false)
      setForm({ itemName: "", description: "", owner: "", qty: "1", dateBorrowed: today, datePromised: "", notes: "" })
      router.refresh()
    } catch (e) {
      toast.error("Failed to record loan", {
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="fmd-btn primary">+ Add Loan</button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Record a Loan</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>Item name *</Label>
            <Input
              value={form.itemName}
              onChange={(e) => setForm({ ...form, itemName: e.target.value })}
              placeholder="Large glass vase"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Owner (who you borrowed from) *</Label>
            <Input
              value={form.owner}
              onChange={(e) => setForm({ ...form, owner: e.target.value })}
              placeholder="Florería González"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Description (size, color, etc.)</Label>
            <Input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Tall crystal vase, 40cm"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Quantity</Label>
              <Input
                type="number"
                value={form.qty}
                onChange={(e) => setForm({ ...form, qty: e.target.value })}
                min="1"
              />
            </div>
            <div className="space-y-2">
              <Label>Date borrowed *</Label>
              <Input
                type="date"
                value={form.dateBorrowed}
                onChange={(e) => setForm({ ...form, dateBorrowed: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Date promised</Label>
              <Input
                type="date"
                value={form.datePromised}
                onChange={(e) => setForm({ ...form, datePromised: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Return by Saturday after the wedding"
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={loading || !form.itemName.trim() || !form.owner.trim()}>
              {loading ? "Saving..." : "Record Loan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
