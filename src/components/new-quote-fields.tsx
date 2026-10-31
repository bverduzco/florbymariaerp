"use client"

/**
 * Shared form fields for creating a new Quote.
 *
 * Used by two dialogs:
 *   1. Quotes tab → "+ New Quote" dialog (standalone)
 *   2. Catalogue tab → "+ Add to Quote" → "New quote" mode
 *
 * Both render the SAME fields so a quote created from either entry point
 * has identical data shape. Parent owns the form state and passes it in
 * (controlled component pattern).
 *
 * The line items table is NOT part of this component — each dialog renders
 * its own line items table (Catalogue pre-seeds with the clicked product;
 * New Quote starts empty).
 */

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

// ───────────────────────────────────────────────────────────────────────────
// Form shape — exported so both dialogs can use the same type
// ───────────────────────────────────────────────────────────────────────────
export type NewQuoteForm = {
  customerName: string
  eventId: string // "_none" or an event id
  quoteMode: "event" | "no_event"
  eventType: string // depends on mode (wedding|birthday|... OR everyday|sympathy|...)
  eventDate: string // yyyy-mm-dd (event date OR delivery date, depending on mode)
  leadSource: string
  leadSourceDetail: string
  notes: string
}

export const INITIAL_NEW_QUOTE_FORM: NewQuoteForm = {
  customerName: "",
  eventId: "_none",
  quoteMode: "no_event", // default — everyday orders are more common
  eventType: "",
  eventDate: "",
  leadSource: "",
  leadSourceDetail: "",
  notes: "",
}

// ───────────────────────────────────────────────────────────────────────────
// Type options — different list per quote mode
// ───────────────────────────────────────────────────────────────────────────
const EVENT_TYPES = [
  { value: "wedding", label: "💒 Wedding" },
  { value: "birthday", label: "🎂 Birthday" },
  { value: "corporate", label: "🏢 Corporate event" },
  { value: "quinceanera", label: "🎀 Quinceañera" },
  { value: "anniversary", label: "💝 Anniversary" },
  { value: "other", label: "📦 Other event" },
]

const ORDER_TYPES = [
  { value: "everyday", label: "💐 Everyday bouquet" },
  { value: "sympathy", label: "🕊️ Sympathy / Funeral" },
  { value: "just_because", label: "🎁 Just because" },
  { value: "corporate_restock", label: "🏢 Corporate restock" },
  { value: "custom", label: "🎨 Custom design" },
  { value: "other", label: "📦 Other" },
]

const LEAD_SOURCES = [
  { value: "instagram", label: "📸 Instagram" },
  { value: "referral", label: "👥 Referral" },
  { value: "walk_in", label: "🚶 Walk-in" },
  { value: "wedding_planner", label: "👰 Wedding planner" },
  { value: "google", label: "🔍 Google" },
  { value: "repeat_customer", label: "🔁 Repeat customer" },
  { value: "other", label: "📦 Other" },
]

// Sources that trigger the conditional detail field
const SOURCES_WITH_DETAIL = ["referral", "wedding_planner", "other"]

function getDetailLabel(source: string): string {
  switch (source) {
    case "referral":
      return "Referrer name"
    case "wedding_planner":
      return "Planner name"
    default:
      return "Source detail"
  }
}

