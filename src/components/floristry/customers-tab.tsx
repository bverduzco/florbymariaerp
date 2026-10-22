"use client"

import { useEffect, useMemo, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  Users,
  UserPlus,
  Phone,
  Mail,
  MapPin,
  Loader2,
  Pencil,
  Trash2,
  ArrowLeft,
  CalendarClock,
  Package,
  Flower2,
} from "lucide-react"
import { toast } from "sonner"
import { useCatalogue } from "@/lib/catalogue-store"
import { usePlanStore } from "@/lib/plan-store"

interface Customer {
  id: string
  name: string
  phone: string
  email: string
  address: string
  notes: string
  createdAt: string
  updatedAt?: string
}

interface OrderHistoryItem {
  productSku: string
  productName: string
  productSize: string
  qty: number
  deliveryDate: string | null
  price: number
  productCost: number
  isCustom?: boolean
  orderNumber?: string | null
  orderStatus?: string | null
}

export function CustomersTab() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)

  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    notes: "",
  })

  async function fetchCustomers() {
    setLoading(true)
    try {
      const res = await fetch("/api/customers", { cache: "no-store" })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setCustomers(data.customers ?? [])
    } catch (e) {
      toast.error("Failed to load customers", {
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCustomers()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) {
      toast.error("Customer name is required")
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${res.status}`)
      }
      const data = await res.json()
      setCustomers((prev) =>
        [...prev, data.customer].sort((a, b) => a.name.localeCompare(b.name)),
      )
      toast.success(`Added customer: ${data.customer.name}`)
      setForm({ name: "", phone: "", email: "", address: "", notes: "" })
      setAddDialogOpen(false)
    } catch (e) {
      toast.error("Failed to add customer", {
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setSubmitting(false)
    }
  }

  // Detail view
  if (selectedCustomerId) {
    const customer = customers.find((c) => c.id === selectedCustomerId)
    if (customer) {
      return (
        <CustomerDetail
          customer={customer}
          onBack={() => setSelectedCustomerId(null)}
          onUpdate={(updated) => {
            setCustomers((prev) =>
              [...prev.filter((c) => c.id !== updated.id), updated].sort((a, b) =>
                a.name.localeCompare(b.name),
              ),
            )
          }}
          onDelete={() => {
            setCustomers((prev) => prev.filter((c) => c.id !== customer.id))
            setSelectedCustomerId(null)
            toast.success(`Deleted customer: ${customer.name}`)
          }}
        />
      )
    }
    // Customer was deleted while viewing
    setSelectedCustomerId(null)
  }

  return (
    <div className="space-y-4">
      <Card className="border-rose-200 bg-rose-50/40 p-5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-rose-700" />
            <h2 className="text-lg font-semibold text-stone-800">Customers</h2>
            {customers.length > 0 && (
              <Badge variant="outline" className="text-xs">
                {customers.length} total
              </Badge>
            )}
          </div>

          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-rose-600 hover:bg-rose-700 text-white gap-1.5">
                <UserPlus className="h-4 w-4" />
                Add Customer
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Add new customer</DialogTitle>
                <DialogDescription>
                  Add a customer record. You can reference them later when planning bouquets.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <Label htmlFor="name" className="text-xs">Name *</Label>
                  <Input
                    id="name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="María González"
                    required
                    autoFocus
                  />
                </div>
                <div>
                  <Label htmlFor="phone" className="text-xs">Phone / WhatsApp</Label>
                  <Input
                    id="phone"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="55 1234 5678"
                  />
                </div>
                <div>
                  <Label htmlFor="email" className="text-xs">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="maria@example.com"
                  />
                </div>
                <div>
                  <Label htmlFor="address" className="text-xs">Address</Label>
                  <Input
                    id="address"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    placeholder="Calle Principal 123, Colonia, CDMX"
                  />
                </div>
                <div>
                  <Label htmlFor="notes" className="text-xs">Notes</Label>
                  <Input
                    id="notes"
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    placeholder="Prefiere rosas blancas, alergia al polen de girasol, etc."
                  />
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setAddDialogOpen(false)}
                    disabled={submitting}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="bg-rose-600 hover:bg-rose-700 text-white gap-1.5"
                  >
                    {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                    Save Customer
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </Card>

      <Card className="bg-white p-4">
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-md bg-stone-100 animate-pulse" />
            ))}
          </div>
        ) : customers.length === 0 ? (
          <div className="text-center py-10">
            <Users className="h-10 w-10 mx-auto text-stone-300 mb-3" />
            <p className="text-stone-600 font-medium">No customers yet</p>
            <p className="text-sm text-stone-400 mt-1">
              Click &quot;Add Customer&quot; above to create your first customer record.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {customers.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedCustomerId(c.id)}
                className="text-left rounded-lg border border-stone-200 bg-stone-50/50 p-3 hover:border-rose-300 hover:bg-rose-50/30 hover:shadow-sm transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-rose-300"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="font-medium text-stone-800">{c.name}</div>
                  <Pencil className="h-3 w-3 text-stone-400 shrink-0 mt-0.5" />
                </div>
                <div className="mt-1.5 space-y-1 text-xs text-stone-600">
                  {c.phone && (
                    <div className="flex items-center gap-1.5">
                      <Phone className="h-3 w-3 text-stone-400 shrink-0" />
                      <span>{c.phone}</span>
                    </div>
                  )}
                  {c.email && (
                    <div className="flex items-center gap-1.5">
                      <Mail className="h-3 w-3 text-stone-400 shrink-0" />
                      <span className="truncate">{c.email}</span>
                    </div>
                  )}
                  {c.address && (
                    <div className="flex items-start gap-1.5">
                      <MapPin className="h-3 w-3 text-stone-400 shrink-0 mt-0.5" />
                      <span className="text-stone-600">{c.address}</span>
                    </div>
                  )}
                </div>
                {c.notes && (
                  <div className="mt-2 pt-2 border-t border-stone-200 text-xs text-stone-500 italic">
                    &ldquo;{c.notes}&rdquo;
                  </div>
                )}
                <div className="mt-2 text-[10px] text-stone-400">
                  Added {new Date(c.createdAt).toLocaleDateString("es-MX")}
                </div>
              </button>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

// ============================================================
// Customer Detail View
// ============================================================

function CustomerDetail({
  customer,
  onBack,
  onUpdate,
  onDelete,
}: {
  customer: Customer
  onBack: () => void
  onUpdate: (updated: Customer) => void
  onDelete: () => void
}) {
  const products = useCatalogue((s) => s.products)
  const planItems = usePlanStore((s) => s.items)

  // Fetch real Orders from the API
  const [orders, setOrders] = useState<any[]>([])
  useEffect(() => {
    fetch("/api/orders", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { orders: [] }))
      .then((data) => setOrders(data.orders ?? []))
      .catch(() => {})
  }, [])

  // Compute order history from BOTH sources:
  // 1. Real Orders from the API (where customerName matches)
  // 2. Legacy plan items from localStorage (where customerName matches)
  const orderHistory = useMemo<OrderHistoryItem[]>(() => {
    const items: OrderHistoryItem[] = []

    // Source 1: Real Orders
    for (const o of orders) {
      if (o.customerName?.trim().toLowerCase() !== customer.name.trim().toLowerCase()) continue
      for (const li of o.lineItems ?? []) {
        // For custom bouquets (PRD-CUSTOM-XXXX), the productName contains the full breakdown
        const isCustom = li.productSku?.startsWith("PRD-CUSTOM-")
        items.push({
          productSku: li.productSku,
          productName: li.productName, // includes breakdown for custom
          productSize: li.productSize ?? "",
          qty: li.qty,
          deliveryDate: o.deliveryDate,
          price: li.unitPrice,
          productCost: 0, // unknown for custom — use 0
          isCustom: isCustom,
          orderNumber: o.orderNumber,
          orderStatus: o.status,
        })
      }
    }

    // Source 2: Legacy plan items (localStorage)
    const matches = planItems.filter(
      (i) => i.customerName?.trim().toLowerCase() === customer.name.trim().toLowerCase(),
    )
    for (const it of matches) {
      const p = products.find((pr) => pr.sku === it.productSku)
      if (!p) continue
      items.push({
        productSku: p.sku,
        productName: p.name,
        productSize: p.size ?? "",
        qty: it.qty,
        deliveryDate: it.deliveryDate,
        price: p.actualPriceBeforeIva,
        productCost: p.totalCost,
        isCustom: false,
        orderNumber: null,
        orderStatus: null,
      })
    }

    return items
  }, [orders, planItems, products, customer])

  const totalSpent = orderHistory.reduce((s, o) => s + o.price * o.qty, 0)
  const totalCost = orderHistory.reduce((s, o) => s + o.productCost * o.qty, 0)
  const totalProfit = totalSpent - totalCost

  return (
    <div className="space-y-4">
      {/* Back button + title */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" />
          Back to customers
        </Button>
        <div className="flex gap-2">
          <EditCustomerDialog
            customer={customer}
            onUpdated={(updated) => {
              onUpdate(updated)
              toast.success(`Updated customer: ${updated.name}`)
            }}
          />
          <DeleteCustomerDialog customer={customer} onDeleted={onDelete} />
        </div>
      </div>

      {/* Customer info card */}
      <Card className="border-rose-200 bg-rose-50/40 p-5">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <h2 className="text-xl font-semibold text-stone-800">{customer.name}</h2>
            <p className="text-xs text-stone-500 mt-0.5">
              Added {new Date(customer.createdAt).toLocaleDateString("es-MX")}
              {customer.updatedAt && customer.updatedAt !== customer.createdAt && (
                <> · Updated {new Date(customer.updatedAt).toLocaleDateString("es-MX")}</>
              )}
            </p>
          </div>
        </div>

        <div className="mt-4 grid sm:grid-cols-2 gap-3 text-sm">
          {customer.phone && (
            <div className="flex items-start gap-2">
              <Phone className="h-4 w-4 text-stone-400 mt-0.5 shrink-0" />
              <div>
                <div className="text-[10px] uppercase tracking-wide text-stone-500">Phone / WhatsApp</div>
                <div className="text-stone-800">{customer.phone}</div>
              </div>
            </div>
          )}
          {customer.email && (
            <div className="flex items-start gap-2">
              <Mail className="h-4 w-4 text-stone-400 mt-0.5 shrink-0" />
              <div>
                <div className="text-[10px] uppercase tracking-wide text-stone-500">Email</div>
                <div className="text-stone-800 break-all">{customer.email}</div>
              </div>
            </div>
          )}
          {customer.address && (
            <div className="flex items-start gap-2 sm:col-span-2">
              <MapPin className="h-4 w-4 text-stone-400 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-wide text-stone-500">Address</div>
                <div className="text-stone-800">{customer.address}</div>
              </div>
            </div>
          )}
          {customer.notes && (
            <div className="sm:col-span-2 rounded-md bg-amber-50 border border-amber-200 p-2.5 text-xs text-amber-800 italic">
              &ldquo;{customer.notes}&rdquo;
            </div>
          )}
        </div>
      </Card>

      {/* Stats summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="Orders"
          value={String(orderHistory.length)}
          icon={<Package className="h-3.5 w-3.5 text-stone-400" />}
        />
        <StatCard
          label="Bouquets"
          value={String(orderHistory.reduce((s, o) => s + o.qty, 0))}
          icon={<Package className="h-3.5 w-3.5 text-stone-400" />}
        />
        <StatCard
          label="Total Spent"
          value={`$${totalSpent.toLocaleString("es-MX")}`}
          icon={<Package className="h-3.5 w-3.5 text-stone-400" />}
        />
        <StatCard
          label="Est. Profit"
          value={`$${Math.round(totalProfit).toLocaleString("es-MX")}`}
          icon={<Package className="h-3.5 w-3.5 text-stone-400" />}
        />
      </div>

      {/* Order history */}
      <Card className="bg-white p-4">
        <h3 className="text-base font-semibold text-stone-800 mb-3">Order History</h3>
        {orderHistory.length === 0 ? (
          <div className="text-center py-8">
            <Package className="h-8 w-8 mx-auto text-stone-300 mb-2" />
            <p className="text-sm text-stone-500">No orders yet</p>
            <p className="text-xs text-stone-400 mt-1">
              When you add this customer&apos;s name to a plan item in the Catalogue or Weekly Plan tab,
              the order will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {orderHistory.map((o, i) => (
              <div
                key={`${o.productSku}-${i}`}
                className={`rounded-lg border p-3 text-sm ${
                  o.isCustom
                    ? "border-blue-200 bg-blue-50/30"
                    : "border-stone-200 bg-stone-50/50"
                }`}
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0 flex-1">
                    {/* Order number + status badge (for real Orders) */}
                    {o.orderNumber && (
                      <div className="flex items-center gap-1.5 mb-1 text-[10px] text-stone-500">
                        <Badge variant="outline" className="text-[10px] py-0 border-stone-300">
                          {o.orderNumber}
                        </Badge>
                        {o.orderStatus && (
                          <span className="text-stone-400">· {o.orderStatus.replace(/_/g, " ")}</span>
                        )}
                      </div>
                    )}
                    <div className="font-medium text-stone-800">
                      {o.isCustom && <Flower2 className="inline h-3 w-3 text-blue-500 mr-1" />}
                      {o.productName}
                      {o.productSize && (
                        <Badge variant="outline" className="ml-1.5 text-[10px] py-0">
                          {o.productSize}
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-stone-500 mt-0.5">SKU: {o.productSku}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-semibold text-stone-800">
                      ${o.price.toLocaleString("es-MX")}
                    </div>
                    <div className="text-xs text-stone-500">×{o.qty}</div>
                  </div>
                </div>
                {o.deliveryDate && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-rose-700 bg-rose-50 rounded px-2 py-1 w-fit">
                    <CalendarClock className="h-3 w-3" />
                    Deliver {new Date(o.deliveryDate + "T00:00:00").toLocaleDateString("es-MX", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string
  value: string
  icon?: React.ReactNode
}) {
  return (
    <div className="rounded-lg bg-white border border-stone-200 p-3">
      <div className="text-[10px] uppercase tracking-wide text-stone-500 flex items-center gap-1">
        {icon}
        {label}
      </div>
      <div className="text-base font-semibold text-stone-800 mt-1">{value}</div>
    </div>
  )
}

// ============================================================
// Edit Customer Dialog
// ============================================================

function EditCustomerDialog({
  customer,
  onUpdated,
}: {
  customer: Customer
  onUpdated: (updated: Customer) => void
}) {
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    name: customer.name,
    phone: customer.phone,
    email: customer.email,
    address: customer.address,
    notes: customer.notes,
  })

  // Reset form when dialog opens (in case customer changed externally)
  useEffect(() => {
    if (open) {
      setForm({
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        address: customer.address,
        notes: customer.notes,
      })
    }
  }, [open, customer])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) {
      toast.error("Customer name is required")
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/customers/${customer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${res.status}`)
      }
      const data = await res.json()
      onUpdated(data.customer)
      setOpen(false)
    } catch (e) {
      toast.error("Failed to update customer", {
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit customer</DialogTitle>
          <DialogDescription>Update this customer&apos;s details.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label htmlFor="edit-name" className="text-xs">Name *</Label>
            <Input
              id="edit-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              autoFocus
            />
          </div>
          <div>
            <Label htmlFor="edit-phone" className="text-xs">Phone / WhatsApp</Label>
            <Input
              id="edit-phone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="edit-email" className="text-xs">Email</Label>
            <Input
              id="edit-email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="edit-address" className="text-xs">Address</Label>
            <Input
              id="edit-address"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="edit-notes" className="text-xs">Notes</Label>
            <Input
              id="edit-notes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-rose-600 hover:bg-rose-700 text-white gap-1.5"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================
// Delete Customer Dialog (confirmation)
// ============================================================

function DeleteCustomerDialog({
  customer,
  onDeleted,
}: {
  customer: Customer
  onDeleted: () => void
}) {
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function handleDelete() {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/customers/${customer.id}`, { method: "DELETE" })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${res.status}`)
      }
      onDeleted()
      setOpen(false)
    } catch (e) {
      toast.error("Failed to delete customer", {
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 text-rose-700 hover:bg-rose-50 hover:text-rose-800">
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete customer</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete <strong>{customer.name}</strong>?
            This action cannot be undone. Plan items referencing this customer will keep the name as text only.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={handleDelete}
            disabled={submitting}
            variant="destructive"
            className="gap-1.5"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Delete Customer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
