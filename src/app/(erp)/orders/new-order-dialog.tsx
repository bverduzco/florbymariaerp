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

type CustomerOption = { id: string; name: string }
type ProductOption = { sku: string; name: string; size: string | null; actualPriceBeforeIva: number }

export function NewOrderDialog({ customers, products }: { customers: CustomerOption[]; products: ProductOption[] }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    customerId: "",
    productSku: "",
    qty: "1",
    deliveryDate: "",
    deliveryAddress: "",
    cardMessage: "",
    internalNotes: "",
  })
  const router = useRouter()

  const selectedProduct = products.find((p) => p.sku === form.productSku)
  const lineTotal = selectedProduct ? selectedProduct.actualPriceBeforeIva * Number(form.qty || 0) : 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.customerId || !form.productSku || !form.qty) return
    setLoading(true)
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: form.customerId,
          deliveryDate: form.deliveryDate || undefined,
          deliveryAddress: form.deliveryAddress || undefined,
          cardMessage: form.cardMessage || undefined,
          internalNotes: form.internalNotes || undefined,
          lineItems: [
            {
              productSku: form.productSku,
              productName: selectedProduct?.name ?? "",
              productSize: selectedProduct?.size ?? undefined,
              qty: Number(form.qty),
              unitPrice: selectedProduct?.actualPriceBeforeIva ?? 0,
            },
          ],
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed")
      const data = await res.json()
      toast.success("Order created", {
        description: data.order?.orderNumber ?? `for ${selectedProduct?.name ?? ""}`,
      })
      setOpen(false)
      setForm({ customerId: "", productSku: "", qty: "1", deliveryDate: "", deliveryAddress: "", cardMessage: "", internalNotes: "" })
      router.refresh()
    } catch (e) {
      toast.error("Failed to create order", { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="px-4 py-2 text-sm font-medium bg-stone-900 text-white rounded-md hover:bg-stone-800 transition">
          + New Order
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>New Order</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>Customer *</Label>
            <Select value={form.customerId} onValueChange={(v) => setForm({ ...form, customerId: v })} required>
              <SelectTrigger><SelectValue placeholder="Select customer..." /></SelectTrigger>
              <SelectContent className="max-h-[250px]">
                {customers.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Product *</Label>
              <Select value={form.productSku} onValueChange={(v) => setForm({ ...form, productSku: v })} required>
                <SelectTrigger><SelectValue placeholder="Select product..." /></SelectTrigger>
                <SelectContent className="max-h-[250px]">
                  {products.map((p) => (
                    <SelectItem key={p.sku} value={p.sku}>
                      {p.name} {p.size ? `(${p.size})` : ""} — ${p.actualPriceBeforeIva}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
          </div>
          {selectedProduct && Number(form.qty) > 0 && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-md text-sm text-emerald-800">
              <div className="text-xs uppercase tracking-wider">Line total (before IVA)</div>
              <div className="text-lg font-bold">
                ${lineTotal.toLocaleString("es-MX", { maximumFractionDigits: 2 })} MXN
              </div>
              <div className="text-xs mt-1">
                {form.qty} × ${selectedProduct.actualPriceBeforeIva}/unit
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="deliveryDate">Delivery date</Label>
              <Input id="deliveryDate" type="date" value={form.deliveryDate} onChange={(e) => setForm({ ...form, deliveryDate: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deliveryAddress">Delivery address</Label>
              <Input id="deliveryAddress" value={form.deliveryAddress} onChange={(e) => setForm({ ...form, deliveryAddress: e.target.value })} placeholder="Street, city..." />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cardMessage">Card message</Label>
            <Textarea id="cardMessage" value={form.cardMessage} onChange={(e) => setForm({ ...form, cardMessage: e.target.value })} placeholder="Gift card message..." rows={2} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="internalNotes">Internal notes</Label>
            <Textarea id="internalNotes" value={form.internalNotes} onChange={(e) => setForm({ ...form, internalNotes: e.target.value })} placeholder="Notes for production..." rows={2} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={loading || !form.customerId || !form.productSku}>
              {loading ? "Creating..." : "✓ Create Order"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
