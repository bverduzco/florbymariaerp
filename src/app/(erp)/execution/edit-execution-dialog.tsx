"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"

type ExecutionLine = {
  id: string
  materialSku: string
  materialName: string
  qtyUsed: number
  unit: string
  unitCost: number
  lineCost: number
  type: string
  source: string
  costBasis: string
  linkedAdhocPurchaseId: string | null
  notes: string | null
  // v1.9.4: per-line color + variant (mirrors create dialog)
  color: string | null
  variant: string | null
}

type ExecutionLogData = {
  id: string
  executionNumber: string
  executedAt: string  // ISO
  executedBy: string | null
  status: string
  paymentStatus: string
  quotedPrice: number | null
  notes: string | null
  startedAt: string | null
  completedAt: string | null
  durationMinutes: number | null
  lines: ExecutionLine[]
}

const STATUSES = [
  { value: "executed", label: "✓ Executed" },
  { value: "partial", label: "◐ Partial" },
  { value: "planned", label: "○ Planned" },
  { value: "redone", label: "↻ Redone" },
  { value: "cancelled", label: "✗ Cancelled" },
]

const LINE_SOURCES = [
  { value: "inventory", label: "📦 Inventory" },
  { value: "donation", label: "🎁 Donation" },
  { value: "loan", label: "🔄 Loan" },
]

const COST_BASIS_OPTIONS = [
  { value: "list", label: "📋 List" },
  { value: "linked-purchase", label: "🔗 Linked" },
  { value: "manual", label: "✏️ Manual" },
]

/**
 * EditExecutionDialog — opens a dialog pre-filled with the execution log's
 * current values. Submits a PATCH to /api/execution-logs/[id] with the
 * updated fields. The PATCH endpoint handles stock deltas atomically.
 *
 * For the v1.9.3 Gap 2 fix: editable execution logs. Lets Maria fix
 * mistakes (wrong qty, wrong source, wrong price, etc.) without deleting
 * and recreating the log.
 */
