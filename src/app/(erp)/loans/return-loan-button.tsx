"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

export function ReturnLoanButton({ id, itemName }: { id: string; itemName: string }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleReturn() {
    setLoading(true)
    try {
      const res = await fetch(`/api/loans/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dateReturned: new Date().toISOString() }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed")
      toast.success("Marked as returned", {
        description: `${itemName} has been returned.`,
      })
      router.refresh()
    } catch (e) {
      toast.error("Failed to mark as returned", {
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleReturn}
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
      {loading ? "..." : "Return"}
    </button>
  )
}