function getDetailPlaceholder(source: string): string {
  switch (source) {
    case "referral":
      return "e.g. Laura Martínez"
    case "wedding_planner":
      return "e.g. Eventos MX"
    default:
      return "Where exactly did they find you?"
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Props
// ───────────────────────────────────────────────────────────────────────────
type EventOption = {
  id: string
  eventNumber: string
  name: string
  eventDate: Date | string | null
}

type CustomerOption = {
  id: string
  name: string
}

export type NewQuoteFieldsProps = {
  form: NewQuoteForm
  setForm: (updater: (prev: NewQuoteForm) => NewQuoteForm) => void
  customers: CustomerOption[]
  events: EventOption[]
}

// ───────────────────────────────────────────────────────────────────────────
// Component
// ───────────────────────────────────────────────────────────────────────────
export function NewQuoteFields({
  form,
  setForm,
  customers,
  events,
}: NewQuoteFieldsProps) {
  const showDetail = SOURCES_WITH_DETAIL.includes(form.leadSource)
  const typeOptions = form.quoteMode === "event" ? EVENT_TYPES : ORDER_TYPES
  const dateLabel = form.quoteMode === "event" ? "Event date" : "Delivery date"

  // When event picker changes: if picking an event, switch to event mode + auto-fill date
  function handleEventChange(v: string) {
    if (v === "_none") {
      setForm((p) => ({ ...p, eventId: "_none" }))
      return
    }
    const ev = events.find((e) => e.id === v)
    const evDate =
      ev?.eventDate instanceof Date
        ? ev.eventDate.toISOString().slice(0, 10)
        : ev?.eventDate
          ? new Date(ev.eventDate).toISOString().slice(0, 10)
          : ""
    setForm((p) => ({
      ...p,
      eventId: v,
      quoteMode: "event", // picking an event forces event mode
      eventDate: evDate || p.eventDate,
    }))
  }

  // When mode toggle changes: clear the eventType (different option lists)
  function handleModeChange(mode: "event" | "no_event") {
    setForm((p) => ({ ...p, quoteMode: mode, eventType: "" }))
  }

  return (
    <div className="space-y-5">
      {/* ── CUSTOMER ─────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="text-[10px] uppercase tracking-wider text-stone-500 font-semibold border-b border-stone-200 pb-1">
          Customer
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="customerName">Customer name *</Label>
            <Input
              id="customerName"
              list="customer-suggestions"
              value={form.customerName}
              onChange={(e) =>
                setForm((p) => ({ ...p, customerName: e.target.value }))
              }
              placeholder="e.g. María González"
              required
            />
            <datalist id="customer-suggestions">
              {customers.map((c) => (
                <option key={c.id} value={c.name} />
              ))}
            </datalist>
          </div>
          <div className="space-y-2">
            <Label>Linked event (optional)</Label>
            <Select value={form.eventId} onValueChange={handleEventChange}>
              <SelectTrigger>
                <SelectValue placeholder="— none —" />
              </SelectTrigger>
              <SelectContent className="max-h-[260px]">
                <SelectItem value="_none">— none —</SelectItem>
                {events.length === 0 ? (
                  <SelectItem value="_empty" disabled>
                    No events yet
                  </SelectItem>
                ) : (
                  events.map((e) => {
                    const dateStr =
                      e.eventDate instanceof Date
                        ? e.eventDate.toLocaleDateString("es-MX", {
                            day: "2-digit",
                            month: "short",
                          })
                        : e.eventDate
                          ? new Date(e.eventDate).toLocaleDateString("es-MX", {
                              day: "2-digit",
                              month: "short",
                            })
                          : null
                    return (
                      <SelectItem key={e.id} value={e.id}>
                        {e.eventNumber} · {e.name}
                        {dateStr && ` · ${dateStr}`}
                      </SelectItem>
                    )
                  })
                )}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="text-[10px] text-stone-500 -mt-1">
          Pick an existing event to auto-link + auto-fill the date. Leave blank
          for standalone quotes (everyday orders, sympathy, etc.).
        </div>
      </div>

      {/* ── QUOTE CONTEXT ───────────────────────────────── */}
      <div className="space-y-3">
        <div className="text-[10px] uppercase tracking-wider text-stone-500 font-semibold border-b border-stone-200 pb-1">
          Quote context
        </div>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input
              type="radio"
              name="quoteMode"
              value="no_event"
              checked={form.quoteMode === "no_event"}
              onChange={() => handleModeChange("no_event")}
              className="accent-stone-900"
            />
            <span>No event (everyday)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input
              type="radio"
              name="quoteMode"
              value="event"
              checked={form.quoteMode === "event"}
              onChange={() => handleModeChange("event")}
              className="accent-stone-900"
            />
            <span>Event-driven</span>
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>{form.quoteMode === "event" ? "Event type" : "Order type"}</Label>
            <Select
              value={form.eventType}
              onValueChange={(v) => setForm((p) => ({ ...p, eventType: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                {typeOptions.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="eventDate">{dateLabel}</Label>
            <Input
              id="eventDate"
              type="date"
              value={form.eventDate}
              onChange={(e) =>
                setForm((p) => ({ ...p, eventDate: e.target.value }))
              }
            />
          </div>
        </div>
      </div>

      {/* ── LEAD SOURCE ──────────────────────────────────── */}
      <div className="space-y-3">
        <div className="text-[10px] uppercase tracking-wider text-stone-500 font-semibold border-b border-stone-200 pb-1">
          Lead source
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Source</Label>
            <Select
              value={form.leadSource}
              onValueChange={(v) =>
                setForm((p) => ({ ...p, leadSource: v, leadSourceDetail: "" }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                {LEAD_SOURCES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {showDetail && (
            <div className="space-y-2">
              <Label htmlFor="leadSourceDetail">
                {getDetailLabel(form.leadSource)}
              </Label>
              <Input
                id="leadSourceDetail"
                value={form.leadSourceDetail}
                onChange={(e) =>
                  setForm((p) => ({ ...p, leadSourceDetail: e.target.value }))
                }
                placeholder={getDetailPlaceholder(form.leadSource)}
              />
            </div>
          )}
        </div>
      </div>

      {/* ── NOTES ───────────────────────────────────────── */}
      <div className="space-y-2">
        <Label htmlFor="notes">Notes (optional)</Label>
        <Textarea
          id="notes"
          value={form.notes}
          onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
          placeholder="What does the customer want? Color preferences, specific flowers, budget constraints..."
          rows={2}
        />
      </div>
    </div>
  )
}
