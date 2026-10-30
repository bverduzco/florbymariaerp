"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"

// ───────────────────────────────────────────────────────────────────────────
// Types passed in from the server component
// ───────────────────────────────────────────────────────────────────────────
type Material = {
  sku: string
  name: string
  unit: string
  unitCost: number | null
  packPrice: number | null
  unitsPerPack: number | null
  category: string
}

type RecipeLine = {
  id: string
  productSku: string
  componentSku: string
  materialId: string
  materialSku: string // === componentSku, aliased for clarity
  materialName: string
  componentName: string
  qty: number // per product unit
  unit: string
  unitCost: number
  lineCost: number
  color: string | null
}

type EventOption = {
  id: string
  eventNumber: string
  name: string
  eventDate: string | null
  lineItems: Array<{
    id: string
    productSku: string
    productName: string
    qty: number
    lineKey: string
  }>
}

// ───────────────────────────────────────────────────────────────────────────
// Internal line shape (editable)
// ───────────────────────────────────────────────────────────────────────────
type EditLine = {
  key: string // client-side react key
  materialSku: string
  materialName: string
  qtyUsed: number
  unit: string
  unitCost: number
  lineCost: number // qtyUsed × unitCost (kept in sync)
  type: "recipe" | "addition" | "substitution" | "removal"
  originalMaterialSku?: string
  originalQty?: number
  notes?: string
}

const STATUSES = [
  { value: "executed", label: "✓ Executed" },
  { value: "partial", label: "◐ Partial" },
  { value: "planned", label: "○ Planned" },
  { value: "redone", label: "↻ Redone" },
  { value: "cancelled", label: "✗ Cancelled" },
]

const LINE_TYPES = [
  { value: "recipe", label: "📖 Recipe" },
  { value: "addition", label: "➕ Addition" },
  { value: "substitution", label: "🔄 Substitution" },
  { value: "removal", label: "➖ Removal" },
]

