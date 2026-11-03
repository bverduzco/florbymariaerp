"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"

type Marker = {
  id: string
  markerId: string
  name: string
  type: string
  startDate: string
  endDate: string | null
  color: string
  intensity: string | null
  description: string | null
  recurrence: string
}

const TYPES = [
  { value: "SEASON", label: "📅 Season (multi-day range)" },
  { value: "HOLIDAY", label: "🎉 Holiday (single day or range)" },
  { value: "TREND", label: "📈 Trend (market trend)" },
]

const COLORS = [
  { value: "#A78BFA", label: "🟣 Purple" },
  { value: "#F59E0B", label: "🟡 Amber" },
  { value: "#10B981", label: "🟢 Emerald" },
  { value: "#EF4444", label: "🔴 Red" },
  { value: "#3B82F6", label: "🔵 Blue" },
  { value: "#EC4899", label: "🩷 Pink" },
  { value: "#6366F1", label: "🟦 Indigo" },
  { value: "#78716C", label: "⬜ Stone" },
]

const INTENSITIES = [
  { value: "", label: "— None —" },
  { value: "HIGH", label: "High" },
  { value: "MEDIUM", label: "Medium" },
  { value: "LOW", label: "Low" },
]

export function SeasonMarkerDialog({
  mode,
  marker,
  trigger,
}: {
  mode: "create" | "edit"
  marker?: Marker
  trigger: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: marker?.name ?? "",
    type: marker?.type ?? "SEASON",
    startDate: marker?.startDate ? marker.startDate.slice(0, 10) : "",
    endDate: marker?.endDate ? marker.endDate.slice(0, 10) : "",
    color: marker?.color ?? "#A78BFA",
    intensity: marker?.intensity ?? "",
    description: marker?.description ?? "",
    recurrence: marker?.recurrence ?? "NONE",
  })
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.type || !form.startDate) return
    setLoading(true)
    try {
      const payload = {
        name: form.name,
        type: form.type,
        startDate: form.startDate,
        endDate: form.endDate || undefined,
        color: form.color,
        intensity: form.intensity || undefined,
        description: form.description || undefined,
        recurrence: form.recurrence,
      }

      const url = mode === "create"
        ? "/api/season-markers"
        : `/api/season-markers/${marker!.id}`
      const method = mode === "create" ? "POST" : "PATCH"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed")
      toast.success(mode === "create" ? "Season added" : "Season updated", {
        description: form.name,
      })
      setOpen(false)
      router.refresh()
    } catch (e) {
      toast.error("Failed", { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-[520px] max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Add Season / Holiday / Trend" : `Edit: ${marker?.name}`}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Día de las Madres" required />
            </div>
            <div className="space-y-2">
              <Label>Type *</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Start date *</Label>
              <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>End date (optional)</Label>
              <Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} placeholder="Leave blank for single day" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Color</Label>
              <Select value={form.color} onValueChange={(v) => setForm({ ...form, color: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COLORS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      <span className="inline-flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: c.value }} />
                        {c.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Intensity</Label>
              <Select value={form.intensity} onValueChange={(v) => setForm({ ...form, intensity: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INTENSITIES.map((i) => <SelectItem key={i.value || "_none"} value={i.value || "NONE"}>{i.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Description (optional)</Label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} placeholder="What happens during this period?" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={loading || !form.name || !form.startDate}>
              {loading ? "Saving..." : mode === "create" ? "✓ Add" : "✓ Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
