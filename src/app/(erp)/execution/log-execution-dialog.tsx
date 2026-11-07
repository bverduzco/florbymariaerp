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
  SelectGroup,
  SelectItem,
  SelectLabel,
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
  materialSku: string
  materialName: string
  componentName: string
  qty: number
  unit: string
  unitCost: number
  lineCost: number
  color: string | null
}

type LineItemBase = {
  id: string
  productSku: string
  productName: string
  qty: number
}

type EventOption = {
  id: string
  eventNumber: string
  name: string
  eventDate: string | null
  lineItems: Array<LineItemBase & { lineKey: string }>
}

type OrderOption = {
  id: string
  orderNumber: string
  status: string
  deliveryDate: string | null
  customer: { name: string } | null
  lineItems: Array<LineItemBase>
}

// ───────────────────────────────────────────────────────────────────────────
// Internal line shape (editable)
// ───────────────────────────────────────────────────────────────────────────
type LineSource = "inventory" | "donation" | "loan"

type EditLine = {
  key: string
  materialSku: string
  materialName: string
  qtyUsed: number
  unit: string
  unitCost: number
  lineCost: number
  type: "recipe" | "addition" | "substitution" | "removal"
  source: LineSource
  originalMaterialSku?: string
  originalQty?: number
  notes?: string
}

const LINE_SOURCES = [
  { value: "inventory", label: "📦 Inventory" },
  { value: "donation", label: "🎁 Donation" },
  { value: "loan", label: "🔄 Loan" },
]

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

// Combined job option format: `order:<id>` or `event:<id>`
function jobKey(type: "order" | "event", id: string) {
  return `${type}:${id}`
}

