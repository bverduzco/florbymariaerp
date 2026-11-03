"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

export function DeleteSeasonButton({ id, name }: { id: string; name: string }) {
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleDelete() {
    setLoading(true)
    try {
      const res = await fetch(`/api/season-markers/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed")
      toast.success("Deleted", { description: name })
      router.refresh()
    } catch (e) {
      toast.error("Failed to delete", { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setLoading(false)
      setConfirming(false)
    }
  }

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-1">
        <button
          type="button"
          onClick={handleDelete}
          disabled={loading}
          className="px-2 py-0.5 text-[10px] font-medium bg-red-600 text-white rounded hover:bg-red-700 transition disabled:opacity-50"
        >
          {loading ? "..." : "✓"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="px-2 py-0.5 text-[10px] font-medium border border-stone-300 rounded hover:bg-stone-50 transition"
        >
          ✕
        </button>
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="px-1.5 py-0.5 text-stone-300 hover:text-red-500 transition text-xs"
      title={`Delete ${name}`}
    >
      🗑️
    </button>
  )
}
