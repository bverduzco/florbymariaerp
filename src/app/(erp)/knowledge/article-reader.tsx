"use client"

import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { WikiEditDialog } from "./wiki-edit-dialog"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

type Article = {
  id: string
  slug: string
  title: string
  category: string
  body: string
  tags: string | null
  pinned: boolean
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

export function ArticleReader({ article }: { article: Article }) {
  const router = useRouter()
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    try {
      const res = await fetch(`/api/wiki/${article.id}`, { method: "DELETE" })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? "Failed")
      }
      toast.success("Article deleted", { description: article.title })
      router.push("/knowledge")
      router.refresh()
    } catch (e) {
      toast.error("Failed to delete article", {
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setDeleting(false)
      setConfirmingDelete(false)
    }
  }

  async function handleTogglePin() {
    const newPinned = !article.pinned
    try {
      const res = await fetch(`/api/wiki/${article.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinned: newPinned }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? "Failed")
      }
      toast.success(newPinned ? "Pinned to top" : "Unpinned", {
        description: article.title,
      })
      router.refresh()
    } catch (e) {
      toast.error("Failed to toggle pin", {
        description: e instanceof Error ? e.message : String(e),
      })
    }
  }

  return (
    <div className="fmd-box" style={{ marginBottom: 0 }}>
      {/* ── Article header ──────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "12px",
          paddingBottom: "12px",
          borderBottom: "1px solid #E7E5E4",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#44403C" }}>
            {article.pinned && "📌 "}
            {article.title}
          </h2>
          <div style={{ fontSize: "11px", color: "#78716C", marginTop: "4px" }}>
            <span
              className={`fmd-status ${article.category}`}
              style={{ background: "#FCE7F3", color: "#BE185D" }}
            >
              {article.category}
            </span>
            {article.tags && (
              <>
                {" · "}
                <span style={{ fontFamily: "monospace" }}>
                  {article.tags
                    .split(",")
                    .map((t) => `#${t.trim()}`)
                    .join(" ")}
                </span>
              </>
            )}
            <span style={{ marginLeft: "8px" }}>
              · Updated {new Date(article.updatedAt).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}
            </span>
            {article.createdBy && (
              <span> · by {article.createdBy}</span>
            )}
          </div>
        </div>

        {/* ── Action buttons ─────────────────────────────── */}
        <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
          <button
            type="button"
            onClick={handleTogglePin}
            className="px-2 py-1 text-xs border border-stone-300 rounded hover:bg-rose-50 hover:border-rose-400 hover:text-rose-700 transition"
            title={article.pinned ? "Unpin from top" : "Pin to top of wiki list"}
          >
            {article.pinned ? "📍 Unpin" : "📌 Pin"}
          </button>
          <WikiEditDialog
            mode="edit"
            article={article}
            trigger={
              <button
                className="px-2 py-1 text-xs border border-stone-300 rounded hover:bg-stone-900 hover:text-white hover:border-stone-900 transition"
                title="Edit this article"
              >
                ✏️ Edit
              </button>
            }
          />
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="px-2 py-1 text-xs border border-stone-300 rounded hover:bg-red-50 hover:border-red-400 hover:text-red-700 transition"
            title="Delete this article (cannot be undone)"
          >
            🗑️ Delete
          </button>
        </div>
      </div>

      {/* ── Article body (rendered markdown) ────────────────── */}
      <div className="prose prose-stone prose-sm max-w-none">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            // Open external links in a new tab
            a: ({ ...props }) => (
              <a {...props} target="_blank" rel="noopener noreferrer" />
            ),
            // Style tables
            table: ({ ...props }) => (
              <table
                {...props}
                style={{
                  borderCollapse: "collapse",
                  width: "100%",
                  fontSize: "12px",
                  margin: "8px 0",
                }}
              />
            ),
            th: ({ ...props }) => (
              <th
                {...props}
                style={{
                  border: "1px solid #D6D3D1",
                  padding: "6px 8px",
                  background: "#F5F5F4",
                  textAlign: "left",
                  fontWeight: 600,
                }}
              />
            ),
            td: ({ ...props }) => (
              <td
                {...props}
                style={{
                  border: "1px solid #D6D3D1",
                  padding: "6px 8px",
                  verticalAlign: "top",
                }}
              />
            ),
          }}
        >
          {article.body}
        </ReactMarkdown>
      </div>

      {/* ── Delete confirmation ──────────────────────────────── */}
      {confirmingDelete && (
        <div
          style={{
            marginTop: "16px",
            padding: "12px",
            border: "1px solid #FCA5A5",
            background: "#FEF2F2",
            borderRadius: "6px",
          }}
        >
          <div style={{ fontSize: "13px", fontWeight: 600, color: "#991B1B", marginBottom: "8px" }}>
            Delete &ldquo;{article.title}&rdquo;?
          </div>
          <div style={{ fontSize: "11px", color: "#7F1D1D", marginBottom: "10px" }}>
            This cannot be undone. The article and its history will be
            permanently removed. Consider editing instead.
          </div>
          <div style={{ display: "flex", gap: "6px" }}>
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              className="px-3 py-1 text-xs border border-stone-300 rounded hover:bg-stone-100 transition"
              disabled={deleting}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="px-3 py-1 text-xs bg-red-700 text-white rounded hover:bg-red-800 transition disabled:opacity-50"
            >
              {deleting ? "Deleting..." : "Yes, delete permanently"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
