// src/app/procurement/page.tsx
//
// Purchase Orders list — formal procurement from suppliers.
// Each PO bundles multiple line items (materials + quantities + costs).

import { db as prisma } from "@/lib/db"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

async function getPurchaseOrders() {
  return prisma.purchaseOrder.findMany({
    include: {
      _count: { select: { lines: true } },
      lines: {
        select: {
          materialSku: true,
          materialName: true,
          qtyPacks: true,
          costPerPack: true,
          lineTotal: true,
        },
        orderBy: { materialName: "asc" },
      },
    },
    orderBy: { poNumber: "asc" },
  })
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-stone-100 text-stone-700 border-stone-300",
  approved: "bg-blue-50 text-blue-700 border-blue-300",
  pending: "bg-amber-50 text-amber-700 border-amber-300",
  procured: "bg-violet-50 text-violet-700 border-violet-300",
  received: "bg-emerald-50 text-emerald-700 border-emerald-300",
  cancelled: "bg-red-50 text-red-700 border-red-300",
}

export default async function ProcurementPage() {
  const pos = await getPurchaseOrders()

  // KPIs
  const total = pos.length
  const received = pos.filter((p) => p.status === "received").length
  const inProgress = pos.filter((p) => ["draft", "approved", "pending", "procured"].includes(p.status)).length
  const totalCost = pos.reduce((s, p) => s + p.totalCost, 0)

  return (
    <main className="min-h-screen bg-stone-50 px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-wrap justify-between items-start gap-4">
          <div>
            <div className="text-xs uppercase tracking-wider text-stone-500">
              Formal procurement · v1.9
            </div>
            <h1 className="mt-1 text-3xl font-bold text-stone-900">Purchase Orders</h1>
            <p className="mt-1 text-sm text-stone-600">
              Restocking orders sent to suppliers. Quantities and prices are per PACK. All suppliers are COD (full payment upfront).
            </p>
          </div>
          <button className="px-4 py-2 text-sm font-medium bg-stone-900 text-white rounded-md hover:bg-stone-800 transition">
            + New PO
          </button>
        </header>

        {/* KPI bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 mb-6 border border-stone-200 rounded-lg overflow-hidden bg-white">
          <KpiCell value={`${total}`} label="Total POs" />
          <KpiCell value={`${received}`} label="Received" color="green" />
          <KpiCell value={`${inProgress}`} label="In progress" color="amber" />
          <KpiCell
            value={`$${totalCost.toLocaleString("es-MX", { maximumFractionDigits: 0 })}`}
            label="Total spent"
            color="purple"
          />
        </div>

        {/* PO list */}
        <div className="space-y-4">
          {pos.map((po) => (
            <Card key={po.id} className="border-stone-200 hover:shadow-sm transition">
              <CardContent className="pt-5">
                {/* PO header */}
                <div className="flex flex-wrap items-start justify-between gap-3 mb-4 pb-3 border-b border-stone-100">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-mono text-sm font-bold text-stone-900">{po.poNumber}</span>
                      <Badge
                        variant="outline"
                        className={`text-xs ${STATUS_COLORS[po.status] ?? STATUS_COLORS.draft}`}
                      >
                        {po.status}
                      </Badge>
                    </div>
                    <div className="text-sm text-stone-600">
                      🏭 <span className="font-medium">{po.supplier}</span>
                      <span className="text-stone-400 mx-2">·</span>
                      {po._count.lines} line item{po._count.lines !== 1 ? "s" : ""}
                      <span className="text-stone-400 mx-2">·</span>
                      <span className="text-xs text-stone-500">
                        {po.createdAt.toLocaleDateString("es-MX", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-stone-900">
                      ${po.totalCost.toLocaleString("es-MX", { maximumFractionDigits: 2 })}
                    </div>
                    <div className="text-xs text-stone-500">total cost (MXN)</div>
                  </div>
                </div>

                {/* Line items table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-stone-100 text-stone-500 text-xs uppercase tracking-wider">
                        <th className="text-left py-2 px-2">SKU</th>
                        <th className="text-left py-2 px-2">Material</th>
                        <th className="text-right py-2 px-2">Qty (packs)</th>
                        <th className="text-right py-2 px-2">Cost/pack</th>
                        <th className="text-right py-2 px-2">Line total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {po.lines.map((line) => (
                        <tr key={line.materialSku} className="border-b border-stone-50">
                          <td className="py-2 px-2 font-mono text-xs text-stone-500">{line.materialSku}</td>
                          <td className="py-2 px-2 text-stone-900">{line.materialName}</td>
                          <td className="py-2 px-2 text-right text-stone-700">{line.qtyPacks}</td>
                          <td className="py-2 px-2 text-right text-stone-700">
                            ${line.costPerPack.toLocaleString("es-MX", { maximumFractionDigits: 2 })}
                          </td>
                          <td className="py-2 px-2 text-right font-medium text-stone-900">
                            ${line.lineTotal.toLocaleString("es-MX", { maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Notes */}
                {po.notes && (
                  <div className="mt-3 pt-3 border-t border-stone-100 text-xs text-stone-500 italic">
                    📝 {po.notes}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
          {pos.length === 0 && (
            <Card className="border-dashed border-stone-300">
              <CardContent className="py-12 text-center text-stone-400">
                No purchase orders yet. Click &quot;+ New PO&quot; to create one.
              </CardContent>
            </Card>
          )}
        </div>

        {/* Business rules */}
        <Card className="mt-6 border-stone-200 bg-stone-50/50">
          <CardContent className="pt-6 text-sm text-stone-700 space-y-2">
            <div className="font-semibold text-stone-900">PO business rules</div>
            <ul className="list-disc list-inside ml-2 space-y-1 text-xs">
              <li><strong>All suppliers are COD</strong> — full payment upfront on receipt, no credit terms.</li>
              <li><strong>Quantities are per PACK</strong> — not per stem. Materials sheet tracks stock in packs.</li>
              <li><strong>Stock auto-updates</strong> when PO status changes to &quot;received&quot;.</li>
              <li><strong>Pipeline:</strong> draft → approved → pending → procured → received (or cancelled).</li>
              <li><strong>Ad-hoc purchases</strong> (markets, one-offs) are tracked separately on a different model.</li>
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
  color?: "default" | "green" | "amber" | "purple"
}) {
  const colorMap = {
    default: "text-stone-900",
    green: "text-emerald-700",
    amber: "text-amber-700",
    purple: "text-violet-700",
  }
  return (
    <div className="p-3 border-r border-stone-200 last:border-r-0 min-w-[120px]">
      <div className={`text-xl font-bold ${colorMap[color]}`}>{value}</div>
      <div className="text-xs text-stone-500 mt-0.5">{label}</div>
    </div>
  )
}
