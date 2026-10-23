"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Loader2, Download, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"

export function BackupButton() {
  const [backing, setBacking] = useState(false)
  const [lastBackup, setLastBackup] = useState<string | null>(null)

  async function handleBackup() {
    setBacking(true)
    try {
      const res = await fetch("/api/backup", { method: "POST" })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${res.status}`)
      }
      const data = await res.json()
      setLastBackup(data.fileName)
      toast.success(`Backup generated: ${data.fileName}`, {
        description: `${data.tabCount} tabs · downloading now`,
        duration: 6000,
      })
      // Trigger browser download
      const link = document.createElement("a")
      link.href = `/download/${encodeURIComponent(data.fileName)}`
      link.download = data.fileName
      link.target = "_blank"
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (e) {
      toast.error("Backup failed", {
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setBacking(false)
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleBackup}
      disabled={backing}
      className="gap-2"
    >
      {backing ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : lastBackup ? (
        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
      ) : (
        <Download className="h-4 w-4" />
      )}
      {backing ? "Backing up…" : "Backup DB to Excel"}
    </Button>
  )
}
