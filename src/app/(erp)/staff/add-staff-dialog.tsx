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

const SKILL_OPTIONS = [
  "assembly", "delivery", "conditioning", "setup", "teardown", "design",
]

export function AddStaffDialog() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: "",
    shortName: "",
    phone: "",
    email: "",
    type: "",
    skills: [] as string[],
    payRate: "",
    notes: "",
  })
  const router = useRouter()

  function toggleSkill(skill: string) {
    setForm((f) => ({
      ...f,
      skills: f.skills.includes(skill)
        ? f.skills.filter((s) => s !== skill)
        : [...f.skills, skill],
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.type) return
    setLoading(true)
    try {
      const res = await fetch("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          skills: form.skills.join(", ") || undefined,
          payRate: form.payRate || undefined,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed")
      toast.success("Staff added", { description: form.name })
      setOpen(false)
      setForm({ name: "", shortName: "", phone: "", email: "", type: "", skills: [], payRate: "", notes: "" })
      router.refresh()
    } catch (e) {
      toast.error("Failed to add staff", { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="px-4 py-2 text-sm font-medium bg-stone-900 text-white rounded-md hover:bg-stone-800 transition">
          + Add Staff
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Add Staff Member</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="name">Full name *</Label>
              <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Rosa Martínez" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="shortName">Short name</Label>
              <Input id="shortName" value={form.shortName} onChange={(e) => setForm({ ...form, shortName: e.target.value })} placeholder="e.g. Rosa" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Type *</Label>
            <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })} required>
              <SelectTrigger><SelectValue placeholder="Select type..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="internal">Internal (owner/employee)</SelectItem>
                <SelectItem value="freelance">Freelance (per-event)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="81 1234 5678" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="payRate">Pay rate (MXN/hr)</Label>
              <Input id="payRate" type="number" step="0.01" value={form.payRate} onChange={(e) => setForm({ ...form, payRate: e.target.value })} placeholder="e.g. 100" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Skills (select all that apply)</Label>
            <div className="flex flex-wrap gap-2">
              {SKILL_OPTIONS.map((skill) => (
                <button
                  key={skill}
                  type="button"
                  onClick={() => toggleSkill(skill)}
                  className={`px-3 py-1 text-xs rounded-full border transition ${
                    form.skills.includes(skill)
                      ? "bg-violet-100 text-violet-800 border-violet-400"
                      : "bg-stone-50 text-stone-600 border-stone-300 hover:bg-stone-100"
                  }`}
                >
                  {skill}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Background, availability, etc." rows={2} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={loading || !form.name || !form.type}>
              {loading ? "Adding..." : "✓ Add Staff"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
