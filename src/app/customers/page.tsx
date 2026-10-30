// src/app/customers/page.tsx
//
// Customer directory. Lists all customers with order/event counts and lifetime value.
// Searchable client-side.

import { db as prisma } from "@/lib/db"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { CustomerSearch } from "./customer-search"

async function getCustomers() {
  const customers = await prisma.customer.findMany({
    include: {
      _count: {
        select: { orders: true, events: true, quotes: true },
      },
      orders: {
        select: { deliveryFee: true, lineItems: { select: { unitPrice: true, qty: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  // Compute lifetime value per customer from orders
  return customers.map((c) => {
    const lifetimeValue = c.orders.reduce((sum, o) => {
      const itemsTotal = o.lineItems.reduce((s, l) => s + l.unitPrice * l.qty, 0)
      return sum + itemsTotal + o.deliveryFee
    }, 0)

    return {
      id: c.id,
      name: c.name,
      phone: c.phone,
      email: c.email,
      address: c.address,
      notes: c.notes,
      createdAt: c.createdAt.toISOString(),
      orderCount: c._count.orders,
      eventCount: c._count.events,
      quoteCount: c._count.quotes,
      lifetimeValue,
    }
  })
}

export default async function CustomersPage() {
  const customers = await getCustomers()

  const totalCustomers = customers.length
  const totalLtv = customers.reduce((s, c) => s + c.lifetimeValue, 0)
  const avgLtv = totalCustomers > 0 ? totalLtv / totalCustomers : 0

  return (
    <main className="min-h-screen bg-stone-50 px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-wrap justify-between items-start gap-4">
          <div>
            <div className="text-xs uppercase tracking-wider text-stone-500">
              Contact list + order history · v1.9
            </div>
            <h1 className="mt-1 text-3xl font-bold text-stone-900">Customers</h1>
            <p className="mt-1 text-sm text-stone-600">
              All contacts in the system. Click a customer to view their full order/event history.
            </p>
          </div>
          <button className="px-4 py-2 text-sm font-medium bg-stone-900 text-white rounded-md hover:bg-stone-800 transition">
            + Add Customer
          </button>
        </header>

        {/* KPI bar */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-0 mb-6 border border-stone-200 rounded-lg overflow-hidden bg-white">
          <KpiCell value={`${totalCustomers}`} label="Total customers" />
          <KpiCell
            value={`$${totalLtv.toLocaleString("es-MX", { maximumFractionDigits: 0 })}`}
            label="Total lifetime value"
            color="green"
          />
          <KpiCell
            value={`$${avgLtv.toLocaleString("es-MX", { maximumFractionDigits: 0 })}`}
            label="Average LTV"
            color="purple"
          />
        </div>

        {/* Customer list with client-side search */}
        <Card className="border-stone-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">All Customers</CardTitle>
          </CardHeader>
          <CardContent>
            <CustomerSearch customers={customers} />
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

function KpiCell({
  value,
  label,
  color = "default",
}: {
  value: string
  label: string
  color?: "default" | "green" | "purple"
}) {
  const colorMap = {
    default: "text-stone-900",
    green: "text-emerald-700",
    purple: "text-violet-700",
  }
  return (
    <div className="p-4 border-r border-stone-200 last:border-r-0">
      <div className={`text-xl font-bold ${colorMap[color]}`}>{value}</div>
      <div className="text-xs text-stone-500 mt-0.5">{label}</div>
    </div>
  )
}
