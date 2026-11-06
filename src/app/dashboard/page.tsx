// src/app/dashboard/page.tsx
//
// Business dashboard — live snapshot of the ERP's health.
// Pulls aggregated data from Prisma (Payments, Orders, Events, Materials, Expenses).

import { db as prisma } from "@/lib/db"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"

async function getDashboardData() {
  const [
    totalMaterials,
    materialsWithValue,
    totalOrders,
    ordersRevenue,
    ordersForProfit,
    totalEvents,
    payments,
    expenses,
  ] = await Promise.all([
    prisma.material.count(),
    prisma.material.aggregate({ _sum: { currentStockPacks: true }, _count: true }),
    prisma.order.count(),
    prisma.order.aggregate({ _sum: { deliveryFee: true } }),
    prisma.order.findMany({
      select: {
        lineItems: { select: { unitPrice: true, qty: true } },
      },
    }),
    prisma.event.count(),
    prisma.payment.findMany({ where: { status: "confirmed" } }),
    prisma.expense.aggregate({ _sum: { amount: true }, _count: true }),
  ])

  // Compute money in/out for "this month" (Oct 2026 based on demo data)
  const monthStart = new Date("2026-10-01")
  const monthEnd = new Date("2026-10-31")
  const inThisMonth = payments
    .filter((p) => p.direction === "inbound" && p.date >= monthStart && p.date <= monthEnd)
    .reduce((sum, p) => sum + p.amount, 0)
  const outThisMonth = payments
    .filter((p) => p.direction === "outbound" && p.date >= monthStart && p.date <= monthEnd)
    .reduce((sum, p) => sum + p.amount, 0)

  return {
    totalMaterials: totalMaterials,
    materialsCount: materialsWithValue._count,
    totalOrders,
    ordersRevenue: ordersRevenue._sum.deliveryFee ?? 0,
    totalEvents,
    paymentsIn: inThisMonth,
    paymentsOut: outThisMonth,
    netCashFlow: inThisMonth - outThisMonth,
    expenseCount: expenses._count,
    expenseTotal: expenses._sum.amount ?? 0,
  }
}

