"use client"

import { useEffect, useState, useMemo } from "react"
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
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  CalendarDays,
  Plus,
  Trash2,
  Link2,
  Unlink,
  Loader2,
  Users,
  DollarSign,
  ArrowLeft,
  ChevronRight,
} from "lucide-react"
import { toast } from "sonner"

interface EventOrder {
  id: string
  orderNumber: string
  status: string
  customerName: string | null
  deliveryDate: string | null
  lineItems: { productName: string; qty: number; unitPrice: number; lineTotal: number }[]
}

interface EventItem {
  id: string
  eventNumber: string
  name: string
  customerId: string | null
  customerName: string | null
  eventDate: string | null
  guests: number | null
  status: string
  notes: string
  orderCount: number
  totalRevenue: number
  orders: EventOrder[]
  createdAt: string
}

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  quote: { label: "Quote", className: "bg-stone-100 text-stone-700 border-stone-200" },
  confirmed: { label: "Confirmed", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  in_progress: { label: "In progress", className: "bg-blue-100 text-blue-800 border-blue-200" },
  completed: { label: "Completed", className: "bg-purple-100 text-purple-800 border-purple-200" },
  cancelled: { label: "Cancelled", className: "bg-red-100 text-red-800 border-red-200" },
}

export function EventsTab() {
  const [events, setEvents] = useState<EventItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [customers, setCustomers] = useState<{ id: string; name: string; phone: string }[]>([])

  const [form, setForm] = useState({ name: "", customerId: "", eventDate: "", guests: "", notes: "" })

  async function fetchEvents() {
    setLoading(true)
    try {
      const res = await fetch("/api/events", { cache: "no-store" })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setEvents(data.events ?? [])
    } catch (e) {
      toast.error("Failed to load events", { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchEvents()
    fetch("/api/customers", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { customers: [] }))
      .then((data) => setCustomers(data.customers ?? []))
      .catch(() => {})
  }, [])

  async function handleCreate() {
    if (!form.name.trim()) {
      toast.error("Event name is required")
      return
    }
    setSaving(true)
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          customerId: form.customerId || undefined,
          eventDate: form.eventDate || undefined,
          guests: form.guests ? parseInt(form.guests) : undefined,
          notes: form.notes || undefined,
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      toast.success("Event created")
      setForm({ name: "", customerId: "", eventDate: "", guests: "", notes: "" })
      setAddOpen(false)
      await fetchEvents()
    } catch (e) {
      toast.error("Failed to create event", { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setSaving(false)
    }
  }

  async function handleLinkOrder(eventId: string, orderNumber: string) {
    try {
      const res = await fetch(`/api/events/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ linkOrderId: orderNumber }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      toast.success(`Linked ${orderNumber} to event`)
      await fetchEvents()
    } catch (e) {
      toast.error("Failed to link order", { description: e instanceof Error ? e.message : String(e) })
    }
  }

  async function handleUnlinkOrder(eventId: string, orderNumber: string) {
    try {
      const res = await fetch(`/api/events/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unlinkOrderId: orderNumber }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      toast.success(`Unlinked ${orderNumber}`)
      await fetchEvents()
    } catch (e) {
      toast.error("Failed to unlink order", { description: e instanceof Error ? e.message : String(e) })
    }
  }

  async function handleStatusChange(eventId: string, status: string) {
    try {
      const res = await fetch(`/api/events/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      await fetchEvents()
    } catch (e) {
      toast.error("Failed to update status", { description: e instanceof Error ? e.message : String(e) })
    }
  }

  async function handleDelete(eventId: string) {
    try {
      const res = await fetch(`/api/events/${eventId}`, { method: "DELETE" })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      toast.success("Event deleted")
      setSelectedId(null)
      await fetchEvents()
    } catch (e) {
      toast.error("Failed to delete event", { description: e instanceof Error ? e.message : String(e) })
    }
  }

  // Detail view
  if (selectedId) {
    const event = events.find((e) => e.id === selectedId)
    if (event) {
      return (
        <EventDetail
          event={event}
          onBack={() => setSelectedId(null)}
          onLinkOrder={(orderNumber) => handleLinkOrder(event.id, orderNumber)}
          onUnlinkOrder={(orderNumber) => handleUnlinkOrder(event.id, orderNumber)}
          onStatusChange={(status) => handleStatusChange(event.id, status)}
          onDelete={() => handleDelete(event.id)}
        />
      )
    }
    setSelectedId(null)
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="border-rose-200 bg-rose-50/40 p-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-rose-700" />
            <h2 className="text-lg font-semibold text-stone-800">Events</h2>
            {events.length > 0 && (
              <Badge variant="outline" className="text-xs">{events.length} total</Badge>
            )}
          </div>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button className="bg-rose-600 hover:bg-rose-700 text-white gap-1.5">
                <Plus className="h-4 w-4" />
                New Event
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Create event</DialogTitle>
                <DialogDescription>
                  Bundle multiple orders under one event (wedding, corporate, etc.)
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="ev-name" className="text-xs">Event name *</Label>
                  <Input
                    id="ev-name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Boda de María y Juan"
                    autoFocus
                  />
                </div>
                <div>
                  <Label className="text-xs">Customer (optional)</Label>
                  <Select value={form.customerId} onValueChange={(v) => setForm({ ...form, customerId: v })}>
                    <SelectTrigger><SelectValue placeholder="Select customer…" /></SelectTrigger>
                    <SelectContent>
                      {customers.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="ev-date" className="text-xs">Event date</Label>
                    <Input id="ev-date" type="date" value={form.eventDate} onChange={(e) => setForm({ ...form, eventDate: e.target.value })} />
                  </div>
                  <div>
                    <Label htmlFor="ev-guests" className="text-xs">Guests</Label>
                    <Input id="ev-guests" type="number" value={form.guests} onChange={(e) => setForm({ ...form, guests: e.target.value })} placeholder="—" />
                  </div>
                </div>
                <div>
                  <Label htmlFor="ev-notes" className="text-xs">Notes</Label>
                  <Textarea id="ev-notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="Theme, colors, special requests…" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
                <Button onClick={handleCreate} disabled={saving || !form.name.trim()} className="bg-rose-600 hover:bg-rose-700 text-white gap-1.5">
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  Create event
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </Card>

      {/* Event list */}
      <Card className="bg-white p-4">
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <div key={i} className="h-20 rounded-md bg-stone-100 animate-pulse" />)}
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-10">
            <CalendarDays className="h-10 w-10 mx-auto text-stone-300 mb-3" />
            <p className="text-stone-600 font-medium">No events yet</p>
            <p className="text-sm text-stone-400 mt-1">Create an event to bundle orders for weddings, corporate events, etc.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {events.map((ev) => {
              const badge = STATUS_BADGES[ev.status] ?? { label: ev.status, className: "" }
              return (
                <button
                  key={ev.id}
                  onClick={() => setSelectedId(ev.id)}
                  className="w-full text-left rounded-lg border border-stone-200 bg-white p-3 hover:border-rose-300 hover:shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-rose-300"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-stone-800">{ev.name}</span>
                        <Badge variant="outline" className={`text-[10px] ${badge.className}`}>{badge.label}</Badge>
                      </div>
                      <div className="text-xs text-stone-500 mt-0.5">
                        {ev.eventNumber}
                        {ev.customerName && ` · ${ev.customerName}`}
                        {ev.eventDate && ` · ${new Date(ev.eventDate + "T00:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short" })}`}
                        {ev.guests && ` · ${ev.guests} guests`}
                      </div>
                      <div className="text-xs text-stone-400 mt-0.5">
                        {ev.orderCount} order{ev.orderCount !== 1 ? "s" : ""} · ${ev.totalRevenue.toLocaleString("es-MX")}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-stone-300 shrink-0" />
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}

function EventDetail({
  event,
  onBack,
  onLinkOrder,
  onUnlinkOrder,
  onStatusChange,
  onDelete,
}: {
  event: EventItem
  onBack: () => void
  onLinkOrder: (orderNumber: string) => void
  onUnlinkOrder: (orderNumber: string) => void
  onStatusChange: (status: string) => void
  onDelete: () => void
}) {
  const [linkOpen, setLinkOpen] = useState(false)
  const [availableOrders, setAvailableOrders] = useState<EventOrder[]>([])
  const [linkOrderNumber, setLinkOrderNumber] = useState("")

  async function fetchAvailableOrders() {
    try {
      const res = await fetch("/api/orders", { cache: "no-store" })
      if (!res.ok) return
      const data = await res.json()
      // Show orders not already linked to this event
      const linked = new Set(event.orders.map((o) => o.id))
      setAvailableOrders((data.orders ?? []).filter((o: any) => !linked.has(o.id)))
    } catch {}
  }

  const badge = STATUS_BADGES[event.status] ?? { label: event.status, className: "" }

  return (
    <div className="space-y-4">
      {/* Back + actions */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" />
          Back to events
        </Button>
        <div className="flex items-center gap-2">
          <Select value={event.status} onValueChange={onStatusChange}>
            <SelectTrigger className="h-7 text-xs w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="quote">Quote</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="in_progress">In progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={onDelete} className="text-rose-700 hover:bg-rose-50">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Event header */}
      <Card className="border-rose-200 bg-rose-50/40 p-5">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold text-stone-800">{event.name}</h2>
              <Badge variant="outline" className={badge.className}>{badge.label}</Badge>
            </div>
            <div className="mt-2 space-y-0.5 text-xs text-stone-500">
              <div>{event.eventNumber}{event.customerName && ` · ${event.customerName}`}</div>
              {event.eventDate && (
                <div className="text-rose-700 font-medium">
                  Event date: {new Date(event.eventDate + "T00:00:00").toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                </div>
              )}
              {event.guests && <div>{event.guests} guests</div>}
              {event.notes && <div className="mt-1 italic">"{event.notes}"</div>}
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-stone-900">${event.totalRevenue.toLocaleString("es-MX")}</div>
            <div className="text-xs text-stone-500">{event.orderCount} order{event.orderCount !== 1 ? "s" : ""}</div>
          </div>
        </div>
      </Card>

      {/* Linked orders */}
      <Card className="bg-white p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-stone-800">Linked Orders ({event.orders.length})</h3>
          <Dialog open={linkOpen} onOpenChange={(o) => { setLinkOpen(o); if (o) fetchAvailableOrders() }}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                <Link2 className="h-3.5 w-3.5" />
                Link order
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Link order to event</DialogTitle>
                <DialogDescription>Select an existing order to add to this event.</DialogDescription>
              </DialogHeader>
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {availableOrders.length === 0 ? (
                  <p className="text-sm text-stone-400 text-center py-4">No available orders to link</p>
                ) : (
                  availableOrders.map((o) => (
                    <button
                      key={o.id}
                      onClick={() => { onLinkOrder(o.orderNumber); setLinkOpen(false) }}
                      className="w-full text-left rounded-md border border-stone-200 p-2.5 text-sm hover:border-rose-300 hover:bg-rose-50/30 transition-colors"
                    >
                      <div className="font-medium text-stone-800">{o.orderNumber}</div>
                      <div className="text-xs text-stone-500">
                        {o.customerName ?? "—"}
                        {o.deliveryDate && ` · deliver ${new Date(o.deliveryDate + "T00:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short" })}`}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {event.orders.length === 0 ? (
          <p className="text-sm text-stone-400 text-center py-4">No orders linked yet. Click "Link order" to add.</p>
        ) : (
          <div className="space-y-2">
            {event.orders.map((o) => {
              const total = o.lineItems.reduce((s, li) => s + li.lineTotal, 0)
              return (
                <div key={o.id} className="rounded-lg border border-stone-200 p-3 text-sm">
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-stone-800">{o.orderNumber}</span>
                        <Badge variant="outline" className="text-[10px] py-0">{o.status.replace(/_/g, " ")}</Badge>
                      </div>
                      <div className="text-xs text-stone-500 mt-0.5">
                        {o.customerName ?? "—"}
                        {o.deliveryDate && ` · deliver ${new Date(o.deliveryDate + "T00:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short" })}`}
                      </div>
                      <div className="mt-1 text-xs text-stone-500">
                        {o.lineItems.map((li, i) => (
                          <span key={i}>
                            {i > 0 && " · "}
                            {li.productName} ×{li.qty}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-semibold text-stone-800">${total.toLocaleString("es-MX")}</span>
                      <button
                        onClick={() => onUnlinkOrder(o.orderNumber)}
                        className="text-stone-300 hover:text-rose-600 p-1"
                        aria-label="Unlink order"
                      >
                        <Unlink className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* Summary */}
      {event.orders.length > 0 && (
        <Card className="bg-white p-4 space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-stone-600">Total orders</span>
            <span className="font-medium">{event.orderCount}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-stone-600">Total bouquets</span>
            <span className="font-medium">
              {event.orders.reduce((s, o) => s + o.lineItems.reduce((ls, li) => ls + li.qty, 0), 0)}
            </span>
          </div>
          <div className="flex justify-between pt-1.5 border-t border-stone-100">
            <span className="text-stone-700 font-medium">Total revenue</span>
            <span className="font-semibold text-emerald-700">${event.totalRevenue.toLocaleString("es-MX")}</span>
          </div>
        </Card>
      )}
    </div>
  )
}
