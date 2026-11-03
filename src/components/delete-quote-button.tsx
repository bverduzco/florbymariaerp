"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

export function DeleteQuoteButton({
  quoteId,
  quoteNumber,
  hasOrder,
}: {
  quoteId: string
  quoteNumber: string
  hasOrder: boolean
}) {
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleDelete() {
    setLoading(true)
    try {
      const res = await fetch(`/api/quotes/${quoteId}`, { method: "DELETE" })
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed")
      toast.success("Quote deleted", { description: quoteNumber })
      router.push("/quotes")
      router.refresh()
    } catch (e) {
      toast.error("Failed to delete quote", { description: e instanceof Error ? e.message : String(e) })
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
          className="px-3 py-2 text-sm font-medium bg-red-600 text-white rounded-md hover:bg-red-700 transition disabled:opacity-50"
        >
          {loading ? "Deleting..." : "✓ Confirm delete"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="px-3 py-2 text-sm font-medium border border-stone-300 rounded-md hover:bg-stone-50 transition"
        >
          Cancel
        </button>
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="px-3 py-2 text-sm font-medium text-red-600 border border-red-300 rounded-md hover:bg-red-50 transition"
      title="Permanently delete this quote"
    >
      🗑️ Delete
    </button>
  )
}
