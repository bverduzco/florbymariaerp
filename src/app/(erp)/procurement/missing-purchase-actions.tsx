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

/**
 * MissingPurchaseActions — renders action buttons for each missing purchase log entry.
 *
 * Three actions:
 *   1. "Log Purchase" → opens an inline AdHocPurchaseDialog pre-filled with material
 *      + qty + est cost, POSTs to /api/ad-hoc-purchases with `resolveMissingPurchaseId`
 *      in the body. The API resolves the log automatically.
 *   2. "Donation" → resolves the log as a donation (materials were gifted).
 *   3. "Ignore" → resolves as ignored (miscount).
 */
export function MissingPurchaseActions({
  id,
  materialSku,
  materialName,
  qtyShort,
  estCost,
  triggerRef,
}: {
  id: string
  materialSku: string
  materialName: string
  qtyShort: number
  estCost: number
  triggerRef: string | null
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [poOpen, setPoOpen] = useState(false)
  // Ad-hoc purchase form state (pre-filled from the missing purchase log)
  const [form, setForm] = useState({
    vendor: "",
    qtyPacks: String(qtyShort) || "1",
    unitCost: estCost && qtyShort ? (estCost / qtyShort).toFixed(2) : "",
    ticketNumber: "",
    paymentMethod: "cash",
    notes: "",
  })

  const total = (Number(form.qtyPacks) || 0) * (Number(form.unitCost) || 0)

  async function submitPurchase(e: React.FormEvent) {
    e.preventDefault()
    if (!form.vendor || !form.qtyPacks || !form.unitCost) return
    setLoading(true)
    try {
      const res = await fetch("/api/ad-hoc-purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendor: form.vendor,
          materialSku,
          qtyPacks: form.qtyPacks,
          unitCost: form.unitCost,
          ticketNumber: form.ticketNumber || undefined,
          paymentMethod: form.paymentMethod,
          notes: form.notes || undefined,
          resolveMissingPurchaseId: id, // API will resolve the MissingPurchaseLog
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed")
      toast.success("Purchase logged + discrepancy resolved", {
        description: `${materialName}: ${form.qtyPacks} packs from ${form.vendor} · $${total.toFixed(0)}`,
      })
      setPoOpen(false)
      setForm({ vendor: "", qtyPacks: String(qtyShort) || "1", unitCost: estCost && qtyShort ? (estCost / qtyShort).toFixed(2) : "", ticketNumber: "", paymentMethod: "cash", notes: "" })
      router.refresh()
    } catch (e) {
      toast.error("Failed to log purchase", { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setLoading(false)
    }
  }

  async function resolveAsDonation() {
    setLoading(true)
    try {
      const res = await fetch(`/api/missing-purchase-logs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolutionType: "donation" }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed")
      toast.success("Marked as donation", {
        description: `${materialName}: ${qtyShort} packs were gifted — no cost impact.`,
      })
      router.refresh()
    } catch (e) {
      toast.error("Failed to mark as donation", {
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setLoading(false)
    }
  }

  async function resolveAsIgnored() {
    setLoading(true)
    try {
      const res = await fetch(`/api/missing-purchase-logs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolutionType: "ignored" }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed")
      toast.success("Marked as ignored", {
        description: `${materialName}: discrepancy was a miscount.`,
      })
      router.refresh()
    } catch (e) {
      toast.error("Failed to resolve", {
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ marginLeft: "auto", display: "flex", gap: "4px", alignItems: "center" }}>
      <Dialog open={poOpen} onOpenChange={setPoOpen}>
        <DialogTrigger asChild>
          <button
            type="button"
            disabled={loading}
            style={{
              padding: "3px 8px",
              fontSize: "10px",
              fontWeight: 600,
              background: "#BE185D",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            Log Purchase
          </button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[480px] max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Log Ad-hoc Purchase</DialogTitle>
          </DialogHeader>
          <div style={{ fontSize: "11px", color: "#78716C", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: "6px", padding: "6px 8px", marginBottom: "8px" }}>
            Resolving discrepancy for <strong>{materialName}</strong> ({materialSku}) — {qtyShort} packs short, est. ${estCost.toLocaleString("es-MX", { maximumFractionDigits: 0 })}.
            {triggerRef && <> Triggered by <strong>{triggerRef}</strong>.</>}
          </div>
          <form onSubmit={submitPurchase} className="space-y-3 pt-1">
            <div className="space-y-2">
              <Label>Material (locked)</Label>
              <Input value={`${materialName} · ${materialSku}`} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`mp-vendor-${id}`}>Vendor *</Label>
              <Input
                id={`mp-vendor-${id}`}
                value={form.vendor}
                onChange={(e) => setForm({ ...form, vendor: e.target.value })}
                placeholder="e.g. Mercado de Jamaica"
                required
                autoFocus
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor={`mp-qty-${id}`}>Qty (packs) *</Label>
                <Input
                  id={`mp-qty-${id}`}
                  type="number"
                  step="0.5"
                  min="0.5"
                  value={form.qtyPacks}
                  onChange={(e) => setForm({ ...form, qtyPacks: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`mp-cost-${id}`}>Unit cost ($) *</Label>
                <Input
                  id={`mp-cost-${id}`}
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.unitCost}
                  onChange={(e) => setForm({ ...form, unitCost: e.target.value })}
                  required
                />
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
                <Label htmlFor={`mp-ticket-${id}`}>Ticket / receipt #</Label>
                <Input
                  id={`mp-ticket-${id}`}
                  value={form.ticketNumber}
                  onChange={(e) => setForm({ ...form, ticketNumber: e.target.value })}
                  placeholder="Optional"
                />
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
              <Label htmlFor={`mp-notes-${id}`}>Notes</Label>
              <Textarea
                id={`mp-notes-${id}`}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
                placeholder="Optional — auto-fills the discrepancy reference if left blank"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPoOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={loading || !form.vendor || !form.unitCost}>
                {loading ? "Logging..." : "✓ Log & Resolve"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <button
        onClick={resolveAsDonation}
        disabled={loading}
        style={{
          padding: "3px 8px",
          fontSize: "10px",
          fontWeight: 600,
          background: "#047857",
          color: "#fff",
          border: "none",
          borderRadius: "4px",
          cursor: loading ? "not-allowed" : "pointer",
        }}
      >
        Donation
      </button>
      <button
        onClick={resolveAsIgnored}
        disabled={loading}
        style={{
          padding: "3px 8px",
          fontSize: "10px",
          fontWeight: 600,
          background: "#6B7280",
          color: "#fff",
          border: "none",
          borderRadius: "4px",
          cursor: loading ? "not-allowed" : "pointer",
        }}
      >
        Ignore
      </button>
    </div>
  )
}
