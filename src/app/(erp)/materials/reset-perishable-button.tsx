"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

type PerishablePreview = {
  sku: string
  name: string
  currentStock: number
  packPrice: number | null
}

export function ResetPerishableButton({ perishables }: { perishables: PerishablePreview[] }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<{ affected: number; totalPacks: number; totalValue: number } | null>(null)
  const router = useRouter()

  const totalPacks = perishables.reduce((s, p) => s + p.currentStock, 0)
  const totalValue = perishables.reduce((s, p) => s + (p.packPrice ?? 0) * p.currentStock, 0)

  async function handleReset() {
    setLoading(true)
    try {
      const res = await fetch("/api/materials/reset-perishable", {
        method: "POST",
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? "Failed")
      }
      const data = await res.json()
      setResults({
        affected: data.affected,
        totalPacks: data.totalPacks,
        totalValue: data.totalValue,
      })
      toast.success("Perishable stock reset", {
        description: `${data.affected} materials · ${data.totalPacks} packs · $${data.totalValue.toLocaleString("es-MX", { maximumFractionDigits: 0 })} written off as losses`,
      })
      router.refresh()
    } catch (e) {
      toast.error("Failed to reset", { description: e instanceof Error ? e.message : String(e) })
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset Perishable Stock</DialogTitle>
        </DialogHeader>

        {results ? (
          // Post-reset view
          <div style={{ paddingTop: "12px" }}>
            <div className="fmd-note" style={{ marginBottom: "12px" }}>
              ✅ {results.affected} materials reset. {results.totalPacks} packs written off as losses. Est. value loss: ${results.totalValue.toLocaleString("es-MX", { maximumFractionDigits: 0 })} MXN.
            </div>
            <div style={{ fontSize: "12px", color: "#6B7280" }}>
              For each material, the system:
              <br />1. Created a Loss row (reason = "expired")
              <br />2. Created a Stock Movement (negative packs, reason = "loss")
              <br />3. Set Materials.Current Stock = 0
            </div>
            <DialogFooter style={{ marginTop: "16px" }}>
              <Button type="button" onClick={() => setOpen(false)}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          // Pre-reset confirmation
          <div style={{ paddingTop: "12px" }}>
            <div className="fmd-note" style={{ marginBottom: "12px" }}>
              <strong>⚠️ This will zero out all Flower and Foliage stock and create Loss entries.</strong>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginBottom: "12px" }}>
              <div style={{ fontSize: "12px", color: "#44403C", fontWeight: 600 }}>
                Materials affected: {perishables.length} (Category = Flower or Foliage, Current Stock &gt; 0)
              </div>
              <div style={{ fontSize: "12px", color: "#44403C", fontWeight: 600 }}>
                Total packs to write off: {totalPacks} packs
              </div>
              <div style={{ fontSize: "12px", color: "#44403C", fontWeight: 600 }}>
                Estimated value loss: ${totalValue.toLocaleString("es-MX", { maximumFractionDigits: 0 })} MXN
              </div>
            </div>

            {perishables.length > 0 && (
              <div style={{ maxHeight: "150px", overflowY: "auto", border: "1px solid #D6D3D1", borderRadius: "4px", marginBottom: "12px" }}>
                <table className="fmd-table" style={{ width: "100%" }}>
                  <thead>
                    <tr><th>SKU</th><th>Name</th><th style={{ textAlign: "right" }}>Stock</th><th style={{ textAlign: "right" }}>Value</th></tr>
                  </thead>
                  <tbody>
                    {perishables.map((p) => (
                      <tr key={p.sku}>
                        <td style={{ fontFamily: "monospace", fontSize: "10px" }}>{p.sku}</td>
                        <td style={{ color: "#44403C" }}>{p.name}</td>
                        <td style={{ textAlign: "right" }}>{p.currentStock}</td>
                        <td style={{ textAlign: "right" }}>${((p.packPrice ?? 0) * p.currentStock).toLocaleString("es-MX", { maximumFractionDigits: 0 })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ fontSize: "11px", color: "#6B7280", marginBottom: "8px" }}>
              For each material, the system will:
              <br />1. Create a Loss row (LOSS-NNNN) with Qty Lost = current stock, Reason = "expired"
              <br />2. Create a Stock Movement row (negative packs, reason = "loss")
              <br />3. Materials.Current Stock auto-zeros
              <br />4. Packaging, Consumables, and Tools are NOT affected
            </div>

            <div className="fmd-note blue" style={{ marginBottom: "12px" }}>
              💡 Tip: Physically check your flowers before clicking. Some may still be usable — exclude them by setting their stock to 0 manually first.
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button
                type="button"
                onClick={handleReset}
                disabled={loading || perishables.length === 0}
                style={{ background: "#D97706", color: "white" }}
              >
                {loading ? "Resetting..." : "✓ Yes, Reset All Perishables"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