// ───────────────────────────────────────────────────────────────────────────
// Dialog
// ───────────────────────────────────────────────────────────────────────────
export function LogExecutionDialog({
  events,
  pendingOrders,
  materials,
  recipeLinesByProduct,
}: {
  events: EventOption[]
  pendingOrders: OrderOption[]
  materials: Material[]
  recipeLinesByProduct: Record<string, RecipeLine[]>
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const today = new Date().toISOString().slice(0, 10)

  const [jobSelection, setJobSelection] = useState<string>("_none") // _none | order:<id> | event:<id>
  const [executedAt, setExecutedAt] = useState(today)
  const [executedBy, setExecutedBy] = useState("Maria")
  const [status, setStatus] = useState("executed")
  const [quotedPrice, setQuotedPrice] = useState("")
  const [notes, setNotes] = useState("")
  const [lines, setLines] = useState<EditLine[]>([])

  // Resolve the selected job to its source object (for context bar)
  const selectedJob = useMemo(() => {
    if (jobSelection === "_none") return null
    const [type, id] = jobSelection.split(":")
    if (type === "order") {
      const o = pendingOrders.find((x) => x.id === id)
      return o
        ? { kind: "order" as const, label: o.orderNumber, sub: o.customer?.name ?? "—", date: o.deliveryDate, lineItems: o.lineItems, orderStatus: o.status }
        : null
    }
    if (type === "event") {
      const e = events.find((x) => x.id === id)
      return e
        ? { kind: "event" as const, label: e.eventNumber, sub: e.name, date: e.eventDate, lineItems: e.lineItems, orderStatus: null }
        : null
    }
    return null
  }, [jobSelection, pendingOrders, events])

  // When job changes, prefill lines from each line item × its recipe
  function handleJobChange(value: string) {
    setJobSelection(value)
    if (value === "_none") {
      setLines([])
      return
    }
    const [type, id] = value.split(":")
    let lineItems: LineItemBase[] = []
    let prefix = ""
    if (type === "order") {
      const o = pendingOrders.find((x) => x.id === id)
      if (!o) return setLines([])
      lineItems = o.lineItems
      prefix = o.orderNumber
    } else if (type === "event") {
      const e = events.find((x) => x.id === id)
      if (!e) return setLines([])
      lineItems = e.lineItems
      prefix = e.eventNumber
    }

    const newLines: EditLine[] = []
    lineItems.forEach((li, idx) => {
      const recipe = recipeLinesByProduct[li.productSku] || []
      recipe.forEach((rl) => {
        const qtyUsed = Number((rl.qty * li.qty).toFixed(2))
        newLines.push({
          key: `${prefix}|${idx + 1}|${rl.materialSku}|${rl.color ?? ""}`,
          materialSku: rl.materialSku,
          materialName: rl.componentName,
          qtyUsed,
          unit: rl.unit,
          unitCost: rl.unitCost,
          lineCost: Number((qtyUsed * rl.unitCost).toFixed(2)),
          type: "recipe",
          source: "inventory",
        })
      })
    })
    setLines(newLines)
  }

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
        source: "inventory",
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
        if (patch.materialSku && patch.materialSku !== l.materialSku) {
          const mat = materials.find((m) => m.sku === patch.materialSku)
          if (mat) {
            next.materialName = mat.name
            next.unit = mat.unit
            next.unitCost = mat.unitCost ?? 0
          }
        }
        next.lineCost = Number((next.qtyUsed * next.unitCost).toFixed(2))
        return next
      })
    )
  }

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
      // Resolve orderId/eventId from jobSelection
      let orderId: string | null = null
      let eventId: string | null = null
      if (jobSelection !== "_none") {
        const [type, id] = jobSelection.split(":")
        if (type === "order") orderId = id
        else if (type === "event") eventId = id
      }
      const payload = {
        eventId,
        orderId,
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
          source: l.source,
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

      // Bug fix: display stock discrepancy warnings if any were returned
      if (data.warnings && data.warnings.length > 0) {
        data.warnings.forEach((w: string) => {
          toast.warning("⚠ Stock discrepancy", {
            description: w,
            duration: 8000,
          })
        })
        toast.info("Check Procurement tab", {
          description: "Missing purchase logs have been created for the items above.",
          duration: 8000,
        })
      }

      setOpen(false)
      setJobSelection("_none")
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

  const hasPendingJobs = pendingOrders.length > 0 || events.length > 0

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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Linked job (optional)</Label>
              <Select value={jobSelection} onValueChange={handleJobChange}>
                <SelectTrigger>
                  <SelectValue placeholder="No job — manual log" />
                </SelectTrigger>
                <SelectContent className="max-h-[320px]">
                  <SelectItem value="_none">— No job — manual log</SelectItem>
                  {pendingOrders.length > 0 && (
                    <SelectGroup>
                      <SelectLabel className="text-xs uppercase tracking-wider text-stone-500">
                        🛒 Orders pending execution ({pendingOrders.length})
                      </SelectLabel>
                      {pendingOrders.map((o) => (
                        <SelectItem key={o.id} value={jobKey("order", o.id)}>
                          {o.orderNumber} · {o.customer?.name ?? "—"}
                          {o.deliveryDate &&
                            ` · ${new Date(o.deliveryDate).toLocaleDateString("es-MX", { day: "2-digit", month: "short" })}`}
                          {" "}({o.lineItems.length} item{o.lineItems.length !== 1 ? "s" : ""})
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                  {events.length > 0 && (
                    <SelectGroup>
                      <SelectLabel className="text-xs uppercase tracking-wider text-stone-500">
                        🎉 Events with line items ({events.length})
                      </SelectLabel>
                      {events.map((e) => (
                        <SelectItem key={e.id} value={jobKey("event", e.id)}>
                          {e.eventNumber} · {e.name}
                          {e.eventDate &&
                            ` · ${new Date(e.eventDate).toLocaleDateString("es-MX", { day: "2-digit", month: "short" })}`}
                          {" "}({e.lineItems.length} item{e.lineItems.length !== 1 ? "s" : ""})
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                  {!hasPendingJobs && (
                    <SelectItem value="_empty" disabled>
                      No pending jobs — pick materials manually below
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
              <div className="text-[10px] text-stone-500">
                Pick a paid order or scheduled event to auto-fill material
                lines from its recipe. Leave blank for one-off demos / samples.
              </div>
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

          {/* ── Job context bar ─────────────────────────────────── */}
          {selectedJob && (
            <div
              className={`p-3 border rounded-md text-xs ${
                selectedJob.kind === "order"
                  ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                  : "bg-rose-50 border-rose-200 text-rose-900"
              }`}
            >
              <div className="flex items-center gap-2 font-semibold">
                <span>{selectedJob.kind === "order" ? "🛒" : "🎉"}</span>
                <span>{selectedJob.label}</span>
                <span className="opacity-60">·</span>
                <span>{selectedJob.sub}</span>
                {selectedJob.date && (
                  <>
                    <span className="opacity-60">·</span>
                    <span>
                      {new Date(selectedJob.date).toLocaleDateString("es-MX", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </>
                )}
                {selectedJob.orderStatus && (
                  <span className="ml-1 px-1.5 py-0.5 bg-white/60 rounded text-[10px] uppercase tracking-wider">
                    {selectedJob.orderStatus}
                  </span>
                )}
              </div>
              <div className="mt-1">
                {selectedJob.lineItems.length} product line(s) →{" "}
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
                {selectedJob && selectedJob.lineItems.length > 0 ? (
                  <>
                    <div className="font-medium text-stone-700 mb-1">
                      No recipe lines found for this job&apos;s products.
                    </div>
                    Click <b>+ Add line</b> to record each material you actually used.
                  </>
                ) : hasPendingJobs ? (
                  <>
                    Pick a job above to prefill from recipes, or click{" "}
                    <b>+ Add line</b> for a one-off material pull.
                  </>
                ) : (
                  <>
                    Click <b>+ Add line</b> to log a one-off material pull.
                  </>
                )}
              </div>
            ) : (
              <>
              {/* ── Desktop: table view ──────────────────────────── */}
              <div className="hidden sm:block border border-stone-200 rounded-md overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-stone-50 text-stone-600">
                    <tr>
                      <th className="text-left px-2 py-2 font-medium">Material</th>
                      <th className="text-right px-2 py-2 font-medium w-16">Qty</th>
                      <th className="text-left px-2 py-2 font-medium w-20">Unit</th>
                      <th className="text-right px-2 py-2 font-medium w-20">Cost/u</th>
                      <th className="text-right px-2 py-2 font-medium w-20">Line $</th>
                      <th className="text-left px-2 py-2 font-medium w-28">Type</th>
                      <th className="text-left px-2 py-2 font-medium w-28">Source</th>
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
                        <td className="px-1 py-1">
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
                            className="h-8 text-xs text-right px-1"
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
                        <td className="px-2 py-1">
                          <Select
                            value={l.source}
                            onValueChange={(v) =>
                              updateLine(l.key, { source: v as LineSource })
                            }
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {LINE_SOURCES.map((s) => (
                                <SelectItem key={s.value} value={s.value}>
                                  {s.label}
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

              {/* ── Mobile: stacked card view ───────────────────── */}
              <div className="sm:hidden space-y-2">
                {lines.map((l) => (
                  <div key={l.key} className="border border-stone-200 rounded-lg p-3 bg-stone-50">
                    {/* Material picker */}
                    <Select
                      value={l.materialSku}
                      onValueChange={(v) => updateLine(l.key, { materialSku: v })}
                    >
                      <SelectTrigger className="h-9 text-xs">
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
                    {/* Qty × unit cost = line cost */}
                    <div className="flex items-center gap-2 mt-2">
                      <Input
                        type="number"
                        step="0.5"
                        min="0"
                        value={l.qtyUsed}
                        onChange={(e) => updateLine(l.key, { qtyUsed: Number(e.target.value) })}
                        className="h-8 text-xs text-right px-1 w-16"
                        placeholder="Qty"
                      />
                      <span className="text-xs text-stone-500">×</span>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={l.unitCost}
                        onChange={(e) => updateLine(l.key, { unitCost: Number(e.target.value) })}
                        className="h-8 text-xs text-right px-1 flex-1"
                        placeholder="Cost/u"
                      />
                      <span className="text-xs text-stone-500">{l.unit}</span>
                    </div>
                    {/* Line total + type + source + remove */}
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-stone-200 gap-2">
                      <div className="flex items-center gap-2">
                        <Select
                          value={l.type}
                          onValueChange={(v) => updateLine(l.key, { type: v as EditLine["type"] })}
                        >
                          <SelectTrigger className="h-7 text-[10px] w-auto min-w-[90px]">
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
                        <Select
                          value={l.source}
                          onValueChange={(v) => updateLine(l.key, { source: v as LineSource })}
                        >
                          <SelectTrigger className="h-7 text-[10px] w-auto min-w-[90px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {LINE_SOURCES.map((s) => (
                              <SelectItem key={s.value} value={s.value}>
                                {s.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold tabular-nums">
                          ${l.lineCost.toFixed(2)}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeLine(l.key)}
                          className="text-stone-400 hover:text-red-600 transition text-sm"
                          title="Remove line"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              </>
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
