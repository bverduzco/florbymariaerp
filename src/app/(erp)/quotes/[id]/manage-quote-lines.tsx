"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog"

type QuoteLine = {
  id: string
  lineNumber: number
  description: string
  productSku: string | null
  qty: number
  unitPrice: number
  lineTotal: number
  notes: string | null
}

export function ManageQuoteLines({ quoteId, lines }: { quoteId: string; lines: QuoteLine[] }) {
  const [loading, setLoading] = useState<string | null>(null) // line ID being acted on
  const [showAdd, setShowAdd] = useState(false)
  const [editLine, setEditLine] = useState<QuoteLine | null>(null)
  const router = useRouter()

  async function handleDelete(lineId: string) {
    setLoading(lineId)
    try {
      const res = await fetch(`/api/quote-lines/${lineId}`, { method: "DELETE" })
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed")
      toast.success("Line removed")
      router.refresh()
    } catch (e) {
      toast.error("Failed to remove line", { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setLoading(null)
    }
  }

  async function handleEdit(line: QuoteLine, updates: { description: string; qty: number; unitPrice: number }) {
    setLoading(line.id)
    try {
      const res = await fetch(`/api/quote-lines/${line.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed")
      toast.success("Line updated")
      setEditLine(null)
      router.refresh()
    } catch (e) {
      toast.error("Failed to update line", { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="mt-4 pt-4 border-t border-stone-200">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">Manage Lines</span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowAdd(true)}
        >
          + Add line
        </Button>
      </div>

      {lines.length === 0 ? (
        <p className="text-xs text-stone-400 text-center py-4">No lines to manage.</p>
      ) : (
        <div className="space-y-2">
          {lines.map((line) => (
            <div key={line.id} className="flex items-center gap-2 text-xs border border-stone-200 rounded p-2">
              <span className="text-stone-400 font-mono w-6">{line.lineNumber}.</span>
              <span className="flex-1 font-medium text-stone-800 truncate">{line.description}</span>
              <span className="text-stone-600 tabular-nums whitespace-nowrap">
                {line.qty} × ${line.unitPrice.toFixed(0)} = <span className="font-semibold">${line.lineTotal.toFixed(0)}</span>
              </span>
              <button
                type="button"
                onClick={() => setEditLine(line)}
                disabled={loading === line.id}
                className="px-2 py-1 text-[10px] border border-stone-300 rounded hover:bg-stone-900 hover:text-white transition disabled:opacity-50"
              >
                ✏️
              </button>
              <button
                type="button"
                onClick={() => handleDelete(line.id)}
                disabled={loading === line.id}
                className="px-2 py-1 text-[10px] text-red-600 border border-red-300 rounded hover:bg-red-50 transition disabled:opacity-50"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Edit dialog */}
      {editLine && (
        <EditLineDialog
          line={editLine}
          onSave={(updates) => handleEdit(editLine, updates)}
          onClose={() => setEditLine(null)}
          loading={loading === editLine.id}
        />
      )}

      {/* Add line dialog */}
      {showAdd && (
        <AddLineDialog
          quoteId={quoteId}
          onClose={() => setShowAdd(false)}
          onAdded={() => {
            setShowAdd(false)
            router.refresh()
          }}
        />
      )}
    </div>
  )
}

function EditLineDialog({
  line,
  onSave,
  onClose,
  loading,
}: {
  line: QuoteLine
  onSave: (updates: { description: string; qty: number; unitPrice: number }) => void
  onClose: () => void
  loading: boolean
}) {
  const [description, setDescription] = useState(line.description)
  const [qty, setQty] = useState(line.qty.toString())
  const [unitPrice, setUnitPrice] = useState(line.unitPrice.toString())

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Edit Line {line.lineNumber}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            onSave({ description, qty: Number(qty), unitPrice: Number(unitPrice) })
          }}
          className="space-y-3 pt-2"
        >
          <div className="space-y-2">
            <Label>Description</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Qty</Label>
              <Input type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Unit price</Label>
              <Input type="number" step="0.01" min="0" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} required />
            </div>
          </div>
          <div className="text-xs text-stone-500">
            Line total: ${(Number(qty) * Number(unitPrice)).toFixed(2)}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : "✓ Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function AddLineDialog({
  quoteId,
  onClose,
  onAdded,
}: {
  quoteId: string
  onClose: () => void
  onAdded: () => void
}) {
  const [description, setDescription] = useState("")
  const [qty, setQty] = useState("1")
  const [unitPrice, setUnitPrice] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch("/api/quote-lines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quoteId,
          description,
          qty: Number(qty),
          unitPrice: Number(unitPrice),
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed")
      toast.success("Line added")
      onAdded()
    } catch (e) {
      toast.error("Failed to add line", { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Add Line</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 pt-2">
          <div className="space-y-2">
            <Label>Description *</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Custom centerpiece" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Qty *</Label>
              <Input type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Unit price *</Label>
              <Input type="number" step="0.01" min="0" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} placeholder="0.00" required />
            </div>
          </div>
          <div className="text-xs text-stone-500">
            Line total: ${(Number(qty) * Number(unitPrice || 0)).toFixed(2)}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={loading || !description || !unitPrice}>
              {loading ? "Adding..." : "✓ Add Line"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
