"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

type PerishableItem = {
  sku: string
  name: string
  currentStock: number
  packPrice: number | null
}

type SelectedLoss = {
  sku: string
  name: string
  qty: number
  packPrice: number
}

export function ResetPerishableButton({ perishables }: { perishables: PerishableItem[] }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<{ affected: number; totalPacks: number; totalValue: number } | null>(null)
  const router = useRouter()

  // Per-item state: which items are selected + how many packs to write off
  const [selections, setSelections] = useState<Record<string, { checked: boolean; qty: number }>>(() => {
    const initial: Record<string, { checked: boolean; qty: number }> = {}
    for (const p of perishables) {
      initial[p.sku] = { checked: true, qty: p.currentStock }
    }
    return initial
  })

  function toggleItem(sku: string) {
    setSelections((prev) => ({
      ...prev,
      [sku]: { ...prev[sku], checked: !prev[sku].checked },
    }))
  }

  function changeQty(sku: string, newQty: number, maxQty: number) {
    const clamped = Math.max(0, Math.min(newQty, maxQty))
    setSelections((prev) => ({
      ...prev,
      [sku]: { ...prev[sku], qty: clamped },
    }))
  }

  // Compute selected items for preview
  const selectedItems: SelectedLoss[] = perishables
    .filter((p) => selections[p.sku]?.checked && selections[p.sku]?.qty > 0)
    .map((p) => ({
      sku: p.sku,
      name: p.name,
      qty: selections[p.sku].qty,
      packPrice: p.packPrice ?? 0,
    }))

  const totalPacks = selectedItems.reduce((s, i) => s + i.qty, 0)
  const totalValue = selectedItems.reduce((s, i) => s + i.qty * i.packPrice, 0)

  async function handleReset() {
    if (selectedItems.length === 0) {
      toast.error("Nothing selected", { description: "Select at least one item to write off." })
      return
    }

    setLoading(true)
    try {
      // Single atomic POST to the dedicated reset-perishable endpoint.
      // This route wraps everything in $transaction: if any material's
      // Loss / StockMovement / update fails, ALL changes roll back —
      // no partial state where some items were written off and others weren't.
      const res = await fetch("/api/materials/reset-perishable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: selectedItems.map((it) => ({ sku: it.sku, qty: it.qty })),
          reason: "expired",
          notes: "From Reset Perishable Stock (Materials tab)",
        }),
      })

      const data = await res.json().catch(() => null)

      if (!res.ok) {
        const errMsg = data?.error ?? `HTTP ${res.status}`
        throw new Error(errMsg)
      }

      const affected = Number(data?.affected ?? 0)
      const packs = Number(data?.totalPacks ?? 0)
      const value = Number(data?.totalValue ?? 0)

      if (affected === 0) {
        // All selected items had zero stock or qty=0 — no work done.
        toast.warning("Nothing was written off", {
          description: "All selected materials already have 0 stock.",
        })
      } else {
        setResults({ affected, totalPacks: packs, totalValue: value })
        toast.success("Perishable stock written off", {
          description: `${affected} materials · ${packs} packs · $${value.toLocaleString("es-MX", { maximumFractionDigits: 0 })} as losses`,
        })
        router.refresh()
      }
    } catch (e) {
      // Surface the error — never silently swallow it again.
      const msg = e instanceof Error ? e.message : String(e)
      console.error("[ResetPerishableButton] reset failed:", msg)
      toast.error("Failed to reset perishable stock", { description: msg })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); setResults(null) }}>
      <DialogTrigger asChild>
        <button className="fmd-btn warning" style={{ background: "#D97706", color: "white" }}>
          ♻️ Reset Perishable Stock
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Reset Perishable Stock</DialogTitle>
        </DialogHeader>

        {results ? (
          <div style={{ paddingTop: "12px" }}>
            <div className="fmd-note" style={{ marginBottom: "12px" }}>
              ✅ {results.affected} materials written off. {results.totalPacks} packs → Loss entries created. Est. value loss: ${results.totalValue.toLocaleString("es-MX", { maximumFractionDigits: 0 })} MXN.
            </div>
            <DialogFooter style={{ marginTop: "16px" }}>
              <Button type="button" onClick={() => setOpen(false)}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <div style={{ paddingTop: "12px" }}>
            <div className="fmd-note" style={{ marginBottom: "12px" }}>
              <strong>⚠️ This will create Loss entries for the selected materials.</strong> Check/uncheck items below and set partial quantities if needed.
            </div>

            {perishables.length === 0 ? (
              <div style={{ textAlign: "center", padding: "20px", color: "#9CA3AF" }}>
                No perishable materials with stock &gt; 0. Nothing to reset.
              </div>
            ) : (
              <>
                {/* Summary */}
                <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: "#FAFAF9", border: "1px solid #D6D3D1", borderRadius: "4px", marginBottom: "8px", fontSize: "12px" }}>
                  <span style={{ color: "#44403C", fontWeight: 600 }}>
                    {selectedItems.length} of {perishables.length} selected
                  </span>
                  <span style={{ color: "#991B1B", fontWeight: 600 }}>
                    {totalPacks} packs · ${totalValue.toLocaleString("es-MX", { maximumFractionDigits: 0 })}
                  </span>
                </div>

                {/* Per-item table with checkboxes + qty inputs */}
                <div style={{ maxHeight: "250px", overflowY: "auto", border: "1px solid #D6D3D1", borderRadius: "4px" }}>
                  <table className="fmd-table" style={{ width: "100%" }}>
                    <thead style={{ position: "sticky", top: 0, background: "#ffffff" }}>
                      <tr>
                        <th style={{ width: "30px" }}></th>
                        <th>Material</th>
                        <th style={{ textAlign: "right", width: "60px" }}>In stock</th>
                        <th style={{ textAlign: "right", width: "80px" }}>Write off</th>
                        <th style={{ textAlign: "right", width: "60px" }}>Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {perishables.map((p) => {
                        const sel = selections[p.sku] ?? { checked: false, qty: 0 }
                        const itemValue = sel.qty * (p.packPrice ?? 0)
                        return (
                          <tr key={p.sku} style={{ opacity: sel.checked ? 1 : 0.4 }}>
                            <td style={{ textAlign: "center" }}>
                              <input
                                type="checkbox"
                                checked={sel.checked}
                                onChange={() => toggleItem(p.sku)}
                                style={{ cursor: "pointer" }}
                              />
                            </td>
                            <td style={{ color: "#44403C" }}>
                              {p.name}
                              <div style={{ fontSize: "9px", color: "#78716C", fontFamily: "monospace" }}>{p.sku}</div>
                            </td>
                            <td style={{ textAlign: "right" }}>{p.currentStock}</td>
                            <td style={{ textAlign: "right" }}>
                              {sel.checked ? (
                                <input
                                  type="number"
                                  min="0"
                                  max={p.currentStock}
                                  step="0.5"
                                  value={sel.qty}
                                  onChange={(e) => changeQty(p.sku, Number(e.target.value), p.currentStock)}
                                  style={{ width: "50px", padding: "2px 4px", fontSize: "11px", border: "1px solid #D6D3D1", borderRadius: "3px", textAlign: "right" }}
                                />
                              ) : (
                                <span style={{ color: "#D6D3D1" }}>—</span>
                              )}
                            </td>
                            <td style={{ textAlign: "right", fontWeight: 600, color: sel.checked ? "#991B1B" : "#D6D3D1" }}>
                              ${itemValue.toLocaleString("es-MX", { maximumFractionDigits: 0 })}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                <div style={{ fontSize: "11px", color: "#6B7280", marginTop: "8px" }}>
                  For each selected material, a Loss entry (reason = "expired") will be created for the specified quantity. Uncheck items to exclude them. Set partial quantities for partial losses.
                </div>

                <div className="fmd-note blue" style={{ marginTop: "8px" }}>
                  💡 Tip: Physically check your flowers before clicking. Some may still be usable — uncheck them or reduce the write-off quantity.
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button
                    type="button"
                    onClick={handleReset}
                    disabled={loading || selectedItems.length === 0}
                    style={{ background: "#D97706", color: "white" }}
                  >
                    {loading ? "Writing off..." : `✓ Write Off ${selectedItems.length} Items`}
                  </Button>
                </DialogFooter>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