export function EditExecutionDialog({ log }: { log: ExecutionLogData }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  // Top-level editable fields
  const [status, setStatus] = useState(log.status)
  const [executedBy, setExecutedBy] = useState(log.executedBy ?? "Maria")
  const [executedAt, setExecutedAt] = useState(log.executedAt.slice(0, 10))
  const [paymentStatus, setPaymentStatus] = useState<"paid" | "unpaid">(
    log.paymentStatus === "paid" ? "paid" : "unpaid"
  )
  const [quotedPrice, setQuotedPrice] = useState(
    log.quotedPrice !== null ? String(log.quotedPrice) : ""
  )
  const [notes, setNotes] = useState(log.notes ?? "")
  const [durationMinutes, setDurationMinutes] = useState(
    log.durationMinutes !== null ? String(log.durationMinutes) : ""
  )

  // Per-line edits — start from the log's current lines, allow editing qty/cost/source/basis
  const [lines, setLines] = useState<ExecutionLine[]>(log.lines)

  function updateLine(id: string, patch: Partial<ExecutionLine>) {
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l
        const next = { ...l, ...patch }
        // Recompute lineCost when qtyUsed or unitCost changes
        next.lineCost = Number((next.qtyUsed * next.unitCost).toFixed(2))
        return next
      })
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const qp = Number(quotedPrice)
      const dm = Number(durationMinutes)
      const payload: Record<string, unknown> = {
        status,
        executedBy,
        executedAt: new Date(executedAt).toISOString(),
        paymentStatus,
        notes: notes.trim() || null,
        lines: lines.map((l) => ({
          id: l.id,
          materialSku: l.materialSku,
          materialName: l.materialName,
          qtyUsed: l.qtyUsed,
          unit: l.unit,
          unitCost: l.unitCost,
          lineCost: l.lineCost,
          type: l.type,
          source: l.source,
          costBasis: l.costBasis,
          linkedAdhocPurchaseId: l.linkedAdhocPurchaseId,
          notes: l.notes,
          // v1.9.4: per-line color + variant (mirrors create dialog)
          color: l.color,
          variant: l.variant,
        })),
      }
      // Only include quotedPrice if changed (or always include — server handles null)
      payload.quotedPrice = quotedPrice.trim() === "" ? null : qp
      // Only include durationMinutes if non-empty
      if (durationMinutes.trim() !== "") {
        payload.durationMinutes = dm
      } else {
        payload.durationMinutes = null
      }

      const res = await fetch(`/api/execution-logs/${log.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? "Failed")
      }
      toast.success("Execution log updated", {
        description: `${log.executionNumber} — ${lines.length} line(s)`,
      })
      setOpen(false)
      router.refresh()
    } catch (e) {
      toast.error("Failed to update execution log", {
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="px-4 py-2 text-sm font-medium bg-stone-900 text-white rounded-md hover:bg-stone-800 transition">
          ✏️ Edit
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[820px] max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit {log.executionNumber}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* ── Header fields ─────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Executed at *</Label>
              <Input
                type="date"
                value={executedAt}
                onChange={(e) => setExecutedAt(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Executed by</Label>
              <Input
                value={executedBy}
                onChange={(e) => setExecutedBy(e.target.value)}
                placeholder="Maria"
              />
            </div>
            <div className="space-y-2">
              <Label>Status *</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Payment *</Label>
              <Select value={paymentStatus} onValueChange={(v) => setPaymentStatus(v as "paid" | "unpaid")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="paid">💵 Paid</SelectItem>
                  <SelectItem value="unpaid">🎁 Unpaid demo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Quoted price ($)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={quotedPrice}
                onChange={(e) => setQuotedPrice(e.target.value)}
                placeholder="Leave blank for N/A"
              />
            </div>
            <div className="space-y-2">
              <Label>Duration (min)</Label>
              <Input
                type="number"
                min="0"
                step="1"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                placeholder="e.g. 45"
              />
            </div>
          </div>

          {/* ── Line items table ──────────────────────────────────── */}
          <div className="space-y-2">
            <Label>Material lines ({lines.length})</Label>
            <div className="text-[10px] text-stone-500">
              Edit qty / unit cost / source / cost basis for each line. Stock is automatically
              adjusted to reflect the changes (refunded if qty decreases or source flips to donation/loan).
            </div>
            {lines.length === 0 ? (
              <div className="p-4 text-center text-xs text-stone-500 border border-dashed border-stone-300 rounded-md">
                No material lines.
              </div>
            ) : (
              <div className="border border-stone-200 rounded-md overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-stone-50 text-stone-600">
                    <tr>
                      <th className="text-left px-2 py-2 font-medium">Material</th>
                      <th className="text-right px-2 py-2 font-medium w-16">Qty</th>
                      <th className="text-right px-2 py-2 font-medium w-20">Cost/u</th>
                      <th className="text-right px-2 py-2 font-medium w-20">Line $</th>
                      <th className="text-left px-2 py-2 font-medium w-24">Source</th>
                      <th className="text-left px-2 py-2 font-medium w-24">Cost basis</th>
                      <th className="text-left px-2 py-2 font-medium w-24">Color</th>
                      <th className="text-left px-2 py-2 font-medium w-24">Variant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l) => (
                      <tr key={l.id} className="border-t border-stone-100">
                        <td className="px-2 py-1">
                          <div className="font-medium text-stone-800">{l.materialName}</div>
                          <div className="text-[10px] text-stone-500 font-mono">{l.materialSku}</div>
                        </td>
                        <td className="px-1 py-1">
                          <Input
                            type="number"
                            step="0.5"
                            min="0"
                            value={l.qtyUsed}
                            onChange={(e) => updateLine(l.id, { qtyUsed: Number(e.target.value) })}
                            className="h-8 text-xs text-right px-1"
                          />
                        </td>
                        <td className="px-1 py-1">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={l.unitCost}
                            onChange={(e) => updateLine(l.id, {
                              unitCost: Number(e.target.value),
                              // Editing cost on a linked-purchase line → flip to manual
                              costBasis: l.costBasis === "linked-purchase" ? "manual" : l.costBasis,
                              linkedAdhocPurchaseId: l.costBasis === "linked-purchase" ? null : l.linkedAdhocPurchaseId,
                            })}
                            disabled={l.costBasis === "linked-purchase"}
                            className="h-8 text-xs text-right"
                            style={l.costBasis === "linked-purchase" ? { background: "#F5F5F4", color: "#78716C" } : undefined}
                          />
                        </td>
                        <td className="px-2 py-1 text-right font-semibold tabular-nums">
                          ${l.lineCost.toFixed(2)}
                        </td>
                        <td className="px-1 py-1">
                          <Select
                            value={l.source}
                            onValueChange={(v) => updateLine(l.id, { source: v })}
                          >
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {LINE_SOURCES.map((s) => (
                                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-1 py-1">
                          <Select
                            value={l.costBasis}
                            onValueChange={(v) => updateLine(l.id, {
                              costBasis: v,
                              linkedAdhocPurchaseId: v === "linked-purchase" ? l.linkedAdhocPurchaseId : null,
                            })}
                          >
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {COST_BASIS_OPTIONS.map((c) => (
                                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        {/* v1.9.4: Color cell — free-text (no autocomplete in edit
                            dialog since we don't have the materials list here;
                            user types freely). Lighter styling to match create
                            dialog's neutral treatment. */}
                        <td className="px-1 py-1">
                          <input
                            type="text"
                            value={l.color ?? ""}
                            onChange={(e) => updateLine(l.id, { color: e.target.value })}
                            placeholder="—"
                            className="h-8 w-full text-xs px-1 border border-stone-200 rounded"
                            style={{ color: "#9CA3AF" }}
                          />
                        </td>
                        {/* v1.9.4: Variant cell — always free-text */}
                        <td className="px-1 py-1">
                          <input
                            type="text"
                            value={l.variant ?? ""}
                            onChange={(e) => updateLine(l.id, { variant: e.target.value })}
                            placeholder="—"
                            className="h-8 w-full text-xs px-1 border border-stone-200 rounded"
                            style={{ color: "#9CA3AF" }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── Notes ──────────────────────────────────────────────── */}
          <div className="space-y-2">
            <Label htmlFor="ed-notes">Notes</Label>
            <Textarea
              id="ed-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Optional notes"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : "✓ Save Changes"}
            </Button>
          </DialogFooter>

          {/* Live cost summary */}
          <div className="text-xs text-stone-600 border-t border-stone-200 pt-2">
            <strong>Estimated:</strong> ${lines.filter((l) => l.type === "recipe" || l.type === "substitution").reduce((s, l) => s + l.lineCost, 0).toFixed(2)} ·{" "}
            <strong>Actual:</strong> ${lines.filter((l) => l.type !== "removal").reduce((s, l) => s + l.lineCost, 0).toFixed(2)}
            {quotedPrice && Number(quotedPrice) > 0 && (
              <>
                {" "}· <strong>Margin:</strong> ${(Number(quotedPrice) - lines.filter((l) => l.type !== "removal").reduce((s, l) => s + l.lineCost, 0)).toFixed(2)}
              </>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
