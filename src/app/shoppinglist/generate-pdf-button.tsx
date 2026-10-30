"use client"

import { useState } from "react"
import { toast } from "sonner"

type ActiveOrder = {
  orderNumber: string
  customer: { name: string }
  deliveryDate: Date | null
  lineItems: { productSku: string; qty: number }[]
}

export function GeneratePdfButton({ activeOrders }: { activeOrders: ActiveOrder[] }) {
  const [loading, setLoading] = useState(false)

  async function handleGenerate() {
    if (activeOrders.length === 0) {
      toast.error("No active orders", { description: "Add orders to the pipeline first." })
      return
    }

    // Flatten all line items across active orders into plan items
    const items: Array<{ productSku: string; qty: number; deliveryDate: string | null; customerName: string | null }> = []
    for (const order of activeOrders) {
      for (const li of order.lineItems) {
        items.push({
          productSku: li.productSku,
          qty: li.qty,
          deliveryDate: order.deliveryDate ? order.deliveryDate.toISOString().slice(0, 10) : null,
          customerName: order.customer?.name ?? null,
        })
      }
    }

    if (items.length === 0) {
      toast.error("No line items", { description: "Active orders have no product line items." })
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/plan/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? `HTTP ${res.status}`)
      }

      // The response is a PDF blob — trigger download
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `shopping-list-${new Date().toISOString().slice(0, 10)}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast.success("PDF generated", {
        description: `${items.length} items across ${activeOrders.length} orders`,
      })
    } catch (e) {
      toast.error("Failed to generate PDF", {
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleGenerate}
      disabled={loading || activeOrders.length === 0}
      className="px-4 py-2 text-sm font-medium bg-stone-900 text-white rounded-md hover:bg-stone-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? "Generating..." : "📄 Generate PDF"}
    </button>
  )
}