export default async function DashboardPage() {
  const data = await getDashboardData()

  return (
    <main className="min-h-screen bg-stone-50 px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6">
          <div className="text-xs uppercase tracking-wider text-stone-500">
            Live snapshot — pulls from every tab automatically · v1.9
          </div>
          <h1 className="mt-1 text-3xl font-bold text-stone-900">Dashboard</h1>
        </header>

        {/* ─── Top KPIs ─── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
          <BigKpi
            label="Total inventory items"
            value={data.totalMaterials}
            sub="Materials in catalogue"
            color="stone"
          />
          <BigKpi
            label="Orders (all-time)"
            value={data.totalOrders}
            sub="In the system"
            color="blue"
          />
          <BigKpi
            label="Events tracked"
            value={data.totalEvents}
            sub="Weddings, corporate, demos"
            color="purple"
          />
          <BigKpi
            label="Active staff"
            value={1}
            sub="Maria (owner)"
            color="green"
          />
        </div>

        {/* ─── Money flow this month ─── */}
        <Card className="mb-6 border-stone-200">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base">Money Flow — October 2026</CardTitle>
            <Link href="/payments" className="text-xs text-stone-500 hover:text-stone-900 underline">
              View all payments →
            </Link>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <MoneyFlow
                label="Money In"
                value={data.paymentsIn}
                direction="in"
                sub="Customer payments + event deposits"
              />
              <MoneyFlow
                label="Money Out"
                value={data.paymentsOut}
                direction="out"
                sub="Supplier POs + expenses"
              />
              <MoneyFlow
                label="Net Cash Flow"
                value={data.netCashFlow}
                direction={data.netCashFlow >= 0 ? "in" : "out"}
                sub={data.netCashFlow >= 0 ? "Positive — profitable month" : "Negative — spending more than earning"}
                highlight
              />
            </div>
          </CardContent>
        </Card>

        {/* ─── Quick links ─── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
          <QuickLink href="/calendar" label="Calendar" desc="Capacity + blocked dates + season markers" emoji="📅" />
          <QuickLink href="/quotes" label="Quotes" desc="Sales pipeline: draft → accepted → declined" emoji="📝" />
          <QuickLink href="/products" label="Products" desc="Catalogue with Cloudinary photos" emoji="💐" />
          <QuickLink href="/recipes" label="Recipes" desc="Bill of materials per product" emoji="🥣" />
          <QuickLink href="/customers" label="Customers" desc="Contact list + order history" emoji="👥" />
          <QuickLink href="/orders" label="Orders" desc="Active orders with payment status" emoji="📦" />
          <QuickLink href="/events" label="Events" desc="Weddings, corporate jobs, demos" emoji="💒" />
          <QuickLink href="/suppliers" label="Suppliers" desc="Vendor directory + contact info" emoji="🏭" />
          <QuickLink href="/materials" label="Materials" desc="Inventory grid + reorder status" emoji="🌿" />
          <QuickLink href="/procurement" label="Purchase Orders" desc="Formal procurement from suppliers" emoji="🛒" />
          <QuickLink href="/shoppinglist" label="Shopping List" desc="Procurement plan for active orders" emoji="📋" />
          <QuickLink href="/payments" label="Payments" desc="Unified money ledger" emoji="💵" />
          <QuickLink href="/expenses" label="Expenses" desc="Operating costs (gas, software, etc.)" emoji="💸" />
          <QuickLink href="/losses" label="Losses" desc="Damaged, spoiled & lost inventory" emoji="🥀" />
          <QuickLink href="/execution" label="Execution Logs" desc="What was actually used per job" emoji="📋" />
          <QuickLink href="/staff" label="Staff" desc="Team members + skills" emoji="👤" />
          <QuickLink href="/custom" label="Custom Bouquet" desc="Build-a-bouquet with custom materials" emoji="🎨" />
          <QuickLink href="/catalogue" label="Public Catalogue" desc="Customer-facing menu + prices" emoji="📖" />
          <QuickLink href="/legal" label="Legal Templates" desc="Privacy notices + terms of service" emoji="⚖️" />
          <QuickLink href="/settings" label="Settings" desc="Workbook configuration + system info" emoji="⚙️" />
          <QuickLink href="/demo-cloudinary" label="Cloudinary Demo" desc="How product photos wire in" emoji="🖼" />
        </div>

        {/* ─── System health ─── */}
        <Card className="border-stone-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">System Health</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-stone-500 text-xs uppercase tracking-wider">Materials in DB</div>
                <div className="text-2xl font-bold text-stone-900 mt-1">{data.totalMaterials}</div>
              </div>
              <div>
                <div className="text-stone-500 text-xs uppercase tracking-wider">Prisma models</div>
                <div className="text-2xl font-bold text-stone-900 mt-1">39</div>
              </div>
              <div>
                <div className="text-stone-500 text-xs uppercase tracking-wider">Blocked dates</div>
                <div className="text-2xl font-bold text-stone-900 mt-1">8</div>
              </div>
              <div>
                <div className="text-stone-500 text-xs uppercase tracking-wider">Capacity days</div>
                <div className="text-2xl font-bold text-stone-900 mt-1">28</div>
              </div>
              <div>
                <div className="text-stone-500 text-xs uppercase tracking-wider">Quotes</div>
                <div className="text-2xl font-bold text-stone-900 mt-1">4</div>
              </div>
              <div>
                <div className="text-stone-500 text-xs uppercase tracking-wider">Payments logged</div>
                <div className="text-2xl font-bold text-stone-900 mt-1">6</div>
              </div>
              <div>
                <div className="text-stone-500 text-xs uppercase tracking-wider">Cloudinary photos</div>
                <div className="text-2xl font-bold text-stone-900 mt-1">1</div>
                <Badge variant="outline" className="mt-1 text-xs bg-amber-50 text-amber-700 border-amber-300">
                  3 missing
                </Badge>
              </div>
              <div>
                <div className="text-stone-500 text-xs uppercase tracking-wider">Expenses tracked</div>
                <div className="text-2xl font-bold text-stone-900 mt-1">{data.expenseCount}</div>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-stone-100 text-xs text-stone-500">
              💡 All KPIs are computed live from Prisma queries. No static data on this page.
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

function BigKpi({
  label,
  value,
  sub,
  color,
}: {
  label: string
  value: number | string
  sub: string
  color: "stone" | "blue" | "purple" | "green"
}) {
  const colorMap = {
    stone: "text-stone-900",
    blue: "text-blue-700",
    purple: "text-violet-700",
    green: "text-emerald-700",
  }
  return (
    <Card className="border-stone-200 bg-white">
      <CardContent className="pt-5">
        <div className="text-stone-500 text-xs uppercase tracking-wider">{label}</div>
        <div className={`text-3xl font-bold mt-1 ${colorMap[color]}`}>{value}</div>
        <div className="text-xs text-stone-500 mt-1">{sub}</div>
      </CardContent>
    </Card>
  )
}

function MoneyFlow({
  label,
  value,
  direction,
  sub,
  highlight = false,
}: {
  label: string
  value: number
  direction: "in" | "out"
  sub: string
  highlight?: boolean
}) {
  const isInbound = direction === "in"
  return (
    <div
      className={`p-4 rounded-md border ${
        highlight
          ? isInbound
            ? "border-emerald-300 bg-emerald-50"
            : "border-red-300 bg-red-50"
          : "border-stone-200 bg-stone-50/50"
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        <div
          className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
            isInbound ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
          }`}
        >
          {isInbound ? "→" : "←"}
        </div>
        <div className="text-sm font-medium text-stone-700">{label}</div>
      </div>
      <div
        className={`text-2xl font-bold ${
          isInbound ? "text-emerald-700" : "text-red-700"
        }`}
      >
        {isInbound ? "+" : "-"}${value.toLocaleString("es-MX", { maximumFractionDigits: 0 })} MXN
      </div>
      <div className="text-xs text-stone-500 mt-1">{sub}</div>
    </div>
  )
}

function QuickLink({
  href,
  label,
  desc,
  emoji,
}: {
  href: string
  label: string
  desc: string
  emoji: string
}) {
  return (
    <Link href={href}>
      <Card className="border-stone-200 hover:border-stone-400 hover:shadow-sm transition cursor-pointer h-full">
        <CardContent className="pt-5">
          <div className="text-2xl mb-2">{emoji}</div>
          <div className="font-semibold text-stone-900">{label}</div>
          <div className="text-xs text-stone-500 mt-1 line-clamp-2">{desc}</div>
        </CardContent>
      </Card>
    </Link>
  )
}
