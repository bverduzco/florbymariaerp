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

const EVENT_TYPES = [
  { value: "wedding", label: "💒 Wedding" },
  { value: "corporate", label: "🏢 Corporate" },
  { value: "quinceanera", label: "🎀 Quinceañera" },
  { value: "bridal_fair", label: "🎪 Bridal fair (unpaid)" },
  { value: "photo_shoot", label: "📸 Photo shoot (unpaid)" },
  { value: "birthday", label: "🎂 Birthday" },
  { value: "other", label: "📦 Other" },
]

export function NewEventDialog() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: "",
    eventType: "",
    eventDate: "",
    guests: "",
    notes: "",
  })
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name) return
    setLoading(true)
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          eventDate: form.eventDate || undefined,
          guests: form.guests ? Number(form.guests) : undefined,
          notes: form.notes
            ? `${form.eventType ? `[${form.eventType}] ` : ""}${form.notes}`
            : form.eventType
            ? `[${form.eventType}]`
            : undefined,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed")
      const data = await res.json()
      toast.success("Event created", { description: data.event?.eventNumber ?? form.name })
      setOpen(false)
      setForm({ name: "", eventType: "", eventDate: "", guests: "", notes: "" })
      router.refresh()
    } catch (e) {
      toast.error("Failed to create event", { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="px-4 py-2 text-sm font-medium bg-stone-900 text-white rounded-md hover:bg-stone-800 transition">
          + New Event
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>New Event</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="name">Event name *</Label>
            <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Boda de María y Carlos" required />
          </div>
          <div className="space-y-2">
            <Label>Event type</Label>
            <Select value={form.eventType} onValueChange={(v) => setForm({ ...form, eventType: v })}>
              <SelectTrigger><SelectValue placeholder="Select type..." /></SelectTrigger>
              <SelectContent>
                {EVENT_TYPES.map((t) => (<SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="eventDate">Event date</Label>
              <Input id="eventDate" type="date" value={form.eventDate} onChange={(e) => setForm({ ...form, eventDate: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="guests">Guests</Label>
              <Input id="guests" type="number" value={form.guests} onChange={(e) => setForm({ ...form, guests: e.target.value })} placeholder="e.g. 120" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="What does the customer want? Special requests..." rows={3} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={loading || !form.name}>
              {loading ? "Creating..." : "✓ Create Event"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
