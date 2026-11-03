"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"

type CustomerNote = {
  id: string
  channel: string
  direction: string
  subject: string | null
  body: string
  followUpDate: string | null | undefined | Date
  followUpDone: boolean
  recordedBy: string
  createdAt: string | null | undefined | Date
}

const CHANNELS = [
  { value: "call", label: "📞 Call" },
  { value: "whatsapp", label: "💬 WhatsApp" },
  { value: "email", label: "✉️ Email" },
  { value: "in_person", label: "🤝 In person" },
  { value: "other", label: "📝 Other" },
]

export function CustomerNotesSection({ customerId, notes }: { customerId: string; notes: CustomerNote[] }) {
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    channel: "call",
    direction: "outbound",
    subject: "",
    body: "",
    followUpDate: "",
  })
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.body) return
    setLoading(true)
    try {
      const res = await fetch("/api/customer-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          channel: form.channel,
          direction: form.direction,
          subject: form.subject || undefined,
          body: form.body,
          followUpDate: form.followUpDate || undefined,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed")
      toast.success("Note added")
      setShowForm(false)
      setForm({ channel: "call", direction: "outbound", subject: "", body: "", followUpDate: "" })
      router.refresh()
    } catch (e) {
      toast.error("Failed to add note", { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setLoading(false)
    }
  }

  async function markDone(noteId: string) {
    try {
      await fetch("/api/customer-notes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: noteId, followUpDone: true }),
      })
      toast.success("Follow-up marked as done")
      router.refresh()
    } catch (e) {
      toast.error("Failed to update")
    }
  }

  return (
    <div className="border border-stone-200 rounded-md p-3 text-xs">
      <div className="flex items-center justify-between mb-2">
        <span className="uppercase tracking-wider text-stone-500 font-semibold">Communication Log ({notes.length})</span>
        <Button type="button" variant="outline" size="sm" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ Add note"}
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="space-y-2 mb-3 p-3 bg-stone-50 rounded">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px]">Channel</Label>
              <Select value={form.channel} onValueChange={(v) => setForm({ ...form, channel: v })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CHANNELS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px]">Direction</Label>
              <Select value={form.direction} onValueChange={(v) => setForm({ ...form, direction: v })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="outbound">Outbound (we called)</SelectItem>
                  <SelectItem value="inbound">Inbound (they called)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Input
            value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
            placeholder="Subject (optional)"
            className="h-8 text-xs"
          />
          <Textarea
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
            placeholder="What was discussed?"
            rows={2}
            className="text-xs"
            required
          />
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={form.followUpDate}
              onChange={(e) => setForm({ ...form, followUpDate: e.target.value })}
              className="h-8 text-xs"
            />
            <span className="text-[10px] text-stone-400">Follow-up date (optional)</span>
          </div>
          <Button type="submit" size="sm" disabled={loading || !form.body}>
            {loading ? "Saving..." : "✓ Save note"}
          </Button>
        </form>
      )}

      {notes.length === 0 ? (
        <div className="text-center text-stone-400 py-4">No communication logged yet.</div>
      ) : (
        <div className="space-y-2">
          {notes.map((note) => (
            <div key={note.id} className="border border-stone-100 rounded p-2 bg-white">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-stone-100 font-semibold">
                  {note.channel}
                </span>
                <span className="text-[10px] text-stone-400">
                  {note.direction}
                </span>
                <span className="text-[10px] text-stone-400 ml-auto">
                  {note.createdAt ? new Date(note.createdAt as string).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                </span>
              </div>
              {note.subject && (
                <div className="font-semibold text-stone-700 text-xs">{note.subject}</div>
              )}
              <div className="text-stone-600 text-xs">{note.body}</div>
              {note.followUpDate && !note.followUpDone && (
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                    🔔 Follow up by {new Date(note.followUpDate).toLocaleDateString("es-MX", { day: "2-digit", month: "short" })}
                  </span>
                  <button
                    type="button"
                    onClick={() => markDone(note.id)}
                    className="text-[10px] text-emerald-600 hover:underline"
                  >
                    ✓ Mark done
                  </button>
                </div>
              )}
              {note.followUpDone && (
                <span className="text-[10px] text-emerald-600 mt-1 inline-block">✓ Follow-up completed</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
