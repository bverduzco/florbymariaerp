// src/app/suppliers/page.tsx
//
// Supplier directory with contact info and material counts.

import { db as prisma } from "@/lib/db"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

async function getSuppliers() {
  return prisma.supplier.findMany({
    include: {
      _count: { select: { materials: true, supplierPrices: true } },
    },
    orderBy: { name: "asc" },
  })
}

export default async function SuppliersPage() {
  const suppliers = await getSuppliers()

  const totalSuppliers = suppliers.length
  const totalMaterials = suppliers.reduce((s, sup) => s + sup._count.materials, 0)
  const totalPrices = suppliers.reduce((s, sup) => s + sup._count.supplierPrices, 0)
  const withContactInfo = suppliers.filter((s) => s.phone || s.email).length

  return (
    <main className="min-h-screen bg-stone-50 px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-wrap justify-between items-start gap-4">
          <div>
            <div className="text-xs uppercase tracking-wider text-stone-500">
              Vendor directory · v1.9
            </div>
            <h1 className="mt-1 text-3xl font-bold text-stone-900">Suppliers</h1>
            <p className="mt-1 text-sm text-stone-600">
              All vendors Maria buys from. Includes lead time, payment terms, and contact info.
            </p>
          </div>
          <button className="px-4 py-2 text-sm font-medium bg-stone-900 text-white rounded-md hover:bg-stone-800 transition">
            + Add Supplier
          </button>
        </header>

        {/* KPI bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 mb-6 border border-stone-200 rounded-lg overflow-hidden bg-white">
          <KpiCell value={`${totalSuppliers}`} label="Total suppliers" />
          <KpiCell value={`${withContactInfo}`} label="With contact info" color="green" />
          <KpiCell value={`${totalMaterials}`} label="Materials tracked" color="purple" />
          <KpiCell value={`${totalPrices}`} label="Price quotes logged" />
        </div>

        {/* Supplier cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {suppliers.map((supplier) => (
            <Card key={supplier.id} className="border-stone-200 hover:shadow-sm transition">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{supplier.name}</CardTitle>
                  <Badge
                    variant="outline"
                    className="text-xs bg-amber-50 text-amber-700 border-amber-300"
                  >
                    COD
                  </Badge>
                </div>
                {supplier.contactPerson && (
                  <div className="text-xs text-stone-500">{supplier.contactPerson}</div>
                )}
              </CardHeader>
              <CardContent className="pt-0 space-y-3">
                {/* Contact */}
                <div className="space-y-1 text-xs">
                  {supplier.phone && (
                    <div className="flex items-center gap-2 text-stone-700">
                      <span className="text-stone-400">📞</span>
                      <span>{supplier.phone}</span>
                    </div>
                  )}
                  {supplier.email && (
                    <div className="flex items-center gap-2 text-stone-700">
                      <span className="text-stone-400">✉️</span>
                      <span className="truncate">{supplier.email}</span>
                    </div>
                  )}
                  {!supplier.phone && !supplier.email && (
                    <div className="text-stone-400 italic">No contact info yet</div>
                  )}
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-stone-100">
                  <div>
                    <div className="text-stone-500 text-xs">Materials</div>
                    <div className="text-lg font-bold text-stone-900">
                      {supplier._count.materials}
                    </div>
                  </div>
                  <div>
                    <div className="text-stone-500 text-xs">Price quotes</div>
                    <div className="text-lg font-bold text-stone-900">
                      {supplier._count.supplierPrices}
                    </div>
                  </div>
                </div>

                {/* Lead time + payment terms */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-stone-100 text-xs">
                  <div>
                    <div className="text-stone-500">Lead time</div>
                    <div className="text-stone-900 font-medium">
                      {supplier.leadTimeDays ? `${supplier.leadTimeDays} days` : "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-stone-500">Payment terms</div>
                    <div className="text-stone-900 font-medium">
                      {supplier.paymentTerms ?? "COD (full upfront)"}
                    </div>
                  </div>
                </div>

                {/* Notes */}
                {supplier.notes && (
                  <div className="pt-2 border-t border-stone-100 text-xs text-stone-500 italic line-clamp-2">
                    {supplier.notes}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Business rules note */}
        <Card className="mt-6 border-stone-200 bg-stone-50/50">
          <CardContent className="pt-6 text-sm text-stone-700 space-y-2">
            <div className="font-semibold text-stone-900">Supplier business rules</div>
            <ul className="list-disc list-inside ml-2 space-y-1 text-xs">
              <li><strong>All suppliers are COD</strong> — full payment upfront, no credit terms.</li>
              <li><strong>Price quotes logged historically</strong> — every supplier price quote is stored as a separate row in <code className="rounded bg-white px-1.5 py-0.5 border border-stone-200">SupplierPrice</code>, with only the latest marked <code className="rounded bg-white px-1.5 py-0.5 border border-stone-200">isLatest = true</code>.</li>
              <li><strong>Materials have a Preferred Supplier</strong> — determines which supplier&apos;s price shows on the Materials sheet by default.</li>
              <li><strong>Ad-hoc purchases</strong> — for one-off vendors (markets, etc.), use the <code className="rounded bg-white px-1.5 py-0.5 border border-stone-200">AdHocPurchase</code> model. The vendor name is stored on each purchase, not on a Supplier row.</li>
            </ul>
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
    <div className="p-3 border-r border-stone-200 last:border-r-0 min-w-[120px]">
      <div className={`text-xl font-bold ${colorMap[color]}`}>{value}</div>
      <div className="text-xs text-stone-500 mt-0.5">{label}</div>
    </div>
  )
}
