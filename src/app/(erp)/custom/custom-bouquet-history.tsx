"use client"

import { useState, ReactNode } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

/**
 * CustomBouquetHistory — renders a table of recent hidden custom recipes
 * (the audit trail of every custom bouquet that became an order).
 *
 * Each row shows: CBQ number, name, date, customer (from linked Order),
 * stems count, total cost, suggested price. Clicking opens a detail dialog
 * with the full material breakdown.
 *
 * Server-side `page.tsx` already enriched each recipe with its linked Order
 * + customer info via the SKU on the order's line items.
 */

type RecipeLine = {
  id: string
  materialName: string
  materialType: string
  materialPrice: number
  qty: number
}

type Recipe = {
  id: string
  name: string
  erpProductSku: string | null
  size: string | null
  description: string | null
  flowersCost: number
  otherMaterialsCost: number
  totalCost: number
  suggestedPrice: number
  actualPrice: number
  createdAt: Date
  lines: RecipeLine[]
}

type LinkedOrder = {
  orderNumber: string
  customerName: string
  deliveryDate: Date | null
} | null

export function CustomBouquetHistory({
  recipes,
}: {
  recipes: Array<{ recipe: Recipe; order: LinkedOrder }>
}) {
  return (
    <div className="fmd-box" style={{ marginBottom: 0 }}>
      <div className="fmd-box-label">
        📚 Custom Bouquet History — last {recipes.length} order-attached recipes (audit trail)
      </div>
      <div style={{ fontSize: "11px", color: "#78716C", marginBottom: "8px", lineHeight: 1.5 }}>
        Every custom bouquet that became an Order is preserved here as a hidden recipe
        (SKU prefix <code style={{ background: "#fff", padding: "1px 4px", borderRadius: "3px" }}>CBQ-NNNN</code>).
        These do <strong>not</strong> appear in the Catalogue or Recipes tabs. Click any row
        for the full material breakdown.
      </div>
      <div style={{ overflowX: "auto" }}>
        <table className="fmd-table">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Name</th>
              <th>Date</th>
              <th>Customer</th>
              <th>Order #</th>
              <th style={{ textAlign: "right" }}>Stems</th>
              <th style={{ textAlign: "right" }}>Cost</th>
              <th style={{ textAlign: "right" }}>Price</th>
            </tr>
          </thead>
          <tbody>
            {recipes.map(({ recipe, order }) => {
              const stems = recipe.lines.reduce((s, l) => s + l.qty, 0)
              return (
                <tr key={recipe.id}>
                  <td style={{ fontFamily: "monospace", fontSize: "11px" }}>
                    <RecipeDetailDialog recipe={recipe} order={order}>
                      <button
                        type="button"
                        className="font-mono text-[11px] font-bold text-stone-900 hover:text-rose-700 hover:underline transition"
                        title={`View details for ${recipe.erpProductSku ?? "—"}`}
                      >
                        {recipe.erpProductSku ?? "—"}
                      </button>
                    </RecipeDetailDialog>
                  </td>
                  <td style={{ fontWeight: 600, color: "#44403C" }}>
                    {recipe.name}
                    {recipe.size && <span style={{ fontSize: "10px", color: "#78716C", marginLeft: "4px" }}>({recipe.size})</span>}
                  </td>
                  <td>{new Date(recipe.createdAt).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}</td>
                  <td style={{ color: "#44403C" }}>{order?.customerName ?? "—"}</td>
                  <td style={{ fontFamily: "monospace", fontSize: "11px", color: "#44403C" }}>{order?.orderNumber ?? "—"}</td>
                  <td style={{ textAlign: "right" }}>{stems}</td>
                  <td style={{ textAlign: "right", color: "#991B1B" }}>${recipe.totalCost.toLocaleString("es-MX", { maximumFractionDigits: 0 })}</td>
                  <td style={{ textAlign: "right", fontWeight: 600, color: "#BE185D" }}>${recipe.actualPrice.toLocaleString("es-MX", { maximumFractionDigits: 0 })}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Recipe detail dialog ────────────────────────────────────────────────────

function RecipeDetailDialog({
  recipe,
  order,
  children,
}: {
  recipe: Recipe
  order: LinkedOrder
  children: ReactNode
}) {
  const stems = recipe.lines.reduce((s, l) => s + l.qty, 0)

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[640px] max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <span className="font-mono">{recipe.erpProductSku ?? "—"}</span>
            <span className="text-stone-700">{recipe.name}</span>
            {recipe.size && <span className="text-xs text-stone-500">({recipe.size})</span>}
          </DialogTitle>
        </DialogHeader>

        {/* Summary grid */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="border border-stone-200 rounded-md p-3">
            <div className="text-[9px] uppercase tracking-wider text-stone-500 mb-2">Recipe</div>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-stone-500">Created</span>
                <span>{new Date(recipe.createdAt).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Stems</span>
                <span>{stems}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Materials</span>
                <span>{recipe.lines.length}</span>
              </div>
            </div>
          </div>
          <div className="border border-stone-200 rounded-md p-3">
            <div className="text-[9px] uppercase tracking-wider text-stone-500 mb-2">Pricing</div>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-stone-500">Flowers cost</span>
                <span className="tabular-nums">${recipe.flowersCost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Other cost</span>
                <span className="tabular-nums">${recipe.otherMaterialsCost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span className="text-stone-700">Total cost</span>
                <span className="tabular-nums">${recipe.totalCost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-semibold text-rose-700">
                <span>Sold at</span>
                <span className="tabular-nums">${recipe.actualPrice.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Linked order (if any) */}
        {order && (
          <div className="border border-blue-200 bg-blue-50 rounded-md p-3 text-xs">
            <div className="text-[9px] uppercase tracking-wider text-blue-700 mb-1">Linked order</div>
            <div className="space-y-0.5">
              <div><span className="font-mono">{order.orderNumber}</span> · <span className="font-medium">{order.customerName}</span></div>
              {order.deliveryDate && (
                <div className="text-blue-700">Delivery: {new Date(order.deliveryDate).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}</div>
              )}
            </div>
          </div>
        )}

        {/* Material breakdown */}
        <div className="border border-stone-200 rounded-md overflow-hidden">
          <div className="px-3 py-2 bg-stone-50 border-b border-stone-200 text-xs font-semibold text-stone-700">
            Material breakdown ({recipe.lines.length})
          </div>
          <table className="w-full text-xs">
            <thead className="bg-stone-50 text-stone-600">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Material</th>
                <th className="text-left px-3 py-2 font-medium w-20">Type</th>
                <th className="text-right px-3 py-2 font-medium w-16">Qty</th>
                <th className="text-right px-3 py-2 font-medium w-24">$/stem</th>
                <th className="text-right px-3 py-2 font-medium w-24">Line cost</th>
              </tr>
            </thead>
            <tbody>
              {recipe.lines.map((l) => (
                <tr key={l.id} className="border-t border-stone-100">
                  <td className="px-3 py-2 font-medium text-stone-800">{l.materialName}</td>
                  <td className="px-3 py-2 text-stone-600">{l.materialType}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{l.qty}</td>
                  <td className="px-3 py-2 text-right tabular-nums">${l.materialPrice.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums">${(l.materialPrice * l.qty).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Description (if present) */}
        {recipe.description && (
          <div className="border border-amber-200 bg-amber-50 rounded-md p-3 text-xs text-amber-900">
            <div className="text-[9px] uppercase tracking-wider text-amber-700 mb-1">Description</div>
            {recipe.description}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
