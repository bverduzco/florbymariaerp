"use client"

import { useState } from "react"
import { StatusDropdown } from "@/components/status-dropdown"
import { CustomerDetailDialog, type CustomerDetailCustomer } from "@/components/customer-detail-dialog"
import { EditCustomerDialog } from "./edit-customer-dialog"

interface CustomerSearchProps {
  customers: CustomerDetailCustomer[]
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
              <th></th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={10} style={{ textAlign: "center", padding: "16px", color: "#9CA3AF" }}>No customers match &quot;{query}&quot;</td></tr>
            ) : (
              filtered.map((c) => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 600, color: "#44403C" }}>
                    <CustomerDetailDialog
                      customer={c}
                      trigger={
                        <button
                          className="text-left hover:text-rose-700 hover:underline transition"
                          title={`View details for ${c.name}`}
                        >
                          {c.name}
                        </button>
                      }
                    />
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
                  <td style={{ fontSize: "11px" }}>{c.createdAt ? new Date(c.createdAt as string).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" }) : "—"}</td>
                  <td style={{ padding: "6px" }}>
                    <CustomerDetailDialog
                      customer={c}
                      trigger={
                        <button
                          className="px-2 py-1 text-xs border border-stone-300 rounded hover:bg-rose-50 hover:border-rose-400 hover:text-rose-700 transition"
                          title={`View details for ${c.name}`}
                        >
                          Details →
                        </button>
                      }
                    />
                  </td>
                  <td style={{ padding: "6px" }}>
                    <EditCustomerDialog
                      customer={{
                        id: c.id,
                        name: c.name,
                        phone: c.phone,
                        email: c.email,
                        address: c.address,
                        notes: c.notes,
                      }}
                      trigger={
                        <button
                          className="px-2 py-1 text-xs border border-stone-300 rounded hover:bg-stone-900 hover:text-white hover:border-stone-900 transition"
                          title={`Edit ${c.name}`}
                        >
                          ✏️ Edit
                        </button>
                      }
                    />
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
