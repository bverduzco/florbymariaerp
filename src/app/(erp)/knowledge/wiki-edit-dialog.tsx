"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

const CATEGORIES = [
  { value: "general", label: "📁 General" },
  { value: "cheat-sheet", label: "📋 Cheat sheet" },
  { value: "flower-care", label: "🌸 Flower care" },
  { value: "substitution", label: "🔄 Substitution" },
  { value: "supplier-tip", label: "🏭 Supplier tip" },
  { value: "recipe-note", label: "📖 Recipe note" },
  { value: "seasonal", label: "📅 Seasonal" },
  { value: "demo", label: "🎁 Demo / event" },
  { value: "other", label: "📦 Other" },
]

type EditMode = "create" | "edit"

type ArticleSummary = {
  id: string
  slug: string
  title: string
  category: string
  tags: string | null
  pinned: boolean
  updatedAt: string
  body?: string
}

export function WikiEditDialog({
  mode,
  article,
  trigger,
}: {
  mode: EditMode
  article?: ArticleSummary
  trigger: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [form, setForm] = useState({
    title: article?.title ?? "",
    body: article?.body ?? "",
    category: article?.category ?? "general",
    tags: article?.tags ?? "",
    pinned: article?.pinned ?? false,
  })
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title || !form.body) return
    setLoading(true)
    try {
      const payload = {
        title: form.title,
        body: form.body,
        category: form.category,
        tags: form.tags || null,
        pinned: form.pinned,
      }

      const url = mode === "create" ? "/api/wiki" : `/api/wiki/${article?.id}`
      const method = mode === "create" ? "POST" : "PATCH"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? "Failed")
      }
      const data = await res.json()
      toast.success(
        mode === "create" ? "Article created" : "Article saved",
        { description: data.article.title }
      )
      setOpen(false)
      if (mode === "create") {
        setForm({ title: "", body: "", category: "general", tags: "", pinned: false })
      }
      router.refresh()
    } catch (e) {
      toast.error(
        mode === "create" ? "Failed to create article" : "Failed to save article",
        { description: e instanceof Error ? e.message : String(e) }
      )
    } finally {
      setLoading(false)
    }
  }

  const dialogTitle = mode === "create" ? "New wiki article" : `Edit: ${article?.title ?? ""}`

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-[900px] max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* ── Header fields ──────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="wiki-title">Title *</Label>
              <Input
                id="wiki-title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Vida en florero — guía de referencia"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={form.category}
                onValueChange={(v) => setForm({ ...form, category: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="wiki-tags">Tags (comma-separated)</Label>
              <Input
                id="wiki-tags"
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
                placeholder="e.g. vase-life, hardy, etileno"
              />
            </div>
            <div className="space-y-2 flex items-end">
              <label className="flex items-center gap-2 cursor-pointer text-sm pb-2">
                <input
                  type="checkbox"
                  checked={form.pinned}
                  onChange={(e) => setForm({ ...form, pinned: e.target.checked })}
                  className="accent-rose-700"
                />
                <span>📌 Pin to top of wiki list</span>
              </label>
            </div>
          </div>

          {/* ── Markdown editor + preview toggle ───────────────── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="wiki-body">Body (markdown) *</Label>
              <div className="flex gap-1 border-b border-stone-200">
                <button
                  type="button"
                  onClick={() => setShowPreview(false)}
                  className={`px-3 py-1 text-xs font-medium border-b-2 transition ${
                    !showPreview ? "border-stone-900 text-stone-900" : "border-transparent text-stone-500 hover:text-stone-700"
                  }`}
                >
                  ✏️ Edit
                </button>
                <button
                  type="button"
                  onClick={() => setShowPreview(true)}
                  className={`px-3 py-1 text-xs font-medium border-b-2 transition ${
                    showPreview ? "border-stone-900 text-stone-900" : "border-transparent text-stone-500 hover:text-stone-700"
                  }`}
                >
                  👁️ Preview
                </button>
              </div>
            </div>
            {showPreview ? (
              <div className="border border-stone-200 rounded-md p-4 bg-stone-50 min-h-[400px] prose prose-sm max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {form.body || "*(nothing to preview yet)*"}
                </ReactMarkdown>
              </div>
            ) : (
              <Textarea
                id="wiki-body"
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                placeholder={"# Title\n\nWrite markdown here. Tables, headings, lists all supported.\n\n| Col A | Col B |\n|---|---|\n| 1 | 2 |"}
                rows={22}
                className="font-mono text-xs"
                required
              />
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !form.title || !form.body}>
              {loading
                ? "Saving..."
                : mode === "create"
                  ? "✓ Create article"
                  : "✓ Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
