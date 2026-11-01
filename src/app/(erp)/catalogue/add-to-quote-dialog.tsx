"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog"
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
type QuoteOption = {
  id: string
  quoteNumber: string
  customerName: string | null
  status: string
}

type ProductInfo = {
  id: string
  sku: string
  name: string
  size: string | null
  actualPriceBeforeIva: number
}

// All products (for the "Add line" dropdown in new-quote mode)
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
export function AddToQuoteDialog({
  product,
  existingQuotes,
  products,
  customers,
  events,
}: {
  product: ProductInfo
  existingQuotes: QuoteOption[]
  products: ProductOption[]
  customers: CustomerOption[]
  events: EventOption[]
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<"existing" | "new">("existing")
  // Existing-mode state
  const [existingQuoteId, setExistingQuoteId] = useState("")
  const [existingQty, setExistingQty] = useState("1")
  const [existingNotes, setExistingNotes] = useState("")
  // New-mode state
  const [form, setForm] = useState<NewQuoteForm>(INITIAL_NEW_QUOTE_FORM)
  const [newLines, setNewLines] = useState<EditLine[]>([])
  const router = useRouter()

  const unitPrice = product.actualPriceBeforeIva
  const existingLineTotal = unitPrice * (Number(existingQty) || 0)

  // ── Pre-seed newLines with the clicked product when entering "new" mode ──
  function handleSwitchMode(next: "existing" | "new") {
    setMode(next)
    if (next === "new" && newLines.length === 0) {
      setNewLines([
        {
          key: `seed-${product.id}-${Date.now()}`,
          productId: product.id,
          productSku: product.sku,
          description: `${product.name}${product.size ? ` (${product.size})` : ""}`,
          size: product.size,
          qty: 1,
          unitPrice: product.actualPriceBeforeIva,
        },
      ])
    }
  }

  // ── New-mode line item operations ──────────────────────
  function addLine() {
    setNewLines((prev) => [
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
    setNewLines((prev) => prev.filter((l) => l.key !== key))
  }

  function updateLine(key: string, patch: Partial<EditLine>) {
    setNewLines((prev) =>
      prev.map((l) => {
        if (l.key !== key) return l
        const next = { ...l, ...patch }
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

  // ── Live totals (new mode) ─────────────────────────────
  const subtotal = newLines.reduce((s, l) => s + l.qty * l.unitPrice, 0)
  const iva = subtotal * 0.16
  const total = subtotal + iva
  // depositRequired is now computed by <DepositPreview> using the payment rule
  // (so it changes based on quoteMode + eventDate). The actual stored value
  // is computed by the API.

  // ── Override decline state (for <2 week events, new mode) ──
  const [overrideDecline, setOverrideDecline] = useState(false)

  // ── Submit ─────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      if (mode === "existing") {
        // ── EXISTING MODE — add the product as a quote line ──
        if (!existingQuoteId) {
          toast.error("Please select a quote")
          setLoading(false)
          return
        }
        const res = await fetch("/api/quote-lines", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            quoteId: existingQuoteId,
            productSku: product.sku,
            productId: product.id,
            description: `${product.name}${product.size ? ` (${product.size})` : ""}`,
            qty: Number(existingQty) || 1,
            unitPrice,
            notes: existingNotes || undefined,
          }),
        })
        if (!res.ok) throw new Error((await res.json()).error ?? "Failed to add line")
        const data = await res.json()
        toast.success("Added to quote", {
          description: `${product.name} × ${existingQty} → $${existingLineTotal.toLocaleString("es-MX", { maximumFractionDigits: 0 })} (quote total: $${data.quoteTotals?.total?.toLocaleString("es-MX", { maximumFractionDigits: 0 }) ?? "?"})`,
        })
        setOpen(false)
        setExistingQuoteId("")
        setExistingQty("1")
        setExistingNotes("")
        router.refresh()
      } else {
        // ── NEW MODE — create the quote with all line items in one transaction ──
        if (!form.customerName) {
          toast.error("Customer name is required for a new quote")
          setLoading(false)
          return
        }
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
          lineItems: newLines
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
          throw new Error(err.error ?? "Failed to create quote")
        }
        const data = await res.json()
        toast.success("Quote created", {
          description: `${data.quote.quoteNumber} — ${newLines.length} line(s) · $${data.quote.total?.toFixed(0) ?? total.toFixed(0)}`,
        })
        setOpen(false)
        setForm(INITIAL_NEW_QUOTE_FORM)
        setNewLines([])
        setOverrideDecline(false)
        router.refresh()
      }
    } catch (e) {
      toast.error(mode === "existing" ? "Failed to add to quote" : "Failed to create quote", {
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setLoading(false)
    }
  }

  const canSubmit =
    mode === "existing" ? !!existingQuoteId : !!form.customerName

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="px-3 py-1.5 text-xs font-medium bg-stone-900 text-white rounded-md hover:bg-stone-800 transition">
          + Add to Quote
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[680px] max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add to Quote</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* ── Product summary (always shown) ───────────────── */}
          <div className="p-3 bg-stone-50 border border-stone-200 rounded-md">
            <div className="font-medium text-stone-900">
              {product.name}
              {product.size && <span className="text-stone-500 ml-2">({product.size})</span>}
            </div>
            <div className="text-xs text-stone-500 font-mono mt-0.5">{product.sku}</div>
            <div className="text-sm font-bold text-stone-900 mt-1">
              ${unitPrice.toLocaleString("es-MX", { maximumFractionDigits: 0 })} MXN
              <span className="text-xs text-stone-500 font-normal ml-1">(before IVA)</span>
            </div>
          </div>

          {/* ── Mode toggle ──────────────────────────────────── */}
          <div className="flex gap-1 border-b border-stone-200">
            <button
              type="button"
              onClick={() => setMode("existing")}
              className={`px-3 py-2 text-sm font-medium border-b-2 transition ${
                mode === "existing" ? "border-stone-900 text-stone-900" : "border-transparent text-stone-500 hover:text-stone-700"
              }`}
            >
              Existing quote
            </button>
            <button
              type="button"
              onClick={() => handleSwitchMode("new")}
              className={`px-3 py-2 text-sm font-medium border-b-2 transition ${
                mode === "new" ? "border-stone-900 text-stone-900" : "border-transparent text-stone-500 hover:text-stone-700"
              }`}
            >
              + New quote
            </button>
          </div>

          {/* ── EXISTING MODE ────────────────────────────────── */}
          {mode === "existing" && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Select a quote *</Label>
                {existingQuotes.length === 0 ? (
                  <div className="text-sm text-stone-500 italic p-3 bg-stone-50 rounded-md border border-stone-200">
                    No active quotes. Switch to &quot;+ New quote&quot; to create one.
                  </div>
                ) : (
                  <Select value={existingQuoteId} onValueChange={setExistingQuoteId} required>
                    <SelectTrigger><SelectValue placeholder="Select quote..." /></SelectTrigger>
                    <SelectContent>
                      {existingQuotes.map((q) => (
                        <SelectItem key={q.id} value={q.id}>
                          {q.quoteNumber} — {q.customerName ?? "No customer"} ({q.status})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="qty">Quantity *</Label>
                  <Input
                    id="qty"
                    type="number"
                    min="1"
                    value={existingQty}
                    onChange={(e) => setExistingQty(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Unit price (before IVA)</Label>
                  <div className="px-3 py-2 text-sm border border-stone-200 rounded-md bg-stone-50 text-stone-700">
                    ${unitPrice.toLocaleString("es-MX", { maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
              {existingLineTotal > 0 && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-md text-sm text-emerald-800">
                  <div className="text-xs uppercase tracking-wider">Line total (before IVA)</div>
                  <div className="text-lg font-bold">
                    ${existingLineTotal.toLocaleString("es-MX", { maximumFractionDigits: 2 })} MXN
                  </div>
                  <div className="text-xs mt-1">{existingQty} × ${unitPrice.toFixed(2)}</div>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Input
                  id="notes"
                  value={existingNotes}
                  onChange={(e) => setExistingNotes(e.target.value)}
                  placeholder="e.g. Bridal bouquet, specific color..."
                />
              </div>
            </div>
          )}

          {/* ── NEW MODE ─────────────────────────────────────── */}
          {mode === "new" && (
            <div className="space-y-4">
              <NewQuoteFields form={form} setForm={setForm} customers={customers} events={events} />

              {/* ── Line items (pre-seeded with the clicked product) ── */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] uppercase tracking-wider text-stone-500 font-semibold border-b border-stone-200 pb-1 flex-1">
                    Line items ({newLines.length})
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={addLine}>
                    + Add line
                  </Button>
                </div>
                {newLines.length > 0 && (
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
                        {newLines.map((l) => (
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
                    {newLines.map((l) => (
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

              {/* ── Live totals + deposit rule + decline warning ─── */}
              {newLines.length > 0 && (
                <DepositPreview
                  total={total}
                  quoteMode={form.quoteMode}
                  eventDate={form.eventDate}
                  overrideDecline={overrideDecline}
                  setOverrideDecline={setOverrideDecline}
                />
              )}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={loading || !canSubmit}>
              {loading
                ? (mode === "existing" ? "Adding..." : "Creating...")
                : (mode === "existing" ? "✓ Add to Quote" : "✓ Create Quote")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
