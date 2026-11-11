"use client"

import { useEffect, useMemo, useState } from "react"
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
  colors: string | null  // v1.9.4: comma-separated list, drives the Color autocomplete suggestions
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
type CostBasis = "list" | "linked-purchase" | "manual"

type AdhocPurchaseOption = {
  id: string
  adhocNumber: string
  vendor: string
  date: string  // ISO
  materialSku: string | null
  materialName: string
  materialType: string | null
  qtyPacks: number
  unitCost: number
  total: number
  // v1.9.4: color + variant on the ad-hoc — when linked to an execution line,
  // these flow through to the line automatically (so you don't have to re-enter
  // the color twice: once when logging the ad-hoc, once when executing).
  color: string | null
  variant: string | null
}

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
  // v1.9.3: per-line cost basis
  costBasis: CostBasis
  linkedAdhocPurchaseId?: string  // set when costBasis=linked-purchase
  // v1.9.4: per-line color + variant (free-text with autocomplete)
  color?: string
  variant?: string
}

const LINE_SOURCES = [
  { value: "inventory", label: "📦 Inventory" },
  { value: "donation", label: "🎁 Donation" },
  { value: "loan", label: "🔄 Loan" },
]

const COST_BASIS_OPTIONS = [
  { value: "list", label: "📋 List price" },
  { value: "linked-purchase", label: "🔗 Linked purchase" },
  { value: "manual", label: "✏️ Manual" },
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
  recentAdhocPurchases,
}: {
  events: EventOption[]
  pendingOrders: OrderOption[]
  materials: Material[]
  recipeLinesByProduct: Record<string, RecipeLine[]>
  recentAdhocPurchases: AdhocPurchaseOption[]
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
  const [paymentStatus, setPaymentStatus] = useState<"paid" | "unpaid">("unpaid")  // v1.9.3: auto-flips when an order is linked
  const [notes, setNotes] = useState("")
  const [lines, setLines] = useState<EditLine[]>([])

  // v1.9.3: multi-select of recent AdHocPurchases to bulk-link to recipe lines.
  // When a purchase is selected, we try to auto-match its materialSku to an
  // existing recipe line. Matched lines flip to costBasis=linked-purchase with
  // the linkedAdhocPurchaseId set + unitCost snapshotted from the purchase.
  // No-SKU purchases (materialSku=null) can't auto-match — they go to the
  // "Unmapped" section where the user manually picks which line to link to.
  const [selectedAdhocIds, setSelectedAdhocIds] = useState<Set<string>>(new Set())
  // Map adhocId → lineKey | "skip" — for unmapped items, user picks which
  // line to link to (or "skip" to leave it unlinked).
  const [manualLinks, setManualLinks] = useState<Record<string, string | "skip">>({})

  // v1.9.3: time tracking state. Three input modes:
  //   - Timer: user clicks Start → startedAt set; clicks Stop → completedAt set
  //     + durationMinutes computed. While running, a live timer displays.
  //   - Manual: user types durationMinutes directly; startedAt/completedAt stay null.
  //   - Hybrid: timer runs, then user overrides the duration field.
  const [timerStartedAt, setTimerStartedAt] = useState<Date | null>(null)
  const [timerCompletedAt, setTimerCompletedAt] = useState<Date | null>(null)
  const [timerRunning, setTimerRunning] = useState(false)
  const [durationMinutesInput, setDurationMinutesInput] = useState("")  // string for input control
  // Live elapsed time display (updates every second while running)
  const [liveElapsedSec, setLiveElapsedSec] = useState(0)

  // When the user picks a job, auto-default paymentStatus based on the link type:
  //   - Order linked → "paid" (an order is a real sale — override back to "unpaid" if it was actually a free demo)
  //   - Event linked → "unpaid" (events are typically demos)
  //   - No job (manual) → "unpaid"
  // The user can always override this manually via the dropdown.
  function handleJobChangeWithPaymentDefault(value: string) {
    handleJobChange(value)
    if (value.startsWith("order:")) {
      setPaymentStatus("paid")
    } else {
      setPaymentStatus("unpaid")
    }
  }

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
          costBasis: "list",  // v1.9.3: default — user can flip to linked-purchase or manual
          color: "",  // v1.9.4: user fills in per line
          variant: "",
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
        costBasis: "list",
        color: "",
        variant: "",
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
          // v1.9.4: clear color when material changes — different material has
          // different available colors. Keep variant (sometimes reusable, e.g.
          // "tall" vase size applies across vases; "gunnii" species doesn't
          // but the user can clear it manually if wrong).
          next.color = ""
        }
        next.lineCost = Number((next.qtyUsed * next.unitCost).toFixed(2))
        return next
      })
    )
  }

  /**
   * v1.9.3: Apply a linked AdHocPurchase to a line.
   *
   * Snapshots the purchase's `unitCost` into the line and stores the link.
   * Used when the user picks "linked-purchase" as costBasis and selects
   * a specific purchase from the dropdown.
   *
   * Note: we don't change the line's `qtyUsed` — that's the qty Maria actually
   * used in this execution. We just change where the unit cost came from.
   * The purchase's `qtyPacks` is informational only.
   */
  function linkAdhocPurchase(key: string, purchaseId: string) {
    const purchase = recentAdhocPurchases.find((p) => p.id === purchaseId)
    if (!purchase) return
    setLines((prev) =>
      prev.map((l) => {
        if (l.key !== key) return l
        const next = {
          ...l,
          linkedAdhocPurchaseId: purchaseId,
          costBasis: "linked-purchase" as const,
          unitCost: purchase.unitCost,
          // v1.9.4: inherit color + variant from the linked ad-hoc purchase.
          // Only set if the line doesn't already have a value (don't overwrite
          // a user's manual override). If line's color is empty + purchase has
          // a color, use the purchase's. Same for variant.
          color: l.color || purchase.color || "",
          variant: l.variant || purchase.variant || "",
        }
        next.lineCost = Number((next.qtyUsed * next.unitCost).toFixed(2))
        return next
      })
    )
  }

  /**
   * v1.9.3: Get the AdHocPurchases that match a line's materialSku.
   * Used to populate the "linked-purchase" dropdown when the user picks
   * that costBasis. Includes no-SKU purchases too (materialSku=null) so
   * the user can manually link them to any line.
   */
  function getMatchingPurchases(materialSku: string): AdhocPurchaseOption[] {
    return recentAdhocPurchases.filter(
      (p) => p.materialSku === materialSku || p.materialSku === null
    )
  }

  /**
   * v1.9.3: Toggle an AdHocPurchase in the multi-select.
   *
   * When a purchase is SELECTED:
   *   - Try to auto-match its materialSku to an existing recipe line.
   *   - If matched: flip that line to costBasis=linked-purchase + set
   *     linkedAdhocPurchaseId + snapshot the unitCost.
   *   - If no match (or SKU is null): leave for the manual "Unmapped" section.
   *
   * When a purchase is DESELECTED:
   *   - Find any lines linked to this purchase + revert them to list basis.
   *   - Clear the manual link if set.
   *
   * The auto-match picks the FIRST recipe line with the matching SKU that
   * isn't already linked to another purchase. If multiple lines have the
   * same SKU, only the first gets linked automatically.
   */
  function toggleAdhocPurchase(purchaseId: string) {
    const purchase = recentAdhocPurchases.find((p) => p.id === purchaseId)
    if (!purchase) return

    const isSelected = selectedAdhocIds.has(purchaseId)
    const next = new Set(selectedAdhocIds)

    if (isSelected) {
      // Deselecting — revert any lines linked to this purchase
      next.delete(purchaseId)
      setLines((prev) =>
        prev.map((l) => {
          if (l.linkedAdhocPurchaseId === purchaseId) {
            // Revert to list basis — restore material's preferred unitCost
            const mat = materials.find((m) => m.sku === l.materialSku)
            const restoredCost = mat?.unitCost ?? 0
            // v1.9.4: also revert color/variant IF they were inherited from
            // this purchase (matched exactly). If the user manually set the
            // same value, we can't tell — but that's an acceptable false
            // positive (they can re-type it).
            const inheritedColor = l.color && purchase.color && l.color === purchase.color
            const inheritedVariant = l.variant && purchase.variant && l.variant === purchase.variant
            return {
              ...l,
              costBasis: "list",
              linkedAdhocPurchaseId: undefined,
              unitCost: restoredCost,
              lineCost: Number((l.qtyUsed * restoredCost).toFixed(2)),
              color: inheritedColor ? "" : l.color,
              variant: inheritedVariant ? "" : l.variant,
            }
          }
          return l
        })
      )
      // Also clear the manual link if set
      setManualLinks((prev) => {
        const next = { ...prev }
        delete next[purchaseId]
        return next
      })
    } else {
      // Selecting — try to auto-match
      next.add(purchaseId)
      if (purchase.materialSku) {
        // Find the first recipe line with the matching SKU that isn't already linked
        setLines((prev) => {
          let matched = false
          return prev.map((l) => {
            if (matched) return l  // only match once per purchase
            if (l.materialSku === purchase.materialSku && !l.linkedAdhocPurchaseId) {
              matched = true
              return {
                ...l,
                costBasis: "linked-purchase" as CostBasis,
                linkedAdhocPurchaseId: purchaseId,
                unitCost: purchase.unitCost,
                lineCost: Number((l.qtyUsed * purchase.unitCost).toFixed(2)),
                // v1.9.4: inherit color + variant from the linked ad-hoc
                // (only if the line doesn't already have a value)
                color: l.color || purchase.color || "",
                variant: l.variant || purchase.variant || "",
              }
            }
            return l
          })
        })
      }
      // No-SKU purchases (materialSku=null) skip auto-match and go to the
      // Unmapped section. The user manually picks which line to link to.
    }

    setSelectedAdhocIds(next)
  }

  /**
   * v1.9.3: Manually link an unmapped AdHocPurchase to a specific line.
   * Used in the "Unmapped" section when auto-match couldn't find a line.
   */
  function manuallyLinkAdhoc(purchaseId: string, lineKey: string | "skip") {
    const purchase = recentAdhocPurchases.find((p) => p.id === purchaseId)
    if (!purchase) return

    setManualLinks((prev) => ({ ...prev, [purchaseId]: lineKey }))

    if (lineKey === "skip") {
      // Unlink if previously linked via manual
      setLines((prev) =>
        prev.map((l) => {
          if (l.linkedAdhocPurchaseId === purchaseId) {
            const mat = materials.find((m) => m.sku === l.materialSku)
            const restoredCost = mat?.unitCost ?? 0
            // v1.9.4: revert inherited color/variant (same logic as toggleAdhocPurchase)
            const inheritedColor = l.color && purchase.color && l.color === purchase.color
            const inheritedVariant = l.variant && purchase.variant && l.variant === purchase.variant
            return {
              ...l,
              costBasis: "list" as CostBasis,
              linkedAdhocPurchaseId: undefined,
              unitCost: restoredCost,
              lineCost: Number((l.qtyUsed * restoredCost).toFixed(2)),
              color: inheritedColor ? "" : l.color,
              variant: inheritedVariant ? "" : l.variant,
            }
          }
          return l
        })
      )
      return
    }

    // Link the chosen line to this purchase
    setLines((prev) =>
      prev.map((l) => {
        if (l.key !== lineKey) return l
        // If this line was previously linked to a different purchase, that
        // purchase will lose its link — but we don't deselect it here, the
        // user can see in the multi-select list that it's still selected.
        return {
          ...l,
          costBasis: "linked-purchase" as CostBasis,
          linkedAdhocPurchaseId: purchaseId,
          unitCost: purchase.unitCost,
          lineCost: Number((l.qtyUsed * purchase.unitCost).toFixed(2)),
          // v1.9.4: inherit color + variant from the linked ad-hoc
          color: l.color || purchase.color || "",
          variant: l.variant || purchase.variant || "",
        }
      })
    )
  }

  /**
   * v1.9.3: Compute which selected purchases are unmapped (no auto-match
   * found AND no manual link set). These appear in the "Unmapped" section.
   */
  const unmappedPurchases = Array.from(selectedAdhocIds)
    .map((id) => recentAdhocPurchases.find((p) => p.id === id))
    .filter((p): p is AdhocPurchaseOption => p !== undefined)
    .filter((p) => {
      // A purchase is "mapped" if any line has linkedAdhocPurchaseId === p.id
      const isLinked = lines.some((l) => l.linkedAdhocPurchaseId === p.id)
      // OR if the user manually set a link (even "skip" counts as resolved)
      const hasManualChoice = manualLinks[p.id] !== undefined
      return !isLinked && !hasManualChoice
    })

  // Reset ad-hoc selections when the dialog closes or job changes (fresh start)
  function resetAdhocSelections() {
    setSelectedAdhocIds(new Set())
    setManualLinks({})
  }

  // v1.9.3: timer handlers
  function startTimer() {
    setTimerStartedAt(new Date())
    setTimerCompletedAt(null)
    setTimerRunning(true)
    setLiveElapsedSec(0)
  }

  function stopTimer() {
    const now = new Date()
    setTimerCompletedAt(now)
    setTimerRunning(false)
    // Compute duration from start to now (in minutes, rounded)
    if (timerStartedAt) {
      const deltaMs = now.getTime() - timerStartedAt.getTime()
      const minutes = Math.max(1, Math.round(deltaMs / 60000))
      setDurationMinutesInput(String(minutes))
    }
  }

  function resetTimer() {
    setTimerStartedAt(null)
    setTimerCompletedAt(null)
    setTimerRunning(false)
    setLiveElapsedSec(0)
    setDurationMinutesInput("")
  }

  // Live timer effect — ticks every second while running
  useEffect(() => {
    if (!timerRunning || !timerStartedAt) return
    const tick = () => {
      const now = Date.now()
      const elapsedSec = Math.floor((now - timerStartedAt.getTime()) / 1000)
      setLiveElapsedSec(elapsedSec)
    }
    tick()  // immediate update
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [timerRunning, timerStartedAt])

  // Reset timer state on dialog close
  function resetTimeTracking() {
    setTimerStartedAt(null)
    setTimerCompletedAt(null)
    setTimerRunning(false)
    setLiveElapsedSec(0)
    setDurationMinutesInput("")
  }

  // Format seconds as "MM:SS" or "HH:MM:SS" for the live display
  function formatElapsed(totalSec: number): string {
    const hours = Math.floor(totalSec / 3600)
    const mins = Math.floor((totalSec % 3600) / 60)
    const secs = totalSec % 60
    if (hours > 0) {
      return `${hours}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
    }
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
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
        paymentStatus,
        // v1.9.3: time tracking. Send all three — server trusts durationMinutes
        // if provided, else computes from startedAt/completedAt.
        startedAt: timerStartedAt?.toISOString() ?? null,
        completedAt: timerCompletedAt?.toISOString() ?? null,
        durationMinutes: durationMinutesInput ? Number(durationMinutesInput) : null,
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
          // v1.9.3: cost basis + linked purchase
          costBasis: l.costBasis,
          linkedAdhocPurchaseId: l.linkedAdhocPurchaseId || null,
          // v1.9.4: per-line color + variant (free-text)
          color: l.color?.trim() || null,
          variant: l.variant?.trim() || null,
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
      setPaymentStatus("unpaid")
      setNotes("")
      setLines([])
      resetAdhocSelections()
      resetTimeTracking()
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
    <Dialog open={open} onOpenChange={(v) => {
      setOpen(v)
      if (!v) {
        // Reset ad-hoc selections + timer when dialog closes (fresh start next time)
        resetAdhocSelections()
        resetTimeTracking()
      }
    }}>
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
              <Select value={jobSelection} onValueChange={handleJobChangeWithPaymentDefault}>
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
            <div className="space-y-2">
              <Label>Payment *</Label>
              <Select value={paymentStatus} onValueChange={(v) => setPaymentStatus(v as "paid" | "unpaid")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="paid">💵 Paid</SelectItem>
                  <SelectItem value="unpaid">🎁 Unpaid demo</SelectItem>
                </SelectContent>
              </Select>
              <div className="text-[10px] text-stone-500">
                Auto-defaults to &quot;paid&quot; when an Order is linked. Override if it was actually a free demo.
              </div>
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

          {/* ── v1.9.3: Link ad-hoc purchases ────────────────────── */}
          {/* Multi-select recent AdHocPurchases. When selected, auto-matches
              the purchase's SKU to existing recipe lines (flipping their
              costBasis to linked-purchase). Unmatched items (no-SKU or no
              matching recipe line) appear in the "Unmapped" section below
              for manual linking. */}
          {recentAdhocPurchases.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-stone-700">
                🔗 Link ad-hoc purchases (optional)
              </Label>
              <div className="text-[10px] text-stone-500 -mt-1">
                Pick recent purchases to auto-link their items to recipe lines by SKU.
                Matched lines flip to &quot;linked-purchase&quot; cost basis with the actual purchase price.
              </div>
              <div className="border border-stone-200 rounded-md max-h-[180px] overflow-y-auto">
                {recentAdhocPurchases.map((p) => {
                  const isSelected = selectedAdhocIds.has(p.id)
                  const isLinkedToLine = lines.some((l) => l.linkedAdhocPurchaseId === p.id)
                  return (
                    <label
                      key={p.id}
                      className={`flex items-start gap-2 px-3 py-2 border-b border-stone-100 last:border-b-0 cursor-pointer hover:bg-stone-50 ${isSelected ? "bg-blue-50" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleAdhocPurchase(p.id)}
                        className="mt-0.5 cursor-pointer"
                      />
                      <div className="flex-1 min-w-0 text-xs">
                        <div className="flex items-center gap-1 flex-wrap">
                          <span className="font-mono font-semibold text-stone-800">{p.adhocNumber}</span>
                          <span className="text-stone-600">· {p.vendor}</span>
                          <span className="text-stone-400">·</span>
                          <span className="text-stone-500">{new Date(p.date).toLocaleDateString("es-MX", { day: "2-digit", month: "short" })}</span>
                          {isLinkedToLine && (
                            <span className="ml-1 px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[9px] font-semibold uppercase tracking-wide">
                              ✓ Linked
                            </span>
                          )}
                        </div>
                        <div className="text-stone-700 mt-0.5">
                          {p.materialName}
                          {p.materialSku ? (
                            <span className="text-stone-400 ml-1 font-mono text-[10px]">{p.materialSku}</span>
                          ) : (
                            <span className="text-amber-700 ml-1 text-[10px]">(no SKU)</span>
                          )}
                          {/* v1.9.4: show color + variant badges inline if set */}
                          {p.color && (
                            <span className="ml-2 px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded text-[9px] font-semibold uppercase tracking-wide">
                              {p.color}
                            </span>
                          )}
                          {p.variant && (
                            <span className="ml-1 px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded text-[9px] font-semibold uppercase tracking-wide">
                              {p.variant}
                            </span>
                          )}
                        </div>
                        <div className="text-stone-500 mt-0.5">
                          {p.qtyPacks} packs × ${p.unitCost.toFixed(2)} = <span className="font-semibold text-stone-700">${p.total.toFixed(2)}</span>
                        </div>
                      </div>
                    </label>
                  )
                })}
              </div>

              {/* Unmapped purchases — selected but no auto-match found */}
              {unmappedPurchases.length > 0 && (
                <div className="border border-amber-200 bg-amber-50 rounded-md p-2 space-y-2">
                  <div className="text-xs font-semibold text-amber-800">
                    ⚠ Unmapped purchases ({unmappedPurchases.length})
                  </div>
                  <div className="text-[10px] text-amber-700">
                    These purchases couldn&apos;t be auto-matched to a recipe line (no SKU or no matching line).
                    Pick a line to link manually, or skip.
                  </div>
                  {unmappedPurchases.map((p) => (
                    <div key={p.id} className="flex items-center gap-2 text-xs">
                      <div className="flex-1 min-w-0">
                        <span className="font-mono font-semibold">{p.adhocNumber}</span>
                        <span className="text-stone-600 ml-1">· {p.materialName}</span>
                        <span className="text-stone-500 ml-1">${p.unitCost.toFixed(2)}/pack</span>
                      </div>
                      <Select
                        value={manualLinks[p.id] ?? ""}
                        onValueChange={(v) => manuallyLinkAdhoc(p.id, v as string | "skip")}
                      >
                        <SelectTrigger className="h-7 text-[11px] w-[200px]">
                          <SelectValue placeholder="Pick line…" />
                        </SelectTrigger>
                        <SelectContent className="max-h-[240px]">
                          <SelectItem value="skip">— Skip —</SelectItem>
                          {lines.map((l) => (
                            <SelectItem key={l.key} value={l.key}>
                              {l.materialName} ({l.materialSku}) · {l.qtyUsed} {l.unit}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              )}

              {/* Summary of linked costs */}
              {selectedAdhocIds.size > 0 && (
                <div className="text-[10px] text-stone-500">
                  {lines.filter((l) => l.linkedAdhocPurchaseId).length} line(s) using linked-purchase costs ·{" "}
                  {lines.filter((l) => !l.linkedAdhocPurchaseId).length} on list/manual
                </div>
              )}
            </div>
          )}

          {/* ── v1.9.3: Time tracking ───────────────────────────── */}
          {/* Personal KPI: how much time did Maria spend executing this order.
              Three input modes:
                1. Timer (Start/Stop buttons) — most accurate
                2. Manual duration (type minutes) — fast for after-the-fact
                3. Hybrid — timer runs, then override the duration field */}
          <div className="space-y-2 border border-stone-200 rounded-md p-3 bg-stone-50">
            <Label className="text-xs font-semibold text-stone-700">
              ⏱ Time spent (optional)
            </Label>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Timer buttons */}
              {!timerRunning ? (
                <Button
                  type="button"
                  size="sm"
                  variant={timerStartedAt ? "outline" : "default"}
                  onClick={startTimer}
                  className="h-8 text-xs"
                  disabled={!!timerCompletedAt}
                >
                  {timerStartedAt ? "▶ Resume" : "▶ Start"}
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  onClick={stopTimer}
                  className="h-8 text-xs"
                >
                  ⏸ Stop
                </Button>
              )}
              {(timerStartedAt || timerCompletedAt) && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={resetTimer}
                  className="h-8 text-xs"
                >
                  ↺ Reset
                </Button>
              )}

              {/* Live elapsed time */}
              {timerRunning && (
                <span className="font-mono text-lg font-semibold text-stone-900 tabular-nums">
                  {formatElapsed(liveElapsedSec)}
                </span>
              )}

              {/* Stopped: show final elapsed */}
              {!timerRunning && timerStartedAt && timerCompletedAt && (
                <span className="font-mono text-sm text-emerald-700 tabular-nums">
                  ✓ {formatElapsed(Math.round((timerCompletedAt.getTime() - timerStartedAt.getTime()) / 1000))}
                </span>
              )}

              {/* Manual duration input */}
              <div className="ml-auto flex items-center gap-1">
                <Label className="text-[10px] text-stone-500 whitespace-nowrap">Duration (min)</Label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={durationMinutesInput}
                  onChange={(e) => setDurationMinutesInput(e.target.value)}
                  placeholder="e.g. 45"
                  className="h-8 w-20 text-xs text-right"
                />
              </div>
            </div>
            {timerRunning && (
              <div className="text-[10px] text-stone-500">
                Timer running since {timerStartedAt?.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}. Click Stop when finished.
              </div>
            )}
            {!timerRunning && !timerStartedAt && (
              <div className="text-[10px] text-stone-500">
                Use the timer for live tracking, or type the duration directly for after-the-fact logging.
              </div>
            )}
          </div>

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
                      <th className="text-left px-2 py-2 font-medium w-36">Cost basis</th>
                      <th className="text-left px-2 py-2 font-medium w-24">Color</th>
                      <th className="text-left px-2 py-2 font-medium w-24">Variant</th>
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
                          {/* v1.9.3: when costBasis=linked-purchase, the unitCost is
                              snapshotted from the linked AdHocPurchase — read-only.
                              When costBasis=manual, the user types the actual cost.
                              When costBasis=list (default), the user can override
                              (which implicitly switches to manual). */}
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={l.unitCost}
                            onChange={(e) =>
                              updateLine(l.key, {
                                unitCost: Number(e.target.value),
                                // Editing the unit cost implicitly means manual override
                                costBasis: l.costBasis === "linked-purchase" ? "manual" : l.costBasis,
                              })
                            }
                            disabled={l.costBasis === "linked-purchase"}
                            className="h-8 text-xs text-right"
                            style={l.costBasis === "linked-purchase" ? { background: "#F5F5F4", color: "#78716C" } : undefined}
                            title={l.costBasis === "linked-purchase" ? "Cost from linked ad-hoc purchase — switch to Manual to override" : undefined}
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
                        {/* v1.9.3: cost basis column */}
                        <td className="px-2 py-1">
                          <Select
                            value={l.costBasis}
                            onValueChange={(v) => {
                              const newBasis = v as CostBasis
                              if (newBasis === "list") {
                                // Reverting to list — restore the material's unitCost
                                const mat = materials.find((m) => m.sku === l.materialSku)
                                updateLine(l.key, {
                                  costBasis: "list",
                                  linkedAdhocPurchaseId: undefined,
                                  unitCost: mat?.unitCost ?? 0,
                                })
                              } else if (newBasis === "manual") {
                                // Manual — keep current unitCost, just unlink
                                updateLine(l.key, {
                                  costBasis: "manual",
                                  linkedAdhocPurchaseId: undefined,
                                })
                              } else if (newBasis === "linked-purchase") {
                                // Linked-purchase — don't pick a purchase yet, just mark
                                // the basis. The user picks the actual purchase in the
                                // dropdown below.
                                updateLine(l.key, { costBasis: "linked-purchase" })
                              }
                            }}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {COST_BASIS_OPTIONS.map((c) => (
                                <SelectItem key={c.value} value={c.value}>
                                  {c.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {l.costBasis === "linked-purchase" && (
                            <Select
                              value={l.linkedAdhocPurchaseId ?? ""}
                              onValueChange={(v) => linkAdhocPurchase(l.key, v)}
                            >
                              <SelectTrigger className="h-7 text-[10px] mt-1">
                                <SelectValue placeholder="Pick purchase…" />
                              </SelectTrigger>
                              <SelectContent className="max-h-[240px]">
                                {getMatchingPurchases(l.materialSku).length === 0 ? (
                                  <SelectItem value="_none" disabled>
                                    No recent purchases match this SKU
                                  </SelectItem>
                                ) : (
                                  getMatchingPurchases(l.materialSku).map((p) => (
                                    <SelectItem key={p.id} value={p.id}>
                                      {p.adhocNumber} · {p.vendor} · ${p.unitCost.toFixed(2)}/pack
                                      {p.materialSku === null && " (no SKU)"}
                                    </SelectItem>
                                  ))
                                )}
                              </SelectContent>
                            </Select>
                          )}
                          {l.costBasis === "linked-purchase" && l.linkedAdhocPurchaseId && (
                            <div className="text-[9px] text-stone-500 mt-1">
                              ✓ Linked
                            </div>
                          )}
                        </td>
                        {/* v1.9.4: Color cell — free-text with autocomplete from material.colors */}
                        <td className="px-1 py-1">
                          {(() => {
                            const mat = materials.find((m) => m.sku === l.materialSku)
                            const suggestions = mat?.colors
                              ? mat.colors.split(",").map((c) => c.trim()).filter(Boolean)
                              : []
                            const isLighter = !mat || !mat.category ||
                              mat.category === "packaging" || mat.category === "other"
                            return (
                              <>
                                <input
                                  type="text"
                                  value={l.color ?? ""}
                                  onChange={(e) => updateLine(l.key, { color: e.target.value })}
                                  list={`color-sugg-${l.key}`}
                                  placeholder={isLighter ? "—" : "color"}
                                  className="h-8 w-full text-xs px-1 border border-stone-200 rounded"
                                  style={isLighter ? { color: "#9CA3AF" } : undefined}
                                />
                                <datalist id={`color-sugg-${l.key}`}>
                                  {suggestions.map((c) => (
                                    <option key={c} value={c} />
                                  ))}
                                </datalist>
                              </>
                            )
                          })()}
                        </td>
                        {/* v1.9.4: Variant cell — always free-text */}
                        <td className="px-1 py-1">
                          <input
                            type="text"
                            value={l.variant ?? ""}
                            onChange={(e) => updateLine(l.key, { variant: e.target.value })}
                            placeholder="—"
                            className="h-8 w-full text-xs px-1 border border-stone-200 rounded"
                            style={{ color: "#9CA3AF" }}
                          />
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
