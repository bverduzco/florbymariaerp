"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

/**
 * UnblockButton — deletes a blocked date via DELETE /api/blocked-dates/[id].
 * Shows a confirmation step inline (two-click: first click shows "Sure?",
 * second click deletes).
 */
export function UnblockButton({ id, dateLabel }: { id: string; dateLabel: string }) {
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleDelete() {
    setLoading(true)
    try {
      const res = await fetch(`/api/blocked-dates/${id}`, { method: "DELETE" })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? "Failed")
      }
      toast.success("Date unblocked", { description: dateLabel })
      router.refresh()
    } catch (e) {
      toast.error("Failed to unblock", { description: e instanceof Error ? e.message : String(e) })
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
          {loading ? "..." : "✓ Confirm"}
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
      className="px-2 py-0.5 text-[10px] font-medium text-red-600 border border-red-300 rounded hover:bg-red-50 transition"
      title="Unblock this date"
    >
      Unblock
    </button>
  )
}
