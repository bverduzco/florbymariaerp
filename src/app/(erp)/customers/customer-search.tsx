"use client"

import { useState } from "react"
import { StatusDropdown } from "@/components/status-dropdown"

type CustomerLite = {
  id: string
  name: string
  phone: string | null
  email: string | null
  address: string | null
  notes: string | null
  status: string
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
          {filtered.length} of {customers.length} contacts shown
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto" }}>
        <table className="fmd-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Contact</th>
              <th>Status</th>
              <th style={{ textAlign: "right" }}>Orders</th>
              <th style={{ textAlign: "right" }}>Quotes</th>
              <th style={{ textAlign: "right" }}>LTV</th>
              <th>Added</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: "center", padding: "16px", color: "#9CA3AF" }}>No customers match &quot;{query}&quot;</td></tr>
            ) : (
              filtered.map((c) => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 600, color: "#44403C" }}>
                    {c.name}
                    {c.notes && <div style={{ fontSize: "10px", color: "#78716C", fontWeight: 400 }}>{c.notes}</div>}
                  </td>
                  <td>
                    {c.phone && <div style={{ fontSize: "11px" }}>{c.phone}</div>}
                    {c.email && <div style={{ fontSize: "11px", color: "#78716C" }}>{c.email}</div>}
                    {!c.phone && !c.email && <span style={{ color: "#D6D3D1", fontSize: "11px" }}>No contact info</span>}
                  </td>
                  <td>
                    <StatusDropdown
                      entityId={c.id}
                      currentStatus={c.status}
                      statuses={[
                        { value: "lead", label: "Lead" },
                        { value: "prospect", label: "Prospect" },
                        { value: "customer", label: "Customer" },
                        { value: "inactive", label: "Inactive" },
                      ]}
                      apiPath="/api/customers/{id}/status"
                    />
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {c.orderCount > 0 ? <span className="fmd-status" style={{ background: "#EFF6FF", color: "#1E40AF" }}>{c.orderCount}</span> : <span style={{ color: "#D6D3D1" }}>0</span>}
                  </td>
                  <td style={{ textAlign: "right" }}>{c.quoteCount > 0 ? c.quoteCount : <span style={{ color: "#D6D3D1" }}>0</span>}</td>
                  <td style={{ textAlign: "right", fontWeight: 600, color: c.lifetimeValue > 0 ? "#047857" : "#D6D3D1" }}>
                    {c.lifetimeValue > 0 ? `$${c.lifetimeValue.toLocaleString("es-MX", { maximumFractionDigits: 0 })}` : "—"}
                  </td>
                  <td style={{ fontSize: "11px" }}>{new Date(c.createdAt).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
