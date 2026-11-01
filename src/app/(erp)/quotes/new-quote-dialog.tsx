"use client"

import { useState } from "react"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import {
  NewQuoteFields,
  INITIAL_NEW_QUOTE_FORM,
  type NewQuoteForm,
} from "@/components/new-quote-fields"
import { DepositPreview } from "@/components/deposit-preview"

// ───────────────────────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────────────────────
type ProductOption = {
  id: string
  sku: string
  name: string
  size: string | null
  actualPriceBeforeIva: number
}

type CustomerOption = {
  id: string
  name: string
}

type EventOption = {
  id: string
  eventNumber: string
  name: string
  eventDate: Date | null
}

// Internal line item state (editable)
type EditLine = {
  key: string
  productId: string
  productSku: string
  description: string
  size: string | null
  qty: number
  unitPrice: number
}

// ───────────────────────────────────────────────────────────────────────────
// Dialog
// ───────────────────────────────────────────────────────────────────────────
export function NewQuoteDialog({
  products,
  customers,
  events,
  autoOpen = false,
}: {
  products: ProductOption[]
  customers: CustomerOption[]
  events: EventOption[]
  autoOpen?: boolean
}) {
  const [open, setOpen] = useState(autoOpen)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState<NewQuoteForm>(INITIAL_NEW_QUOTE_FORM)
  const [lines, setLines] = useState<EditLine[]>([])
  const router = useRouter()

  // ── Line items table operations ──────────────────────────
  function addLine() {
    setLines((prev) => [
      ...prev,
      {
        key: `new-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        productId: "",
        productSku: "",
        description: "",
        size: null,
        qty: 1,
        unitPrice: 0,
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
        // When product changes, pre-fill description + size + unitPrice from catalog
        if (patch.productId && patch.productId !== l.productId) {
          const p = products.find((x) => x.id === patch.productId)
          if (p) {
            next.productSku = p.sku
            next.description = `${p.name}${p.size ? ` (${p.size})` : ""}`
            next.size = p.size
            next.unitPrice = p.actualPriceBeforeIva
          }
        }
        return next
      })
    )
  }

  // ── Live totals ─────────────────────────────────────────
  const subtotal = lines.reduce((s, l) => s + l.qty * l.unitPrice, 0)
  const iva = subtotal * 0.16
  const total = subtotal + iva
  // depositRequired is now computed by <DepositPreview> using the payment rule
  // (so it changes based on quoteMode + eventDate). The actual stored value
  // is computed by the API.

  // ── Override decline state (for <2 week events) ────────
  const [overrideDecline, setOverrideDecline] = useState(false)

  // ── Submit ──────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.customerName) return
    setLoading(true)
    try {
      const payload = {
        customerName: form.customerName,
        eventId: form.eventId !== "_none" ? form.eventId : null,
        eventType: form.eventType || null,
        eventDate: form.eventDate || null,
        quoteMode: form.quoteMode,
        leadSource: form.leadSource || null,
        leadSourceDetail: form.leadSourceDetail || null,
        notes: form.notes || null,
        overrideDecline,
        lineItems: lines
          .filter((l) => l.description && l.qty > 0)
          .map((l) => ({
            productSku: l.productSku || null,
            productId: l.productId || null,
            description: l.description,
            qty: l.qty,
            unitPrice: l.unitPrice,
          })),
      }
      const res = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json()
        // 422 = decline rule fired without override — show a specific toast
        if (res.status === 422 && err.paymentRule === "event_declined_too_close") {
          throw new Error(
            `${err.error} Check the override box below the totals to create the quote anyway.`
          )
        }
        throw new Error(err.error ?? "Failed")
      }
      const data = await res.json()
      toast.success("Quote created", {
        description: `${data.quote.quoteNumber} — ${lines.length} line(s) · $${data.quote.total?.toFixed(0) ?? total.toFixed(0)}`,
      })
      setOpen(false)
      setForm(INITIAL_NEW_QUOTE_FORM)
      setLines([])
      setOverrideDecline(false)
      router.refresh()
    } catch (e) {
      toast.error("Failed to create quote", {
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setLoading(false)
    }
  }

  const canSubmit = !!form.customerName

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="px-4 py-2 text-sm font-medium bg-stone-900 text-white rounded-md hover:bg-stone-800 transition">
          + New Quote
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[820px] max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Quote</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5 pt-2">
          <NewQuoteFields form={form} setForm={setForm} customers={customers} events={events} />

          {/* ── LINE ITEMS ──────────────────────────────────── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-[10px] uppercase tracking-wider text-stone-500 font-semibold border-b border-stone-200 pb-1 flex-1">
                Line items ({lines.length})
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addLine}>
                + Add line
              </Button>
            </div>

            {lines.length === 0 ? (
              <div className="p-4 text-center text-xs text-stone-500 border border-dashed border-stone-300 rounded-md">
                No lines yet. Click <b>+ Add line</b> to add a product, or
                save with no lines and add them later from the quote detail page.
              </div>
            ) : (
              <>
              {/* ── Desktop: table view ──────────────────────────── */}
              <div className="hidden sm:block border border-stone-200 rounded-md overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-stone-50 text-stone-600">
                    <tr>
                      <th className="text-left px-2 py-2 font-medium">Product</th>
                      <th className="text-left px-2 py-2 font-medium w-16">Size</th>
                      <th className="text-right px-2 py-2 font-medium w-20">Qty</th>
                      <th className="text-right px-2 py-2 font-medium w-24">Unit $</th>
                      <th className="text-right px-2 py-2 font-medium w-24">Line $</th>
                      <th className="px-2 py-2 w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l) => (
                      <tr key={l.key} className="border-t border-stone-100">
                        <td className="px-2 py-1">
                          <Select
                            value={l.productId}
                            onValueChange={(v) => updateLine(l.key, { productId: v })}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Pick product..." />
                            </SelectTrigger>
                            <SelectContent className="max-h-[260px]">
                              {products.map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.name} · ${p.actualPriceBeforeIva.toLocaleString("es-MX", { maximumFractionDigits: 0 })}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {!l.productId && (
                            <Input
                              value={l.description}
                              onChange={(e) => updateLine(l.key, { description: e.target.value })}
                              placeholder="Or type a custom description"
                              className="h-7 text-xs mt-1"
                            />
                          )}
                        </td>
                        <td className="px-2 py-1 text-stone-600">{l.size ?? "—"}</td>
                        <td className="px-1 py-1">
                          <Input
                            type="number"
                            min="1"
                            value={l.qty}
                            onChange={(e) => updateLine(l.key, { qty: Number(e.target.value) })}
                            className="h-8 text-xs text-right px-1"
                          />
                        </td>
                        <td className="px-2 py-1">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={l.unitPrice}
                            onChange={(e) => updateLine(l.key, { unitPrice: Number(e.target.value) })}
                            className="h-8 text-xs text-right"
                          />
                        </td>
                        <td className="px-2 py-1 text-right font-semibold tabular-nums">
                          ${(l.qty * l.unitPrice).toLocaleString("es-MX", { maximumFractionDigits: 2 })}
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
                    <Select
                      value={l.productId}
                      onValueChange={(v) => updateLine(l.key, { productId: v })}
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue placeholder="Pick product..." />
                      </SelectTrigger>
                      <SelectContent className="max-h-[260px]">
                        {products.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name} · ${p.actualPriceBeforeIva.toLocaleString("es-MX", { maximumFractionDigits: 0 })}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {!l.productId && (
                      <Input
                        value={l.description}
                        onChange={(e) => updateLine(l.key, { description: e.target.value })}
                        placeholder="Custom description"
                        className="h-7 text-xs mt-1"
                      />
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <Input
                        type="number"
                        min="1"
                        value={l.qty}
                        onChange={(e) => updateLine(l.key, { qty: Number(e.target.value) })}
                        className="h-8 text-xs text-right px-1 w-16"
                        placeholder="Qty"
                      />
                      <span className="text-xs text-stone-500">×</span>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={l.unitPrice}
                        onChange={(e) => updateLine(l.key, { unitPrice: Number(e.target.value) })}
                        className="h-8 text-xs text-right px-1 flex-1"
                        placeholder="Unit $"
                      />
                    </div>
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-stone-200">
                      <span className="text-sm font-semibold tabular-nums">
                        ${(l.qty * l.unitPrice).toLocaleString("es-MX", { maximumFractionDigits: 2 })}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeLine(l.key)}
                        className="text-stone-400 hover:text-red-600 transition text-sm"
                        title="Remove line"
                      >
                        ✕ Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              </>
            )}
          </div>

          {/* ── LIVE TOTALS SUMMARY + DEPOSIT RULE ─────────── */}
          {lines.length > 0 && (
            <DepositPreview
              total={total}
              quoteMode={form.quoteMode}
              eventDate={form.eventDate}
              overrideDecline={overrideDecline}
              setOverrideDecline={setOverrideDecline}
            />
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !canSubmit}>
              {loading ? "Creating..." : "✓ Create Quote"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
