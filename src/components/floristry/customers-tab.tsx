"use client"

import { useEffect, useState } from "react"
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
import { Users, UserPlus, Phone, Mail, MapPin, Loader2 } from "lucide-react"
import { toast } from "sonner"

interface Customer {
  id: string
  name: string
  phone: string
  email: string
  address: string
  notes: string
  createdAt: string
}

export function CustomersTab() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Form state for new customer
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
      // Reset form + close dialog
      setForm({ name: "", phone: "", email: "", address: "", notes: "" })
      setDialogOpen(false)
    } catch (e) {
      toast.error("Failed to add customer", {
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setSubmitting(false)
    }
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

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
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
                  <Label htmlFor="name" className="text-xs">
                    Name *
                  </Label>
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
                  <Label htmlFor="phone" className="text-xs">
                    Phone / WhatsApp
                  </Label>
                  <Input
                    id="phone"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="55 1234 5678"
                  />
                </div>
                <div>
                  <Label htmlFor="email" className="text-xs">
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="maria@example.com"
                  />
                </div>
                <div>
                  <Label htmlFor="address" className="text-xs">
                    Address
                  </Label>
                  <Input
                    id="address"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    placeholder="Calle Principal 123, Colonia, CDMX"
                  />
                </div>
                <div>
                  <Label htmlFor="notes" className="text-xs">
                    Notes
                  </Label>
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
                    onClick={() => setDialogOpen(false)}
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

      {/* Customer list */}
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
              <div
                key={c.id}
                className="rounded-lg border border-stone-200 bg-stone-50/50 p-3 hover:border-rose-200 hover:bg-rose-50/30 transition-colors"
              >
                <div className="font-medium text-stone-800">{c.name}</div>
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
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