// ───────────────────────────────────────────────────────────────────────────
// Dialog
// ───────────────────────────────────────────────────────────────────────────
export function LogExecutionDialog({
  events,
  materials,
  recipeLinesByProduct,
}: {
  events: EventOption[]
  materials: Material[]
  recipeLinesByProduct: Record<string, RecipeLine[]> // keyed by productSku
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const today = new Date().toISOString().slice(0, 10)

  const [eventId, setEventId] = useState<string>("_none")
  const [executedAt, setExecutedAt] = useState(today)
  const [executedBy, setExecutedBy] = useState("Maria")
  const [status, setStatus] = useState("executed")
  const [quotedPrice, setQuotedPrice] = useState("")
  const [notes, setNotes] = useState("")
  const [lines, setLines] = useState<EditLine[]>([])

  // Selected event (for context bar)
  const selectedEvent = useMemo(
    () => events.find((e) => e.id === eventId),
    [events, eventId]
  )

  // When event changes, prefill lines from each event line item × its recipe
  function prefillFromEvent(evId: string) {
    setEventId(evId)
    if (evId === "_none") {
      setLines([])
      return
    }
    const ev = events.find((e) => e.id === evId)
    if (!ev) {
      setLines([])
      return
    }
    const newLines: EditLine[] = []
    ev.lineItems.forEach((li) => {
      const recipe = recipeLinesByProduct[li.productSku] || []
      recipe.forEach((rl) => {
        // qty per product × event line qty
        const qtyUsed = Number((rl.qty * li.qty).toFixed(2))
        newLines.push({
          key: `${li.lineKey}|${rl.materialSku}|${rl.color ?? ""}`,
          materialSku: rl.materialSku,
          materialName: rl.componentName,
          qtyUsed,
          unit: rl.unit,
          unitCost: rl.unitCost,
          lineCost: Number((qtyUsed * rl.unitCost).toFixed(2)),
          type: "recipe",
        })
      })
    })
    setLines(newLines)
  }

  // Add a blank addition line
  function addLine() {
    setLines((prev) => [
      ...prev,
      {
        key: `new-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        materialSku: "",
        materialName: "",
        qtyUsed: 1,
        unit: "stem",
        unitCost: 0,
        lineCost: 0,
        type: "addition",
      },
    ])
  }

  function removeLine(key: string) {
    setLines((prev) => prev.filter((l) => l.key !== key))
  }

  function updateLine(key: string, patch: Partial<EditLine>) {
    setLines((prev) =>
      prev.map((l) => {
        if (l.key !== key) return l
        const next = { ...l, ...patch }
        // When material changes, fetch its unit/unitCost from catalog
        if (patch.materialSku && patch.materialSku !== l.materialSku) {
          const mat = materials.find((m) => m.sku === patch.materialSku)
          if (mat) {
            next.materialName = mat.name
            next.unit = mat.unit
            next.unitCost = mat.unitCost ?? 0
          }
        }
        // Recompute lineCost when qty/unitCost change
        next.lineCost = Number((next.qtyUsed * next.unitCost).toFixed(2))
        return next
      })
    )
  }

  // Cost summary
  const estimatedCost = lines
    .filter((l) => l.type === "recipe" || l.type === "substitution")
    .reduce((s, l) => s + l.lineCost, 0)
  const actualCost = lines
    .filter((l) => l.type !== "removal")
    .reduce((s, l) => s + l.lineCost, 0)
  const qp = Number(quotedPrice) || 0
  const margin = qp > 0 ? qp - actualCost : 0
  const marginPct = qp > 0 ? (margin / qp) * 100 : 0

  const canSubmit =
    lines.length > 0 &&
    lines.every((l) => l.materialSku && l.qtyUsed > 0) &&
    executedAt &&
    status

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setLoading(true)
    try {
      const payload = {
        eventId: eventId !== "_none" ? eventId : null,
        executedAt,
        executedBy,
        status,
        quotedPrice: qp > 0 ? qp : null,
        notes: notes || null,
        lines: lines.map((l) => ({
          materialSku: l.materialSku,
          materialName: l.materialName,
          qtyUsed: l.qtyUsed,
          unit: l.unit,
          unitCost: l.unitCost,
          lineCost: l.lineCost,
          type: l.type,
          originalMaterialSku: l.originalMaterialSku || null,
          originalQty: l.originalQty || null,
          notes: l.notes || null,
        })),
      }
      const res = await fetch("/api/execution-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? "Failed")
      }
      const data = await res.json()
      toast.success("Execution logged", {
        description: `${data.log.executionNumber} — ${lines.length} line(s) · actual $${actualCost.toLocaleString("es-MX", { maximumFractionDigits: 2 })}`,
      })
      setOpen(false)
      // Reset form
      setEventId("_none")
      setExecutedAt(today)
      setExecutedBy("Maria")
      setStatus("executed")
      setQuotedPrice("")
      setNotes("")
      setLines([])
      router.refresh()
    } catch (e) {
      toast.error("Failed to log execution", {
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
          + Log Execution
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[820px] max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Log an Execution</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* ── Header fields ─────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Linked event (optional)</Label>
              <Select value={eventId} onValueChange={prefillFromEvent}>
                <SelectTrigger>
                  <SelectValue placeholder="No event — manual log" />
                </SelectTrigger>
                <SelectContent className="max-h-[280px]">
                  <SelectItem value="_none">— No event —</SelectItem>
                  {events.length === 0 ? (
                    <SelectItem value="_empty" disabled>
                      No events available
                    </SelectItem>
                  ) : (
                    events.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.eventNumber} · {e.name}
                        {e.eventDate &&
                          ` (${new Date(e.eventDate).toLocaleDateString("es-MX", { day: "2-digit", month: "short" })})`}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
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
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* ── Event context bar ────────────────────────────────── */}
          {selectedEvent && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-md text-xs text-rose-900">
              <div className="font-semibold">
                {selectedEvent.eventNumber} · {selectedEvent.name}
              </div>
              <div className="mt-1">
                {selectedEvent.lineItems.length} product line(s) →{" "}
                {lines.length} material line(s) prefilled from recipes
              </div>
            </div>
          )}

          {/* ── Line items table ──────────────────────────────────── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Material lines ({lines.length})</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addLine}
              >
                + Add line
              </Button>
            </div>

            {lines.length === 0 ? (
              <div className="p-4 text-center text-xs text-stone-500 border border-dashed border-stone-300 rounded-md">
                No lines yet. Either pick an event above to prefill from recipes,
                or click <b>+ Add line</b> to log a one-off material pull.
              </div>
            ) : (
              <div className="border border-stone-200 rounded-md overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-stone-50 text-stone-600">
                    <tr>
                      <th className="text-left px-2 py-2 font-medium">Material</th>
                      <th className="text-right px-2 py-2 font-medium w-16">Qty</th>
                      <th className="text-left px-2 py-2 font-medium w-20">Unit</th>
                      <th className="text-right px-2 py-2 font-medium w-20">Cost/u</th>
                      <th className="text-right px-2 py-2 font-medium w-20">Line $</th>
                      <th className="text-left px-2 py-2 font-medium w-28">Type</th>
                      <th className="px-2 py-2 w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l) => (
                      <tr key={l.key} className="border-t border-stone-100">
                        <td className="px-2 py-1">
                          <Select
                            value={l.materialSku}
                            onValueChange={(v) =>
                              updateLine(l.key, { materialSku: v })
                            }
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Pick material…" />
                            </SelectTrigger>
                            <SelectContent className="max-h-[260px]">
                              {materials.map((m) => (
                                <SelectItem key={m.sku} value={m.sku}>
                                  {m.name} · ${m.unitCost ?? 0}/{m.unit}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-2 py-1">
                          <Input
                            type="number"
                            step="0.5"
                            min="0"
                            value={l.qtyUsed}
                            onChange={(e) =>
                              updateLine(l.key, {
                                qtyUsed: Number(e.target.value),
                              })
                            }
                            className="h-8 text-xs text-right"
                          />
                        </td>
                        <td className="px-2 py-1 text-stone-600">{l.unit}</td>
                        <td className="px-2 py-1">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={l.unitCost}
                            onChange={(e) =>
                              updateLine(l.key, {
                                unitCost: Number(e.target.value),
                              })
                            }
                            className="h-8 text-xs text-right"
                          />
                        </td>
                        <td className="px-2 py-1 text-right font-semibold tabular-nums">
                          ${l.lineCost.toFixed(2)}
                        </td>
                        <td className="px-2 py-1">
                          <Select
                            value={l.type}
                            onValueChange={(v) =>
                              updateLine(l.key, { type: v as EditLine["type"] })
                            }
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {LINE_TYPES.map((t) => (
                                <SelectItem key={t.value} value={t.value}>
                                  {t.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-2 py-1 text-center">
                          <button
                            type="button"
                            onClick={() => removeLine(l.key)}
                            className="text-stone-400 hover:text-red-600 transition"
                            title="Remove line"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── Cost summary ──────────────────────────────────────── */}
          {lines.length > 0 && (
            <div className="grid grid-cols-4 gap-2">
              <div className="p-3 bg-stone-50 border border-stone-200 rounded-md text-center">
                <div className="text-[9px] uppercase tracking-wider text-stone-500">
                  Est. (recipe)
                </div>
                <div className="text-base font-bold text-stone-800">
                  ${estimatedCost.toFixed(2)}
                </div>
              </div>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-center">
                <div className="text-[9px] uppercase tracking-wider text-amber-700">
                  Actual
                </div>
                <div className="text-base font-bold text-amber-900">
                  ${actualCost.toFixed(2)}
                </div>
              </div>
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-md text-center">
                <div className="text-[9px] uppercase tracking-wider text-rose-700">
                  Quoted
                </div>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={quotedPrice}
                  onChange={(e) => setQuotedPrice(e.target.value)}
                  placeholder="0"
                  className="text-base font-bold text-rose-900 text-center border-0 bg-transparent p-0 h-auto focus-visible:ring-0"
                />
              </div>
              <div
                className={`p-3 border rounded-md text-center ${
                  margin >= 0
                    ? "bg-emerald-50 border-emerald-200"
                    : "bg-red-50 border-red-200"
                }`}
              >
                <div className="text-[9px] uppercase tracking-wider text-stone-500">
                  Margin
                </div>
                <div
                  className={`text-base font-bold ${
                    margin >= 0 ? "text-emerald-800" : "text-red-800"
                  }`}
                >
                  {margin >= 0 ? "+" : "−"}${Math.abs(margin).toFixed(2)}
                  {qp > 0 && (
                    <span className="text-xs font-normal ml-1">
                      ({marginPct.toFixed(0)}%)
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Notes ─────────────────────────────────────────────── */}
          <div className="space-y-2">
            <Label htmlFor="exe-notes">Notes</Label>
            <Textarea
              id="exe-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything worth remembering about this execution (substitutions, vendor issues, delays)…"
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !canSubmit}>
              {loading ? "Logging…" : "✓ Log Execution"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
