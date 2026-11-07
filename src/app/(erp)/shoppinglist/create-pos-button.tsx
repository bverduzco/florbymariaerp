"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

type SupplierGroup = {
  supplier: string
  materials: Array<{
    sku: string
    name: string
    packsToBuy: number
    estimatedCost: number
    packPrice: number | null
  }>
  totalCost: number
}

export function CreatePosButton({ supplierGroups }: { supplierGroups: SupplierGroup[] }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleCreate() {
    // Filter to only suppliers with items to buy.
    // Also guard against non-finite packsToBuy (NaN / Infinity) — those
    // can slip through if a material's unitsPerPack=0 in the DB, which
    // produces Infinity that JSON.stringify converts to null. The
    // shopping list page now falls back to 12 in that case, but this
    // guard prevents the broken API payload from ever being sent.
    const itemsToBuy = supplierGroups
      .filter((g) => g.materials.some((m) => Number.isFinite(m.packsToBuy) && m.packsToBuy > 0))
      .flatMap((g) =>
        g.materials
          .filter((m) => Number.isFinite(m.packsToBuy) && m.packsToBuy > 0)
          .map((m) => ({
            materialSku: m.sku,
            materialName: m.name,
            qtyPacks: m.packsToBuy,
            costPerPack: m.packPrice ?? 0,
            supplier: g.supplier,
          }))
      )

    if (itemsToBuy.length === 0) {
      toast.error("Nothing to buy", { description: "All materials are covered by current stock, or have invalid pack counts (check unitsPerPack on Materials page)." })
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/shoppinglist/create-pos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: itemsToBuy }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? "Failed")
      }

      const data = await res.json()
      const poList = data.created.map((p: any) => `${p.poNumber} (${p.supplier})`).join(", ")
      toast.success(`${data.count} POs created`, {
        description: `${poList} · $${data.totalCost.toLocaleString("es-MX", { maximumFractionDigits: 0 })} total`,
      })
      router.refresh()
    } catch (e) {
      toast.error("Failed to create POs", {
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setLoading(false)
    }
  }

  const hasItems = supplierGroups.some((g) => g.materials.some((m) => Number.isFinite(m.packsToBuy) && m.packsToBuy > 0))

  return (
    <button
      onClick={handleCreate}
      disabled={loading || !hasItems}
      className="fmd-btn success"
      style={{ opacity: loading || !hasItems ? 0.5 : 1, cursor: loading || !hasItems ? "not-allowed" : "pointer" }}
    >
      {loading ? "Creating..." : "📝 Create POs (1 per supplier)"}
    </button>
  )
}
