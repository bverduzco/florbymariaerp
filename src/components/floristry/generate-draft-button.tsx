"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Loader2, FileSpreadsheet, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"

interface DraftResponse {
  success: boolean
  fileName: string
  downloadPath: string
  orderCount: number
  customerCount: number
  lineItemCount: number
  generatedAt: string
}

export function GenerateDraftButton() {
  const [generating, setGenerating] = useState(false)
  const [lastDraft, setLastDraft] = useState<DraftResponse | null>(null)

  async function generateDraft() {
    setGenerating(true)
    try {
      const res = await fetch("/api/orders/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${res.status}`)
      }
      const data: DraftResponse = await res.json()
      setLastDraft(data)
      toast.success(
        `Draft generated: ${data.orderCount} orders, ${data.customerCount} customers, ${data.lineItemCount} line items`,
        {
          description: `File: ${data.fileName} — review it, then promote to be the official ERP version.`,
          duration: 6000,
        },
      )
    } catch (e) {
      toast.error("Failed to generate draft", {
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setGenerating(false)
    }
  }

  return (
    <Button
      onClick={generateDraft}
      disabled={generating}
      variant="outline"
      size="sm"
      className="gap-1.5"
    >
      {generating ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : lastDraft ? (
        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
      ) : (
        <FileSpreadsheet className="h-4 w-4" />
      )}
      {generating ? "Generating…" : "Generate Draft Excel"}
    </Button>
  )
}
