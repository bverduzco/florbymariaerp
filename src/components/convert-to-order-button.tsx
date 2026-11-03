"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

/**
 * ConvertToOrderButton — appears on accepted quotes (or any quote that
 * hasn't been converted yet). Calls POST /api/quotes/[id]/convert-to-order.
 *
 * If the quote is already linked to an order, shows "View Order →" instead.
 */
export function ConvertToOrderButton({
  quoteId,
  alreadyLinkedOrderId,
  alreadyLinkedOrderNumber,
}: {
  quoteId: string
  alreadyLinkedOrderId?: string | null
  alreadyLinkedOrderNumber?: string | null
}) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  // If already linked, show a link to the order
  if (alreadyLinkedOrderId && alreadyLinkedOrderNumber) {
    return (
      <a
        href="/orders"
        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition"
        title={`Linked to ${alreadyLinkedOrderNumber} — click to view orders`}
      >
        <span>✓</span>
        <span>{alreadyLinkedOrderNumber}</span>
        <span>→</span>
      </a>
    )
  }

  async function handleConvert() {
    setLoading(true)
    try {
      const res = await fetch(`/api/quotes/${quoteId}/convert-to-order`, {
        method: "POST",
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to convert")
      }
      toast.success("Converted to order", {
        description: data.created
          ? `${data.order.orderNumber} created. Quote marked as accepted.`
          : data.message,
      })
      router.refresh()
    } catch (e) {
      toast.error("Failed to convert", {
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleConvert}
      disabled={loading}
      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition disabled:opacity-50"
      title="Convert this quote into an order with the same line items"
    >
      {loading ? "Converting..." : "→ Convert to Order"}
    </button>
  )
}
