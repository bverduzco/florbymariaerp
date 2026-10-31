"use client"

// src/app/materials/material-search.tsx
//
// Client-side searchable + filterable materials table.
// Filter by name/SKU + by category.

import { useState } from "react"
import { Badge } from "@/components/ui/badge"

type MaterialLite = {
  id: string
  sku: string
  name: string
  category: string
  unit: string
  unitCost: number | null
  supplier: string | null
  currentStockPacks: number | null
  reorderLevelPacks: number | null
  packPrice: number | null
  unitsPerPack: number | null
  colors: string | null
  notes: string | null
}

interface MaterialSearchProps {
  materials: MaterialLite[]
}

const CATEGORY_COLORS: Record<string, string> = {
  flower: "bg-rose-50 text-rose-700 border-rose-300",
  foliage: "bg-emerald-50 text-emerald-700 border-emerald-300",
  packaging: "bg-amber-50 text-amber-700 border-amber-300",
  other: "bg-stone-100 text-stone-700 border-stone-300",
}

export function MaterialSearch({ materials }: MaterialSearchProps) {
  const [query, setQuery] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [sortBy, setSortBy] = useState<string>("name")

  const filtered = materials
    .filter((m) => {
      if (categoryFilter !== "all" && m.category !== categoryFilter) return false
      if (!query) return true
      const q = query.toLowerCase()
      return (
        m.name.toLowerCase().includes(q) ||
        m.sku.toLowerCase().includes(q) ||
        (m.colors?.toLowerCase().includes(q) ?? false)
      )
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "price":
          return (b.packPrice ?? 0) - (a.packPrice ?? 0)
        case "stock":
          return (b.currentStockPacks ?? 0) - (a.currentStockPacks ?? 0)
        case "category":
          return a.category.localeCompare(b.category) || a.name.localeCompare(b.name)
        default:
          return a.name.localeCompare(b.name)
      }
    })

  const categories = Array.from(new Set(materials.map((m) => m.category)))

  function getStockStatus(m: MaterialLite): { label: string; color: string } {
    const stock = m.currentStockPacks ?? 0
    const reorder = m.reorderLevelPacks
    if (!reorder) {
      return stock > 0
        ? { label: "In stock", color: "bg-emerald-50 text-emerald-700 border-emerald-300" }
        : { label: "Not tracked", color: "bg-stone-100 text-stone-500 border-stone-300" }
    }
    if (stock === 0) return { label: "Out of stock", color: "bg-red-50 text-red-700 border-red-300" }
    if (stock <= reorder) return { label: "Reorder", color: "bg-amber-50 text-amber-700 border-amber-300" }
    return { label: "In stock", color: "bg-emerald-50 text-emerald-700 border-emerald-300" }
  }

  return (
    <div>
      {/* Search + filter + sort row */}
      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="text"
          placeholder="Search by name, SKU, or color..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 min-w-[200px] px-4 py-2 text-sm border border-stone-300 rounded-md focus:outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-900"
        />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-stone-300 rounded-md focus:outline-none focus:border-stone-900"
        >
          <option value="all">All categories</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat} ({materials.filter((m) => m.category === cat).length})
            </option>
          ))}
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="px-3 py-2 text-sm border border-stone-300 rounded-md focus:outline-none focus:border-stone-900"
        >
          <option value="name">Sort: Name</option>
          <option value="price">Sort: Price (high→low)</option>
          <option value="stock">Sort: Stock (high→low)</option>
          <option value="category">Sort: Category</option>
        </select>
      </div>
      <div className="text-xs text-stone-500 mb-3">
        {filtered.length} of {materials.length} materials shown
      </div>

      {/* Table */}
      <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-white">
            <tr className="border-b border-stone-200 text-stone-600 text-xs uppercase tracking-wider">
              <th className="text-left py-2 px-3">SKU</th>
              <th className="text-left py-2 px-3">Name</th>
              <th className="text-left py-2 px-3">Category</th>
              <th className="text-right py-2 px-3">Stock (packs)</th>
              <th className="text-right py-2 px-3">Pack price</th>
              <th className="text-right py-2 px-3">Units/pack</th>
              <th className="text-right py-2 px-3">Unit cost</th>
              <th className="text-left py-2 px-3">Status</th>
              <th className="text-left py-2 px-3">Supplier</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-stone-400">
                  No materials match your search.
                </td>
              </tr>
            ) : (
              filtered.map((m) => {
                const status = getStockStatus(m)
                return (
                  <tr key={m.id} className="border-b border-stone-100 hover:bg-stone-50">
                    <td className="py-2 px-3 font-mono text-xs text-stone-500">{m.sku}</td>
                    <td className="py-2 px-3">
                      <div className="font-medium text-stone-900">{m.name}</div>
                      {m.colors && (
                        <div className="text-xs text-stone-500">{m.colors}</div>
                      )}
                    </td>
                    <td className="py-2 px-3">
                      <Badge
                        variant="outline"
                        className={`text-xs ${CATEGORY_COLORS[m.category] ?? CATEGORY_COLORS.other}`}
                      >
                        {m.category}
                      </Badge>
                    </td>
                    <td className="py-2 px-3 text-right">
                      <span className={m.currentStockPacks === 0 || m.currentStockPacks === null ? "text-stone-400" : "text-stone-900 font-medium"}>
                        {m.currentStockPacks ?? 0}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right text-stone-700">
                      {m.packPrice ? `$${m.packPrice.toLocaleString("es-MX", { maximumFractionDigits: 0 })}` : "—"}
                    </td>
                    <td className="py-2 px-3 text-right text-stone-700">
                      {m.unitsPerPack ?? "—"}
                    </td>
                    <td className="py-2 px-3 text-right text-stone-700">
                      {m.unitCost ? `$${m.unitCost.toLocaleString("es-MX", { maximumFractionDigits: 2 })}` : "—"}
                    </td>
                    <td className="py-2 px-3">
                      <Badge variant="outline" className={`text-xs ${status.color}`}>
                        {status.label}
                      </Badge>
                    </td>
                    <td className="py-2 px-3 text-xs text-stone-500">{m.supplier ?? "—"}</td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
