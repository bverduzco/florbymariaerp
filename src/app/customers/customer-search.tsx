"use client"

// src/app/customers/customer-search.tsx
//
// Client-side searchable customer list.
// Filter by name, phone, or email as you type.

import { useState } from "react"
import { Badge } from "@/components/ui/badge"

type CustomerLite = {
  id: string
  name: string
  phone: string | null
  email: string | null
  address: string | null
  notes: string | null
  createdAt: string
  orderCount: number
  eventCount: number
  quoteCount: number
  lifetimeValue: number
}

interface CustomerSearchProps {
  customers: CustomerLite[]
}

export function CustomerSearch({ customers }: CustomerSearchProps) {
  const [query, setQuery] = useState("")

  const filtered = customers.filter((c) => {
    if (!query) return true
    const q = query.toLowerCase()
    return (
      c.name.toLowerCase().includes(q) ||
      (c.phone?.toLowerCase().includes(q) ?? false) ||
      (c.email?.toLowerCase().includes(q) ?? false)
    )
  })

  return (
    <div>
      {/* Search input */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by name, phone, or email..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full px-4 py-2 text-sm border border-stone-300 rounded-md focus:outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-900"
        />
        <div className="text-xs text-stone-500 mt-1">
          {filtered.length} of {customers.length} customers shown
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-200 text-stone-600 text-xs uppercase tracking-wider">
              <th className="text-left py-2 px-3">Name</th>
              <th className="text-left py-2 px-3">Contact</th>
              <th className="text-right py-2 px-3">Orders</th>
              <th className="text-right py-2 px-3">Events</th>
              <th className="text-right py-2 px-3">Quotes</th>
              <th className="text-right py-2 px-3">Lifetime value</th>
              <th className="text-left py-2 px-3">Added</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-stone-400">
                  No customers match &quot;{query}&quot;
                </td>
              </tr>
            ) : (
              filtered.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-stone-100 hover:bg-stone-50 cursor-pointer"
                >
                  <td className="py-3 px-3">
                    <div className="font-medium text-stone-900">{c.name}</div>
                    {c.notes && (
                      <div className="text-xs text-stone-500 line-clamp-1 mt-0.5">{c.notes}</div>
                    )}
                  </td>
                  <td className="py-3 px-3">
                    {c.phone && <div className="text-xs text-stone-700">{c.phone}</div>}
                    {c.email && <div className="text-xs text-stone-500">{c.email}</div>}
                    {!c.phone && !c.email && <span className="text-stone-400 text-xs">No contact info</span>}
                  </td>
                  <td className="py-3 px-3 text-right">
                    {c.orderCount > 0 ? (
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">
                        {c.orderCount}
                      </Badge>
                    ) : (
                      <span className="text-stone-400 text-xs">0</span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-right">
                    {c.eventCount > 0 ? (
                      <Badge variant="outline" className="bg-violet-50 text-violet-700 border-violet-300">
                        {c.eventCount}
                      </Badge>
                    ) : (
                      <span className="text-stone-400 text-xs">0</span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-right text-stone-600">
                    {c.quoteCount > 0 ? c.quoteCount : <span className="text-stone-400">0</span>}
                  </td>
                  <td className="py-3 px-3 text-right font-medium text-emerald-700">
                    {c.lifetimeValue > 0
                      ? `$${c.lifetimeValue.toLocaleString("es-MX", { maximumFractionDigits: 0 })}`
                      : <span className="text-stone-400">—</span>}
                  </td>
                  <td className="py-3 px-3 text-xs text-stone-500">
                    {new Date(c.createdAt).toLocaleDateString("es-MX", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
