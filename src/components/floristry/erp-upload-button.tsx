"use client"

import { useRef, useState } from "react"
import { Download, Loader2, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { useCatalogue } from "@/lib/catalogue-store"

/**
 * Button that opens a file picker, accepts an .xlsx ERP file,
 * uploads it to /api/upload, then refreshes the catalogue store.
 */
export function ErpUploadButton() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [lastUpload, setLastUpload] = useState<string | null>(null)
  const fetchCatalogue = useCatalogue((s) => s.fetch)

  async function handleFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      toast.error("Only .xlsx files are supported")
      return
    }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch("/api/upload", { method: "POST", body: fd })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${res.status}`)
      }
      const data = await res.json()
      toast.success(
        `ERP refreshed — ${data.counts.products} products, ${data.counts.materials} materials, ${data.counts.recipes} recipe lines`,
      )
      setLastUpload(file.name)
      await fetchCatalogue()
    } catch (e) {
      toast.error("Upload failed", { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) handleFile(f)
        }}
      />
      <Button
        variant="outline"
        size="sm"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="gap-2"
      >
        {uploading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : lastUpload ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
        ) : (
          <Download className="h-4 w-4" />
        )}
        {uploading ? "Refreshing…" : "Refresh UI from Truth"}
      </Button>
    </>
  )
}
