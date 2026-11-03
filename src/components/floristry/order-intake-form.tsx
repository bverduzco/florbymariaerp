"use client"

import { useEffect, useMemo, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Plus,
  Minus,
  User,
  CalendarClock,
  Truck,
  DollarSign,
  Loader2,
  Sparkles,
  RotateCcw,
  PartyPopper,
} from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { useCatalogue } from "@/lib/catalogue-store"

interface Customer {
  id: string
  name: string
  phone: string
  email: string
  address: string
  notes: string
}

const DELIVERY_FLAT_RATE = 100 // MXN per address

export function OrderIntakeForm() {
  const router = useRouter()
  const products = useCatalogue((s) => s.products)
  const catalogueLoading = useCatalogue((s) => s.loading)
  const fetchCatalogue = useCatalogue((s) => s.fetch)

  const [customers, setCustomers] = useState<Customer[]>([])
  const [customersLoading, setCustomersLoading] = useState(true)

  // Form state
  const [customerId, setCustomerId] = useState<string>("")
  const [deliveryDate, setDeliveryDate] = useState<string>("")
  const [deliveryAddress, setDeliveryAddress] = useState<string>("")
  const [cardMessage, setCardMessage] = useState<string>("")
  const [deliveryNotes, setDeliveryNotes] = useState<string>("")
  const [internalNotes, setInternalNotes] = useState<string>("")
  const [deliveryFee, setDeliveryFee] = useState<number>(DELIVERY_FLAT_RATE)
  const [discount, setDiscount] = useState<number>(0)
  const [showNoDateConfirm, setShowNoDateConfirm] = useState(false)

  // Line item quantities keyed by product SKU
  const [quantities, setQuantities] = useState<Record<string, number>>({})

  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchCatalogue()
  }, [fetchCatalogue])

  // Load customers + events
  const [events, setEvents] = useState<{ id: string; name: string; eventNumber: string }[]>([])
  const [eventId, setEventId] = useState<string>("")

  useEffect(() => {
    fetch("/api/customers", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { customers: [] }))
      .then((data) => {
        setCustomers(data.customers ?? [])
      })
      .catch(() => setCustomers([]))
      .finally(() => setCustomersLoading(false))

    fetch("/api/events", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { events: [] }))
      .then((data) => setEvents((data.events ?? []).map((e: any) => ({ id: e.id, name: e.name, eventNumber: e.eventNumber }))))
      .catch(() => {})
  }, [])

  // When a customer is selected, autofill delivery address from their record
  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === customerId),
    [customers, customerId],
  )
  useEffect(() => {
    if (selectedCustomer?.address && !deliveryAddress) {
      setDeliveryAddress(selectedCustomer.address)
    }
  }, [selectedCustomer, deliveryAddress])

  function setQty(sku: string, qty: number) {
    setQuantities((prev) => {
      const next = { ...prev }
      if (qty <= 0) {
        delete next[sku]
      } else {
        next[sku] = qty
      }
      return next
    })
  }

  function resetForm() {
    setCustomerId("")
    setEventId("")
    setDeliveryDate("")
    setDeliveryAddress("")
    setCardMessage("")
    setDeliveryNotes("")
    setInternalNotes("")
    setDeliveryFee(DELIVERY_FLAT_RATE)
    setDiscount(0)
    setQuantities({})
  }

  // Compute totals
  const lineItems = useMemo(() => {
    return products
      .filter((p) => quantities[p.sku] > 0)
      .map((p) => ({
        productSku: p.sku,
        productName: p.name,
        productSize: p.size,
        qty: quantities[p.sku],
        unitPrice: p.actualPriceBeforeIva,
        lineTotal: p.actualPriceBeforeIva * quantities[p.sku],
      }))
  }, [products, quantities])

  const subtotal = lineItems.reduce((s, li) => s + li.lineTotal, 0)
  const iva = subtotal * 0.16
  const total = subtotal + iva + (deliveryFee || 0) - (discount || 0)

  async function handleSubmit() {
    // Validation
    if (!customerId || customerId === "_new_customer") {
      toast.error("Please select a customer")
      return
    }
    if (lineItems.length === 0) {
      toast.error("Add at least one bouquet to the order")
      return
    }

    // If no delivery date, show confirmation dialog
    if (!deliveryDate) {
      setShowNoDateConfirm(true)
      return
    }

    await doCreateOrder()
  }

  async function doCreateOrder() {
    setSubmitting(true)
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          eventId: eventId || undefined,
          deliveryDate: deliveryDate || undefined,
          deliveryAddress: deliveryAddress || undefined,
          cardMessage: cardMessage || undefined,
          deliveryNotes: deliveryNotes || undefined,
          internalNotes: internalNotes || undefined,
          deliveryFee: deliveryFee ?? 100,
          discount: discount ?? 0,
          lineItems: lineItems.map((li) => ({
            productSku: li.productSku,
            qty: li.qty,
          })),
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${res.status}`)
      }
      const data = await res.json()
      toast.success(`Order ${data.order.orderNumber} created`)
      resetForm()
      // Switch to Orders tab
      router.push("/?tab=orders")
    } catch (e) {
      toast.error("Failed to create order", {
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setSubmitting(false)
    }
  }

  if (catalogueLoading && products.length === 0) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 rounded-lg bg-stone-100 animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="border-rose-200 bg-rose-50/40 p-5">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="h-5 w-5 text-rose-700" />
          <h2 className="text-lg font-semibold text-stone-800">New Order</h2>
        </div>
        <p className="text-xs text-stone-600">
          Capture a customer order with delivery details, notes, and quantities.
          Saved as a draft — advance the pipeline in the Orders tab once payment is confirmed.
        </p>
      </Card>

      {/* Customer + delivery details (top of form) */}
      <Card className="bg-white p-4 space-y-3">
        <h3 className="text-sm font-semibold text-stone-800 flex items-center gap-1.5">
          <User className="h-4 w-4 text-stone-400" />
          Customer &amp; delivery
        </h3>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label htmlFor="customer" className="text-xs">Customer *</Label>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger id="customer">
                <SelectValue placeholder="Select customer…" />
              </SelectTrigger>
              <SelectContent>
                {customersLoading ? (
                  <SelectItem value="_loading" disabled>Loading…</SelectItem>
                ) : (
                  <>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}{c.phone ? ` · ${c.phone}` : ""}
                      </SelectItem>
                    ))}
                    <SelectItem value="_new_customer">
                      ➕ New customer…
                    </SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
            {customerId === "_new_customer" && (
              <NewCustomerInline
                onCreated={(c) => {
                  setCustomers(prev => [...prev, c].sort((a, b) => a.name.localeCompare(b.name)))
                  setCustomerId(c.id)
                }}
                onCancel={() => setCustomerId("")}
              />
            )}
            {selectedCustomer && customerId !== "_new_customer" && (
              <p className="text-[10px] text-stone-500 mt-1">
                {selectedCustomer.email && <>{selectedCustomer.email}<br /></>}
                {selectedCustomer.address}
              </p>
            )}
          </div>
          <div>
            <Label htmlFor="deliveryDate" className="text-xs flex items-center gap-1">
              <CalendarClock className="h-3 w-3" /> Delivery date
            </Label>
            <Input
              id="deliveryDate"
              type="date"
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="event" className="text-xs flex items-center gap-1">
              <PartyPopper className="h-3 w-3" /> Is this part of an event?
            </Label>
            <Select value={eventId || "_none"} onValueChange={(v) => setEventId(v === "_none" ? "" : v)}>
              <SelectTrigger id="event">
                <SelectValue placeholder="None — standalone order" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">None — standalone order</SelectItem>
                {events.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.eventNumber} · {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="deliveryAddress" className="text-xs flex items-center gap-1">
              <Truck className="h-3 w-3" /> Delivery address
            </Label>
            <Input
              id="deliveryAddress"
              value={deliveryAddress}
              onChange={(e) => setDeliveryAddress(e.target.value)}
              placeholder="Calle, número, colonia, ciudad"
            />
            {selectedCustomer?.address && deliveryAddress === selectedCustomer.address && (
              <p className="text-[10px] text-stone-500 mt-1 italic">Auto-filled from customer record</p>
            )}
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-2 pt-2 border-t border-stone-200">
          <div>
            <Label htmlFor="cardMessage" className="text-xs flex items-center gap-1 text-rose-700">
              <Sparkles className="h-3 w-3" /> Card message
            </Label>
            <Textarea
              id="cardMessage"
              value={cardMessage}
              onChange={(e) => setCardMessage(e.target.value)}
              placeholder="Para mi amor, feliz cumpleaños — Juan"
              className="text-sm"
              rows={2}
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-2">
            <div>
              <Label htmlFor="deliveryNotes" className="text-xs">Delivery notes</Label>
              <Textarea
                id="deliveryNotes"
                value={deliveryNotes}
                onChange={(e) => setDeliveryNotes(e.target.value)}
                placeholder="Tocar timbre 2 veces, perro en patio"
                className="text-sm"
                rows={2}
              />
            </div>
            <div>
              <Label htmlFor="internalNotes" className="text-xs text-amber-700">Internal notes</Label>
              <Textarea
                id="internalNotes"
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                placeholder="Cliente alérgica al polen de lirio"
                className="text-sm"
                rows={2}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Bouquet selection */}
      <Card className="bg-white p-4">
        <h3 className="text-sm font-semibold text-stone-800 mb-3 flex items-center gap-1.5">
          <Sparkles className="h-4 w-4 text-stone-400" />
          Bouquets in this order
        </h3>
        <div className="space-y-2">
          {products.map((p) => {
            const qty = quantities[p.sku] ?? 0
            return (
              <div
                key={p.sku}
                className={`flex items-center gap-3 rounded-md border p-2.5 transition-colors ${
                  qty > 0
                    ? "border-rose-300 bg-rose-50/30"
                    : "border-stone-200 bg-white"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-stone-800 text-sm truncate">
                    {p.name}
                    {p.size && <Badge variant="outline" className="ml-1.5 text-[10px] py-0">{p.size}</Badge>}
                  </div>
                  <div className="text-xs text-stone-500">
                    ${p.actualPriceBeforeIva.toLocaleString("es-MX")} ea
                  </div>
                </div>
                <div className="flex items-center rounded-md border border-stone-200 bg-stone-50 shrink-0">
                  <button
                    onClick={() => setQty(p.sku, qty - 1)}
                    className="p-1.5 hover:bg-stone-200 rounded-l-md transition-colors disabled:opacity-30"
                    disabled={qty === 0}
                    aria-label="Decrease"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <Input
                    type="number"
                    min={0}
                    value={qty || ""}
                    onChange={(e) => setQty(p.sku, parseInt(e.target.value) || 0)}
                    placeholder="0"
                    className="w-12 h-7 text-center text-sm border-0 bg-transparent px-0 focus-visible:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <button
                    onClick={() => setQty(p.sku, qty + 1)}
                    className="p-1.5 hover:bg-stone-200 rounded-r-md transition-colors"
                    aria-label="Increase"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
                <div className="text-right shrink-0 w-20">
                  <div className="font-semibold text-stone-900 text-sm">
                    ${(p.actualPriceBeforeIva * qty).toLocaleString("es-MX")}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      {/* Moneys */}
      {lineItems.length > 0 && (
        <Card className="border-rose-300 bg-gradient-to-br from-rose-50 via-pink-50 to-amber-50 p-5">
          <div className="flex items-center gap-2 mb-3">
            <DollarSign className="h-5 w-5 text-rose-700" />
            <h3 className="text-base font-semibold text-stone-800">Order total</h3>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3 py-2 px-3 rounded-md bg-white/70 border border-stone-200">
              <span className="text-sm text-stone-700">Subtotal (pre-IVA)</span>
              <span className="font-semibold text-stone-900">${subtotal.toLocaleString("es-MX")}</span>
            </div>
            <div className="flex items-center justify-between gap-3 py-2 px-3 rounded-md bg-white/70 border border-stone-200">
              <span className="text-sm text-stone-700">IVA (16%)</span>
              <span className="font-semibold text-stone-900">${Math.round(iva).toLocaleString("es-MX")}</span>
            </div>
            <div className="flex items-center justify-between gap-3 py-2 px-3 rounded-md bg-white/70 border border-stone-200">
              <Label htmlFor="fee" className="text-sm font-medium text-stone-700">Delivery fee</Label>
              <div className="flex items-center gap-1">
                <span className="text-stone-500 text-sm">$</span>
                <Input
                  id="fee"
                  type="number"
                  value={deliveryFee || ""}
                  onChange={(e) => setDeliveryFee(parseFloat(e.target.value) || 0)}
                  className="w-20 h-7 text-sm font-semibold text-stone-800 border-0 bg-transparent px-0 focus-visible:ring-0 text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 py-2 px-3 rounded-md bg-white/70 border border-stone-200">
              <Label htmlFor="disc" className="text-sm font-medium text-stone-700">Discount</Label>
              <div className="flex items-center gap-1">
                <span className="text-stone-500 text-sm">$</span>
                <Input
                  id="disc"
                  type="number"
                  value={discount || ""}
                  onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  className="w-20 h-7 text-sm font-semibold text-stone-800 border-0 bg-transparent px-0 focus-visible:ring-0 text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 py-3 px-3 rounded-md bg-emerald-50 border border-emerald-300">
              <span className="font-semibold text-emerald-800">Total due</span>
              <span className="text-xl font-bold text-emerald-900">
                ${Math.round(total).toLocaleString("es-MX")}
              </span>
            </div>
          </div>
        </Card>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2 sticky bottom-4">
        <Button
          onClick={handleSubmit}
          disabled={submitting || !customerId || lineItems.length === 0}
          className="flex-1 bg-rose-600 hover:bg-rose-700 text-white gap-2 shadow-lg"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          {submitting ? "Creating order…" : "Create order (draft)"}
        </Button>
        <Button variant="outline" onClick={resetForm} disabled={submitting} className="gap-1.5">
          <RotateCcw className="h-4 w-4" />
          Reset
        </Button>
      </div>

      {/* No delivery date confirmation */}
      <Dialog open={showNoDateConfirm} onOpenChange={setShowNoDateConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>No delivery date set</DialogTitle>
            <DialogDescription>
              Do you want to create this order without a delivery date?
              You can add one later, but orders without a delivery date won&apos;t appear
              in the Delivery View calendar.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNoDateConfirm(false)}>
              Go back — add date
            </Button>
            <Button
              onClick={async () => {
                setShowNoDateConfirm(false)
                await doCreateOrder()
              }}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              Create without date
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ============================================================
// NewCustomerInline — inline form to add a customer on the fly
// ============================================================

interface InlineCustomer {
  id: string
  name: string
  phone: string
  email: string
  address: string
}

function NewCustomerInline({
  onCreated,
  onCancel,
}: {
  onCreated: (customer: InlineCustomer) => void
  onCancel: () => void
}) {
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [address, setAddress] = useState("")
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Name is required")
      return
    }
    setSaving(true)
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), phone, email, address }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${res.status}`)
      }
      const data = await res.json()
      toast.success(`Customer added: ${data.customer.name}`)
      onCreated(data.customer)
    } catch (e) {
      toast.error("Failed to add customer", { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-2 rounded-md border border-rose-200 bg-rose-50/30 p-3 space-y-2">
      <div className="text-xs font-medium text-rose-700 flex items-center gap-1">
        <User className="h-3 w-3" /> New customer
      </div>
      <Input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Name *"
        className="h-7 text-xs"
        autoFocus
      />
      <div className="grid grid-cols-2 gap-2">
        <Input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Phone / WhatsApp"
          className="h-7 text-xs"
        />
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="h-7 text-xs"
        />
      </div>
      <Input
        type="text"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        placeholder="Address"
        className="h-7 text-xs"
      />
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={handleSave} disabled={saving || !name.trim()} className="bg-rose-600 hover:bg-rose-700 text-white text-xs gap-1">
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
          Save
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel} className="text-xs">
          Cancel
        </Button>
      </div>
    </div>
  )
}
