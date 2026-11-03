"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"

type Reminder = {
  id: string
  remindAt: string
  note: string | null
  done: boolean
  createdAt: string
}

export function QuoteRemindersSection({ quoteId, reminders }: { quoteId: string; reminders: Reminder[] }) {
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ remindAt: "", note: "" })
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.remindAt) return
    setLoading(true)
    try {
      const res = await fetch("/api/quote-reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quoteId,
          remindAt: form.remindAt,
          note: form.note || undefined,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed")
      toast.success("Reminder set", { description: `Follow up on ${form.remindAt}` })
      setShowForm(false)
      setForm({ remindAt: "", note: "" })
      router.refresh()
    } catch (e) {
      toast.error("Failed to set reminder", { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setLoading(false)
    }
  }

  async function markDone(reminderId: string) {
    try {
      await fetch("/api/quote-reminders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: reminderId, done: true }),
      })
      toast.success("Reminder marked as done")
      router.refresh()
    } catch {
      toast.error("Failed to update reminder")
    }
  }

  return (
    <div className="border border-stone-200 rounded-md p-3 text-xs">
      <div className="flex items-center justify-between mb-2">
        <span className="uppercase tracking-wider text-stone-500 font-semibold">Reminders ({reminders.length})</span>
        <Button type="button" variant="outline" size="sm" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ Set reminder"}
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="space-y-2 mb-3 p-3 bg-stone-50 rounded">
          <div>
            <Label className="text-[10px]">Remind me on *</Label>
            <Input
              type="date"
              value={form.remindAt}
              onChange={(e) => setForm({ ...form, remindAt: e.target.value })}
              className="h-8 text-xs"
              required
            />
          </div>
          <Textarea
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
            placeholder="What to follow up on? (optional)"
            rows={2}
            className="text-xs"
          />
          <Button type="submit" size="sm" disabled={loading || !form.remindAt}>
            {loading ? "Setting..." : "✓ Set reminder"}
          </Button>
        </form>
      )}

      {reminders.length === 0 ? (
        <div className="text-center text-stone-400 py-3">No reminders set.</div>
      ) : (
        <div className="space-y-1.5">
          {reminders.map((r) => (
            <div key={r.id} className="flex items-center gap-2 border border-stone-100 rounded p-2 bg-white">
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                r.done
                  ? "bg-emerald-50 text-emerald-600"
                  : new Date(r.remindAt) < new Date()
                    ? "bg-red-50 text-red-600"
                    : "bg-amber-50 text-amber-700"
              }`}>
                {new Date(r.remindAt).toLocaleDateString("es-MX", { day: "2-digit", month: "short" })}
              </span>
              <span className="flex-1 text-stone-600">{r.note ?? "—"}</span>
              {r.done ? (
                <span className="text-[10px] text-emerald-600">✓ Done</span>
              ) : (
                <button
                  type="button"
                  onClick={() => markDone(r.id)}
                  className="text-[10px] text-emerald-600 hover:underline"
                >
                  Mark done
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
