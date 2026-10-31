"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"

type RecipeLine = {
  id: string
  componentSku: string
  componentName: string
  qty: number
  unit: string
  unitCost: number
  lineCost: number
  category: string
  color: string | null
  check: string | null
  material: { sku: string; name: string; currentStockPacks: number | null } | null
}

type EditableLine = {
  id: string
  componentName: string
  componentSku: string
  qty: number
  unit: string
  unitCost: number
  lineCost: number
  color: string | null
  category: string
  deleted: boolean
}

export function EditRecipeDialog({
  productId,
  productSku,
  productName,
  lines,
  currentVersion,
}: {
  productId: string
  productSku: string
  productName: string
  lines: RecipeLine[]
  currentVersion: string
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [editLines, setEditLines] = useState<EditableLine[]>([])
  const [bumpVersion, setBumpVersion] = useState(false)
  const router = useRouter()

  function openDialog() {
    setEditLines(lines.map((l) => ({
      id: l.id,
      componentName: l.componentName,
      componentSku: l.componentSku,
      qty: l.qty,
      unit: l.unit,
      unitCost: l.unitCost,
      lineCost: l.lineCost,
      color: l.color,
      category: l.category,
      deleted: false,
    })))
    setBumpVersion(false)
    setOpen(true)
  }

  function changeQty(lineId: string, newQty: number) {
    setEditLines((prev) => prev.map((l) => {
      if (l.id === lineId) {
        return { ...l, qty: newQty, lineCost: newQty * l.unitCost }
      }
      return l
    }))
  }

  function changeColor(lineId: string, newColor: string) {
    setEditLines((prev) => prev.map((l) => l.id === lineId ? { ...l, color: newColor } : l))
  }

  function toggleDelete(lineId: string) {
    setEditLines((prev) => prev.map((l) => l.id === lineId ? { ...l, deleted: !l.deleted } : l))
  }

  async function handleSave() {
    setLoading(true)
    try {
      const updates = editLines
        .filter((l) => !l.deleted)
        .map((l) => ({
          lineId: l.id,
          qty: l.qty,
          color: l.color || null,
        }))

      const deletes = editLines.filter((l) => l.deleted).map((l) => l.id)

      const newVersion = bumpVersion
        ? `v${Number(currentVersion.replace("v", "")) + 1}`
        : undefined

      const res = await fetch(`/api/recipes/${productId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          productSku,
          updates,
          deletes,
          newVersion,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? "Failed")
      }

      const data = await res.json()
      const msg = bumpVersion
        ? `Recipe updated and bumped to ${newVersion} (${data.updated} updated, ${data.deleted} removed)`
        : `Recipe updated (${data.updated} lines updated, ${data.deleted} removed)`

      toast.success("Recipe saved", { description: msg })
      setOpen(false)
      router.refresh()
    } catch (e) {
      toast.error("Failed to save recipe", { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setLoading(false)
    }
  }

  const visibleLines = editLines.filter((l) => !l.deleted)
  const deletedLines = editLines.filter((l) => l.deleted)
  const totalCost = visibleLines.reduce((s, l) => s + l.lineCost, 0)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className="fmd-btn outline"
          style={{ fontSize: "11px", padding: "3px 8px", cursor: "pointer" }}
          onClick={openDialog}
        >
          ✏️ Edit
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Recipe: {productName}</DialogTitle>
        </DialogHeader>

        <div style={{ paddingTop: "8px" }}>
          {/* Line items table */}
          <div style={{ border: "1px solid #D6D3D1", borderRadius: "4px", overflow: "hidden" }}>
            <table className="fmd-table" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th>Component</th>
                  <th style={{ textAlign: "right", width: "70px" }}>Qty</th>
                  <th style={{ width: "90px" }}>Color</th>
                  <th style={{ textAlign: "right", width: "60px" }}>Cost</th>
                  <th style={{ width: "30px" }}></th>
                </tr>
              </thead>
              <tbody>
                {editLines.map((l) => (
                  <tr key={l.id} style={{ opacity: l.deleted ? 0.3 : 1, textDecoration: l.deleted ? "line-through" : "none" }}>
                    <td style={{ color: "#44403C", fontSize: "11px" }}>
                      {l.componentName}
                      <div style={{ fontSize: "9px", color: "#78716C", fontFamily: "monospace" }}>{l.componentSku}</div>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={l.qty}
                        disabled={l.deleted}
                        onChange={(e) => changeQty(l.id, Number(e.target.value))}
                        style={{ width: "50px", padding: "2px 4px", fontSize: "11px", border: "1px solid #D6D3D1", borderRadius: "3px", textAlign: "right" }}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={l.color ?? ""}
                        disabled={l.deleted}
                        onChange={(e) => changeColor(l.id, e.target.value)}
                        placeholder="—"
                        style={{ width: "70px", padding: "2px 4px", fontSize: "11px", border: "1px solid #D6D3D1", borderRadius: "3px" }}
                      />
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 600, color: "#44403C" }}>
                      ${l.lineCost.toFixed(2)}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <button
                        onClick={() => toggleDelete(l.id)}
                        style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: "14px", color: l.deleted ? "#047857" : "#991B1B" }}
                        title={l.deleted ? "Restore" : "Remove"}
                      >
                        {l.deleted ? "↩" : "✕"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: "2px solid #D6D3D1" }}>
                  <td colSpan={3} style={{ textAlign: "right", fontWeight: 700, color: "#44403C", fontSize: "12px" }}>
                    Total: ({visibleLines.length} lines)
                  </td>
                  <td style={{ textAlign: "right", fontWeight: 700, color: "#44403C" }}>
                    ${totalCost.toFixed(2)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Deleted items summary */}
          {deletedLines.length > 0 && (
            <div style={{ fontSize: "11px", color: "#991B1B", marginTop: "6px" }}>
              {deletedLines.length} line(s) marked for removal: {deletedLines.map((l) => l.componentName).join(", ")}
            </div>
          )}

          {/* Version bump option */}
          <div style={{ marginTop: "12px", padding: "8px 12px", background: "#FCE7F3", border: "1px solid #F9A8D4", borderRadius: "4px" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "12px", color: "#44403C" }}>
              <input
                type="checkbox"
                checked={bumpVersion}
                onChange={(e) => setBumpVersion(e.target.checked)}
              />
              <span>
                Bump version: <strong>{currentVersion}</strong> → <strong>v{Number(currentVersion.replace("v", "")) + 1}</strong>
                <span style={{ color: "#78716C", fontSize: "10px", marginLeft: "4px" }}>(marks old version as superseded, creates new active version)</span>
              </span>
            </label>
          </div>

          <div className="fmd-note blue" style={{ marginTop: "8px" }}>
            💡 Edit quantities, change colors, or remove lines (✕). Removed lines can be restored (↩). To add new ingredients, use the "+ Add ingredient" button on the recipe card after saving.
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={loading}
            style={{ background: "#BE185D", color: "white" }}
          >
            {loading ? "Saving..." : "✓ Save Recipe"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
