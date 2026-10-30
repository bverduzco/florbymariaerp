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

export function AddToQuoteDialog({
  product,
  existingQuotes,
}: {
  product: ProductInfo
  existingQuotes: QuoteOption[]
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<"existing" | "new">("existing")
  const [form, setForm] = useState({
    quoteId: "",
    qty: "1",
    notes: "",
    // For new quote creation
    customerName: "",
    eventType: "",
  })
  const router = useRouter()

  const unitPrice = product.actualPriceBeforeIva
  const lineTotal = unitPrice * (Number(form.qty) || 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      let quoteId = form.quoteId

      // If creating a new quote, do that first
      if (mode === "new") {
        if (!form.customerName) {
          toast.error("Customer name is required for a new quote")
          setLoading(false)
          return
        }

        const subtotal = unitPrice * (Number(form.qty) || 1)
        const iva = subtotal * 0.16
        const total = subtotal + iva

        const quoteRes = await fetch("/api/quotes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customerName: form.customerName,
            eventType: form.eventType || undefined,
            subtotal,
            leadSource: "walk_in",
          }),
        })

        if (!quoteRes.ok) throw new Error((await quoteRes.json()).error ?? "Failed to create quote")
        const quoteData = await quoteRes.json()
        quoteId = quoteData.quote.id
      }

      if (!quoteId) {
        toast.error("Please select a quote or create a new one")
        setLoading(false)
        return
      }

      // Add the product as a quote line
      const res = await fetch("/api/quote-lines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quoteId,
          productSku: product.sku,
          productId: product.id,
          description: `${product.name}${product.size ? ` (${product.size})` : ""}`,
          qty: Number(form.qty) || 1,
          unitPrice,
          notes: form.notes || undefined,
        }),
      })

      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to add line")
      const data = await res.json()

      toast.success("Added to quote", {
        description: `${product.name} × ${form.qty} → $${lineTotal.toLocaleString("es-MX", { maximumFractionDigits: 0 })} (quote total: $${data.quoteTotals?.total?.toLocaleString("es-MX", { maximumFractionDigits: 0 }) ?? "?"})`,
      })

      setOpen(false)
      setForm({ quoteId: "", qty: "1", notes: "", customerName: "", eventType: "" })
      router.refresh()
    } catch (e) {
      toast.error("Failed to add to quote", {
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="px-3 py-1.5 text-xs font-medium bg-stone-900 text-white rounded-md hover:bg-stone-800 transition">
          + Add to Quote
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Add to Quote</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Product summary */}
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

          {/* Mode toggle: existing vs new quote */}
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
              onClick={() => setMode("new")}
              className={`px-3 py-2 text-sm font-medium border-b-2 transition ${
                mode === "new" ? "border-stone-900 text-stone-900" : "border-transparent text-stone-500 hover:text-stone-700"
              }`}
            >
              + New quote
            </button>
          </div>

          {/* Existing quote selector */}
          {mode === "existing" && (
            <div className="space-y-2">
              <Label>Select a quote *</Label>
              {existingQuotes.length === 0 ? (
                <div className="text-sm text-stone-500 italic p-3 bg-stone-50 rounded-md border border-stone-200">
                  No active quotes. Switch to &quot;+ New quote&quot; to create one.
                </div>
              ) : (
                <Select value={form.quoteId} onValueChange={(v) => setForm({ ...form, quoteId: v })} required>
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
          )}

          {/* New quote fields */}
          {mode === "new" && (
            <div className="space-y-3">
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
              <div className="space-y-2">
                <Label>Event type</Label>
                <Select value={form.eventType} onValueChange={(v) => setForm({ ...form, eventType: v })}>
                  <SelectTrigger><SelectValue placeholder="Optional..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="wedding">💒 Wedding</SelectItem>
                    <SelectItem value="birthday">🎂 Birthday</SelectItem>
                    <SelectItem value="corporate">🏢 Corporate</SelectItem>
                    <SelectItem value="quinceanera">🎀 Quinceañera</SelectItem>
                    <SelectItem value="other">📦 Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Qty + line total */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="qty">Quantity *</Label>
              <Input
                id="qty"
                type="number"
                min="1"
                value={form.qty}
                onChange={(e) => setForm({ ...form, qty: e.target.value })}
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

          {/* Live line total */}
          {lineTotal > 0 && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-md text-sm text-emerald-800">
              <div className="text-xs uppercase tracking-wider">Line total (before IVA)</div>
              <div className="text-lg font-bold">
                ${lineTotal.toLocaleString("es-MX", { maximumFractionDigits: 2 })} MXN
              </div>
              <div className="text-xs mt-1">{form.qty} × ${unitPrice.toFixed(2)}</div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="e.g. Bridal bouquet, specific color..."
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              type="submit"
              disabled={loading || (mode === "existing" && !form.quoteId) || (mode === "new" && !form.customerName)}
            >
              {loading ? "Adding..." : "✓ Add to Quote"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
