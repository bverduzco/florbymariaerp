"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"

interface StatusDropdownProps {
  entityId: string
  currentStatus: string
  statuses: Array<{ value: string; label: string }>
  apiPath: string  // e.g. "/api/quotes/{id}" or "/api/orders/{id}/status"
  colorMap?: Record<string, string>
}

export function StatusDropdown({
  entityId,
  currentStatus,
  statuses,
  apiPath,
}: StatusDropdownProps) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleChange(newStatus: string) {
    if (newStatus === currentStatus) return
    setLoading(true)
    try {
      const url = apiPath.replace("{id}", entityId)
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? "Failed")
      }
      toast.success("Status updated", {
        description: `${currentStatus} → ${newStatus}`,
      })
      router.refresh()
    } catch (e) {
      toast.error("Failed to update status", {
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Select
      value={currentStatus}
      onValueChange={handleChange}
      disabled={loading}
    >
      <SelectTrigger className="h-7 text-xs w-auto min-w-[110px] border-stone-300">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {statuses.map((s) => (
          <SelectItem key={s.value} value={s.value} className="text-xs">
            {s.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
