"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

type Material = {
  id: string
  name: string
  pricePerStem: number
  type: string
  class: string | null
  source: string
  erpSku: string | null
  erpName: string | null
  matchConfidence: string | null
}

type CustomerOption = {
  id: string
  name: string
  phone: string | null
}

type SelectedItem = {
  materialId: string
  name: string
  pricePerStem: number
  type: string
  qty: number
}

// Pricing rules from Assumptions sheet
const FLOWERS_MULTIPLIER = 2.5
const OTHER_MULTIPLIER = 2.0
const LABOR_SURCHARGE = 0.40
const IVA_RATE = 0.16

const TYPE_EMOJI: Record<string, string> = { flower: "🌹", foliage: "🌿" }
const TYPE_COLOR: Record<string, string> = { flower: "#FCE7F3:#BE185D", foliage: "#D1FAE5:#065F46" }

export function CustomBouquetBuilder({ materials, customers }: { materials: Material[]; customers: CustomerOption[] }) {
  const [query, setQuery] = useState("")
  const [typeFilter, setTypeFilter] = useState("all")
  const [sortBy, setSortBy] = useState("name")
  const [selected, setSelected] = useState<Map<string, SelectedItem>>(new Map())
  const [bouquetName, setBouquetName] = useState("")
  const [bouquetSize, setBouquetSize] = useState("Medium")
  const [saving, setSaving] = useState(false)
  // "Create Order" dialog state
  const [orderDialogOpen, setOrderDialogOpen] = useState(false)
  const [orderSaving, setOrderSaving] = useState(false)
  const [orderForm, setOrderForm] = useState({
    name: "",        // recipe name (pre-filled from bouquetName; left blank → server defaults to "Custom Bouquet CBQ-NNNN")
    customerId: "",
    deliveryDate: "",
    deliveryAddress: "",
    cardMessage: "",
    internalNotes: "",
  })
  const router = useRouter()

  // Filtered + sorted materials
  const filtered = useMemo(() => {
    let result = materials.filter((m) => {
      if (typeFilter !== "all" && m.type !== typeFilter) return false
      if (!query) return true
      const q = query.toLowerCase()
      return m.name.toLowerCase().includes(q) || (m.erpSku?.toLowerCase().includes(q) ?? false)
    })
    result = [...result].sort((a, b) => {
      if (sortBy === "price") return b.pricePerStem - a.pricePerStem
      if (sortBy === "type") return a.type.localeCompare(b.type) || a.name.localeCompare(b.name)
      return a.name.localeCompare(b.name)
    })
    return result
  }, [materials, query, typeFilter, sortBy])

  // Computed costs
  const { flowersCost, otherCost, totalCost, stemsCount, suggestedPrice, priceWithIva } = useMemo(() => {
    const items = Array.from(selected.values())
    const flowers = items.filter((i) => i.type === "flower")
    const other = items.filter((i) => i.type !== "flower")
    const fc = flowers.reduce((s, i) => s + i.pricePerStem * i.qty, 0)
    const oc = other.reduce((s, i) => s + i.pricePerStem * i.qty, 0)
    const tc = fc + oc
    const sc = items.reduce((s, i) => s + i.qty, 0)
    const flowersPriced = fc * FLOWERS_MULTIPLIER
    const otherPriced = oc * OTHER_MULTIPLIER
    const subtotal = flowersPriced + otherPriced
    const withLabor = subtotal * (1 + LABOR_SURCHARGE)
    const withIva = withLabor * (1 + IVA_RATE)
    return { flowersCost: fc, otherCost: oc, totalCost: tc, stemsCount: sc, suggestedPrice: withLabor, priceWithIva: withIva }
  }, [selected])

  function addMaterial(m: Material) {
    const existing = selected.get(m.id)
    if (existing) {
      setSelected(new Map(selected).set(m.id, { ...existing, qty: existing.qty + 1 }))
    } else {
      setSelected(new Map(selected).set(m.id, {
        materialId: m.id, name: m.name, pricePerStem: m.pricePerStem, type: m.type, qty: 1,
      }))
    }
  }

  function changeQty(materialId: string, delta: number) {
    const item = selected.get(materialId)
    if (!item) return
    const newQty = item.qty + delta
    const newMap = new Map(selected)
    if (newQty <= 0) {
      newMap.delete(materialId)
    } else {
      newMap.set(materialId, { ...item, qty: newQty })
    }
    setSelected(newMap)
  }

  function removeItem(materialId: string) {
    const newMap = new Map(selected)
    newMap.delete(materialId)
    setSelected(newMap)
  }

  async function handleSaveRecipe() {
    if (selected.size === 0) {
      toast.error("No materials selected", { description: "Add at least one material to save a recipe." })
      return
    }
    setSaving(true)
    try {
      const items = Array.from(selected.values())
      const res = await fetch("/api/custom-recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: bouquetName || `Custom Bouquet (${bouquetSize})`,
          size: bouquetSize,
          description: `Custom bouquet with ${items.length} materials, ${stemsCount} stems`,
          lines: items.map((i) => ({
            customMaterialId: i.materialId,
            qty: i.qty,
          })),
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? "Failed")
      }
      const data = await res.json()
      toast.success("Recipe saved", {
        description: `${data.recipe?.name ?? "Custom Bouquet"} · ${stemsCount} stems · $${suggestedPrice.toFixed(0)} suggested`,
      })
      setSelected(new Map())
      setBouquetName("")
      router.refresh()
    } catch (e) {
      toast.error("Failed to save recipe", { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setSaving(false)
    }
  }

  function handleCreateOrderClick() {
    if (selected.size === 0) {
      toast.error("No materials selected", { description: "Add materials first." })
      return
    }
    if (customers.length === 0) {
      toast.error("No customers", { description: "Add a customer on the Customers page first." })
      return
    }
    // Pre-fill the recipe name with whatever was typed in the Live Preview panel.
    // Maria can leave it blank — the server will default to "Custom Bouquet CBQ-NNNN".
    setOrderForm((prev) => ({ ...prev, name: bouquetName }))
    setOrderDialogOpen(true)
  }

  async function handleCreateOrderSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!orderForm.customerId) {
      toast.error("Customer is required")
      return
    }
    if (selected.size === 0) return
    setOrderSaving(true)
    try {
      const items = Array.from(selected.values())
      const res = await fetch("/api/custom-recipes/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: orderForm.name.trim() || undefined,  // undefined → server defaults to "Custom Bouquet CBQ-NNNN"
          size: bouquetSize,
          actualPrice: suggestedPrice,  // pre-IVA
          customerId: orderForm.customerId,
          deliveryDate: orderForm.deliveryDate || undefined,
          deliveryAddress: orderForm.deliveryAddress || undefined,
          cardMessage: orderForm.cardMessage || undefined,
          internalNotes: orderForm.internalNotes || undefined,
          lines: items.map((i) => ({
            customMaterialId: i.materialId,
            qty: i.qty,
          })),
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? "Failed")
      }
      const data = await res.json()
      toast.success("Order created", {
        description: `${data.order?.orderNumber ?? "Order"} · ${data.recipe?.name ?? "Custom Bouquet"} · ${data.order?.customerName ?? ""} · $${data.order?.actualPrice?.toFixed(0) ?? suggestedPrice.toFixed(0)}`,
      })
      // Reset everything
      setOrderDialogOpen(false)
      setSelected(new Map())
      setBouquetName("")
      setOrderForm({ name: "", customerId: "", deliveryDate: "", deliveryAddress: "", cardMessage: "", internalNotes: "" })
      router.refresh()
    } catch (e) {
      toast.error("Failed to create order", { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setOrderSaving(false)
    }
  }

  const selectedItems = Array.from(selected.values())

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: "16px", alignItems: "start" }}>
      {/* LEFT COLUMN: Material picker + Selected materials */}
      <div>
        {/* Material picker */}
        <div className="fmd-box" style={{ marginBottom: "12px" }}>
          <div className="fmd-box-label">Material List ({filtered.length} available)</div>
          {/* Search + filter + sort */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "8px" }}>
            <input
              type="text"
              placeholder="Search materials..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{ flex: 1, minWidth: "150px", padding: "6px 10px", fontSize: "12px", border: "1px solid #D6D3D1", borderRadius: "4px" }}
            />
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={{ padding: "6px 8px", fontSize: "12px", border: "1px solid #D6D3D1", borderRadius: "4px" }}>
              <option value="all">All types</option>
              <option value="flower">🌹 Flowers</option>
              <option value="foliage">🌿 Foliage</option>
            </select>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={{ padding: "6px 8px", fontSize: "12px", border: "1px solid #D6D3D1", borderRadius: "4px" }}>
              <option value="name">Sort: Name</option>
              <option value="price">Sort: Price</option>
              <option value="type">Sort: Type</option>
            </select>
          </div>
          {/* Material grid — clickable */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "6px", maxHeight: "300px", overflowY: "auto" }}>
            {filtered.map((m) => {
              const [bg, color] = (TYPE_COLOR[m.type] ?? "#F3F4F6:#44403C").split(":")
              const isSelected = selected.has(m.id)
              return (
                <div
                  key={m.id}
                  onClick={() => addMaterial(m)}
                  style={{
                    padding: "8px", border: "1px solid #D6D3D1", borderRadius: "6px", background: isSelected ? "#FCE7F3" : "#ffffff",
                    cursor: "pointer", transition: "border-color 0.1s", fontSize: "12px",
                  }}
                  onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.borderColor = "#BE185D" }}
                  onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.borderColor = "#D6D3D1" }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontWeight: 600, color: "#44403C" }}>{TYPE_EMOJI[m.type]} {m.name}</div>
                      <div style={{ fontSize: "10px", color: "#78716C" }}>{m.type} · {m.class ?? "—"}</div>
                    </div>
                    <div style={{ fontWeight: 700, color: "#BE185D" }}>${m.pricePerStem.toFixed(2)}</div>
                  </div>
                  {isSelected && <div style={{ fontSize: "10px", color: "#BE185D", marginTop: "2px" }}>✓ Added ×{selected.get(m.id)?.qty}</div>}
                </div>
              )
            })}
            {filtered.length === 0 && <div style={{ textAlign: "center", padding: "16px", color: "#9CA3AF", fontSize: "12px" }}>No materials match.</div>}
          </div>
        </div>

        {/* Selected materials */}
        <div className="fmd-box" style={{ marginBottom: 0 }}>
          <div className="fmd-box-label">Selected Materials ({selectedItems.length})</div>
          {selectedItems.length === 0 ? (
            <div style={{ textAlign: "center", padding: "16px", color: "#9CA3AF", fontSize: "12px" }}>Click materials above to add them to your bouquet.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {selectedItems.map((item) => {
                const [bg, color] = (TYPE_COLOR[item.type] ?? "#F3F4F6:#44403C").split(":")
                return (
                  <div key={item.materialId} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px", border: "1px solid #D6D3D1", borderRadius: "6px", background: "#ffffff" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "13px", fontWeight: 600, color: "#44403C" }}>{TYPE_EMOJI[item.type]} {item.name}</div>
                      <div style={{ fontSize: "10px", color: "#78716C" }}>${item.pricePerStem.toFixed(2)}/stem · {item.type}</div>
                    </div>
                    {/* Qty controls */}
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <button onClick={() => changeQty(item.materialId, -1)} style={{ width: "24px", height: "24px", border: "1px solid #D6D3D1", borderRadius: "4px", background: "#FAFAF9", cursor: "pointer", fontSize: "14px", color: "#44403C" }}>−</button>
                      <span style={{ fontSize: "14px", fontWeight: 700, color: "#44403C", minWidth: "20px", textAlign: "center" }}>{item.qty}</span>
                      <button onClick={() => changeQty(item.materialId, 1)} style={{ width: "24px", height: "24px", border: "1px solid #D6D3D1", borderRadius: "4px", background: "#FAFAF9", cursor: "pointer", fontSize: "14px", color: "#44403C" }}>+</button>
                      <span style={{ fontSize: "13px", fontWeight: 700, color: "#BE185D", marginLeft: "8px", minWidth: "50px", textAlign: "right" }}>${(item.pricePerStem * item.qty).toFixed(2)}</span>
                      <button onClick={() => removeItem(item.materialId)} style={{ width: "20px", height: "20px", border: "none", background: "transparent", cursor: "pointer", fontSize: "14px", color: "#991B1B", marginLeft: "4px" }}>✕</button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: Live Preview (sticky) */}
      <div style={{ position: "sticky", top: "0" }}>
        <div className="fmd-box" style={{ marginBottom: 0 }}>
          <div className="fmd-box-label">Live Preview</div>

          {/* Bouquet name + size inputs */}
          <div style={{ marginBottom: "10px" }}>
            <input
              type="text"
              placeholder="Bouquet name (optional)"
              value={bouquetName}
              onChange={(e) => setBouquetName(e.target.value)}
              style={{ width: "100%", padding: "6px 8px", fontSize: "12px", border: "1px solid #D6D3D1", borderRadius: "4px", marginBottom: "6px" }}
            />
            <select value={bouquetSize} onChange={(e) => setBouquetSize(e.target.value)} style={{ width: "100%", padding: "6px 8px", fontSize: "12px", border: "1px solid #D6D3D1", borderRadius: "4px" }}>
              <option>Small</option>
              <option>Medium</option>
              <option>Large</option>
            </select>
          </div>

          {/* Cost breakdown */}
          <div style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 8px", background: "#FAFAF9", border: "1px solid #D6D3D1", borderRadius: "4px" }}>
              <span style={{ color: "#6B7280" }}>Materials:</span>
              <span style={{ fontWeight: 600, color: "#44403C" }}>{selectedItems.length}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 8px", background: "#FAFAF9", border: "1px solid #D6D3D1", borderRadius: "4px" }}>
              <span style={{ color: "#6B7280" }}>Stems:</span>
              <span style={{ fontWeight: 600, color: "#44403C" }}>{stemsCount}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 8px", background: "#FAFAF9", border: "1px solid #D6D3D1", borderRadius: "4px" }}>
              <span style={{ color: "#6B7280" }}>Flowers cost:</span>
              <span style={{ fontWeight: 600, color: "#44403C" }}>${flowersCost.toFixed(2)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 8px", background: "#FAFAF9", border: "1px solid #D6D3D1", borderRadius: "4px" }}>
              <span style={{ color: "#6B7280" }}>Other materials:</span>
              <span style={{ fontWeight: 600, color: "#44403C" }}>${otherCost.toFixed(2)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 8px", background: "#FAFAF9", border: "1px solid #D6D3D1", borderRadius: "4px" }}>
              <span style={{ color: "#6B7280" }}>Total cost:</span>
              <span style={{ fontWeight: 700, color: "#44403C" }}>${totalCost.toFixed(2)}</span>
            </div>

            {/* Divider */}
            <div style={{ borderTop: "1px solid #D6D3D1", margin: "4px 0" }} />

            {/* Pricing build-up */}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 8px" }}>
              <span style={{ color: "#6B7280" }}>Flowers ×{FLOWERS_MULTIPLIER}:</span>
              <span style={{ color: "#44403C" }}>${(flowersCost * FLOWERS_MULTIPLIER).toFixed(2)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 8px" }}>
              <span style={{ color: "#6B7280" }}>Other ×{OTHER_MULTIPLIER}:</span>
              <span style={{ color: "#44403C" }}>${(otherCost * OTHER_MULTIPLIER).toFixed(2)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 8px" }}>
              <span style={{ color: "#6B7280" }}>Labor +{LABOR_SURCHARGE * 100}%:</span>
              <span style={{ color: "#44403C" }}>${(suggestedPrice - (flowersCost * FLOWERS_MULTIPLIER + otherCost * OTHER_MULTIPLIER)).toFixed(2)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 8px", background: "#FCE7F3", borderRadius: "4px", marginTop: "2px" }}>
              <span style={{ fontWeight: 700, color: "#BE185D" }}>Suggested price:</span>
              <span style={{ fontSize: "16px", fontWeight: 700, color: "#BE185D" }}>${suggestedPrice.toFixed(2)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 8px" }}>
              <span style={{ color: "#6B7280" }}>With IVA ({IVA_RATE * 100}%):</span>
              <span style={{ fontWeight: 600, color: "#44403C" }}>${priceWithIva.toFixed(2)}</span>
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "6px" }}>
            <button
              onClick={handleSaveRecipe}
              disabled={saving || selected.size === 0}
              className="fmd-btn primary"
              style={{ width: "100%", opacity: saving || selected.size === 0 ? 0.5 : 1, cursor: saving || selected.size === 0 ? "not-allowed" : "pointer" }}
              title="Save as a visible Product in the Catalogue. Use this when Maria designs a new signature bouquet she wants to sell again."
            >
              {saving ? "Saving..." : "💾 Save as Recipe (visible)"}
            </button>
            <button
              onClick={handleCreateOrderClick}
              disabled={selected.size === 0}
              className="fmd-btn success"
              style={{ width: "100%", opacity: selected.size === 0 ? 0.5 : 1, cursor: selected.size === 0 ? "not-allowed" : "pointer" }}
              title="Save as a hidden recipe (audit trail) + create an Order for a customer. Recipe does NOT appear in Catalogue."
            >
              📦 Create Order
            </button>
          </div>

          {/* ─── Create Order Dialog ─────────────────────────────────── */}
          <Dialog open={orderDialogOpen} onOpenChange={setOrderDialogOpen}>
            <DialogContent className="sm:max-w-[520px] max-h-[92vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Order from Custom Bouquet</DialogTitle>
              </DialogHeader>
              <div style={{ fontSize: "11px", color: "#78716C", background: "#F5F5F4", border: "1px solid #E7E5E4", borderRadius: "6px", padding: "6px 10px", marginBottom: "8px" }}>
                📦 Will save this design as a <strong>hidden recipe (CBQ-NNNN)</strong> for the audit trail
                and create an <strong>Order</strong> for the chosen customer. The recipe will NOT appear in
                the Catalogue or Recipes tabs.
              </div>
              <form onSubmit={handleCreateOrderSubmit} className="space-y-3 pt-1">
                {/* Bouquet composition preview (read-only) */}
                <div style={{ background: "#FAFAF9", border: "1px solid #E7E5E4", borderRadius: "6px", padding: "8px 10px", fontSize: "12px" }}>
                  <div style={{ fontWeight: 600, color: "#44403C", marginBottom: "4px" }}>
                    {selectedItems.length} materials · {stemsCount} stems · cost ${totalCost.toFixed(2)} · suggested ${suggestedPrice.toFixed(0)}
                  </div>
                  <div style={{ color: "#78716C", fontSize: "11px", lineHeight: 1.5 }}>
                    {selectedItems.map((i) => `${i.qty}× ${i.name}`).join(", ")}
                  </div>
                </div>

                {/* Bouquet name (optional) */}
                <div className="space-y-2">
                  <Label htmlFor="ord-name">Bouquet name (optional)</Label>
                  <Input
                    id="ord-name"
                    value={orderForm.name}
                    onChange={(e) => setOrderForm({ ...orderForm, name: e.target.value })}
                    placeholder="e.g. Garden Romance (leave blank → auto-named CBQ-0001)"
                  />
                </div>

                {/* Customer */}
                <div className="space-y-2">
                  <Label>Customer *</Label>
                  <Select value={orderForm.customerId} onValueChange={(v) => setOrderForm({ ...orderForm, customerId: v })} required>
                    <SelectTrigger><SelectValue placeholder="Select customer..." /></SelectTrigger>
                    <SelectContent className="max-h-[260px]">
                      {customers.length === 0 ? (
                        <SelectItem value="_none" disabled>No customers yet — add one on the Customers page first</SelectItem>
                      ) : (
                        customers.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}{c.phone ? ` · ${c.phone}` : ""}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {/* Delivery date + address */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="ord-date">Delivery date</Label>
                    <Input
                      id="ord-date"
                      type="date"
                      value={orderForm.deliveryDate}
                      onChange={(e) => setOrderForm({ ...orderForm, deliveryDate: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ord-addr">Delivery address</Label>
                    <Input
                      id="ord-addr"
                      value={orderForm.deliveryAddress}
                      onChange={(e) => setOrderForm({ ...orderForm, deliveryAddress: e.target.value })}
                      placeholder="Optional"
                    />
                  </div>
                </div>

                {/* Card message */}
                <div className="space-y-2">
                  <Label htmlFor="ord-card">Card message</Label>
                  <Textarea
                    id="ord-card"
                    value={orderForm.cardMessage}
                    onChange={(e) => setOrderForm({ ...orderForm, cardMessage: e.target.value })}
                    rows={2}
                    placeholder="What should the card say? Optional."
                  />
                </div>

                {/* Internal notes */}
                <div className="space-y-2">
                  <Label htmlFor="ord-notes">Internal notes</Label>
                  <Textarea
                    id="ord-notes"
                    value={orderForm.internalNotes}
                    onChange={(e) => setOrderForm({ ...orderForm, internalNotes: e.target.value })}
                    rows={2}
                    placeholder="Optional — automatically prefixed with [Custom]"
                  />
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setOrderDialogOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={orderSaving || !orderForm.customerId}>
                    {orderSaving ? "Creating..." : "✓ Create Order"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="fmd-note blue" style={{ marginTop: "8px" }}>
          🎨 <strong>Save as Recipe (visible)</strong>: promotes this design to your permanent Catalogue as a Product
          (rare — only for new signature bouquets). <strong>Create Order</strong>: saves the design as a hidden recipe
          (CBQ-NNNN) for the audit trail and immediately creates an Order for a customer. Hidden recipes don&apos;t
          appear in Catalogue or Recipes — view them in the <em>Custom Bouquet History</em> section below.
        </div>
      </div>
    </div>
  )
}
