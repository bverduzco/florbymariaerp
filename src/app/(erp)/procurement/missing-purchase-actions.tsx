"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

/**
 * MissingPurchaseActions — renders action buttons for each missing purchase log entry.
 * Two actions:
 *   1. "Log Purchase" → opens the AdHocPurchaseDialog pre-filled with material + qty
 *   2. "Mark as Donation" → resolves the log as a donation (materials were gifted)
 *   3. "Ignore" → resolves as ignored (miscount)
 */
export function MissingPurchaseActions({
  id,
  materialSku,
  materialName,
  qtyShort,
  estCost,
  triggerRef,
}: {
  id: string
  materialSku: string
  materialName: string
  qtyShort: number
  estCost: number
  triggerRef: string | null
}) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function resolveAsDonation() {
    setLoading(true)
    try {
      const res = await fetch(`/api/missing-purchase-logs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolutionType: "donation" }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed")
      toast.success("Marked as donation", {
        description: `${materialName}: ${qtyShort} packs were gifted — no cost impact.`,
      })
      router.refresh()
    } catch (e) {
      toast.error("Failed to mark as donation", {
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setLoading(false)
    }
  }

  async function resolveAsIgnored() {
    setLoading(true)
    try {
      const res = await fetch(`/api/missing-purchase-logs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolutionType: "ignored" }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed")
      toast.success("Marked as ignored", {
        description: `${materialName}: discrepancy was a miscount.`,
      })
      router.refresh()
    } catch (e) {
      toast.error("Failed to resolve", {
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ marginLeft: "auto", display: "flex", gap: "4px" }}>
      <a
        href={`/procurement?resolve=${id}&sku=${materialSku}&name=${encodeURIComponent(materialName)}&qty=${qtyShort}`}
        style={{
          padding: "3px 8px",
          fontSize: "10px",
          fontWeight: 600,
          background: "#BE185D",
          color: "#fff",
          borderRadius: "4px",
          textDecoration: "none",
        }}
      >
        Log Purchase
      </a>
      <button
        onClick={resolveAsDonation}
        disabled={loading}
        style={{
          padding: "3px 8px",
          fontSize: "10px",
          fontWeight: 600,
          background: "#047857",
          color: "#fff",
          border: "none",
          borderRadius: "4px",
          cursor: loading ? "not-allowed" : "pointer",
        }}
      >
        Donation
      </button>
      <button
        onClick={resolveAsIgnored}
        disabled={loading}
        style={{
          padding: "3px 8px",
          fontSize: "10px",
          fontWeight: 600,
          background: "#6B7280",
          color: "#fff",
          border: "none",
          borderRadius: "4px",
          cursor: loading ? "not-allowed" : "pointer",
        }}
      >
        Ignore
      </button>
    </div>
  )
}
