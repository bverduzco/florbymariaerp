// src/app/settings/page.tsx
//
// Workbook settings — generic key-value store for workbook-level configuration.
// Plus system info about the ERP itself (Prisma models, versions, etc.)

import { db as prisma } from "@/lib/db"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

async function getSettings() {
  return prisma.workbookSetting.findMany({
    orderBy: [{ section: "asc" }, { key: "asc" }],
  })
}

async function getSystemCounts() {
  const [
    materials, products, customers, orders, events, quotes, payments,
    expenses, suppliers, staff, blockedDates, capacityDays, seasonMarkers,
    purchaseOrders, losses, executionLogs, tools, recipeVersions,
  ] = await Promise.all([
    prisma.material.count(),
    prisma.product.count(),
    prisma.customer.count(),
    prisma.order.count(),
    prisma.event.count(),
    prisma.quote.count(),
    prisma.payment.count(),
    prisma.expense.count(),
    prisma.supplier.count(),
    prisma.staff.count(),
    prisma.blockedDate.count(),
    prisma.capacityDay.count(),
    prisma.seasonMarker.count(),
    prisma.purchaseOrder.count(),
    prisma.loss.count(),
    prisma.executionLog.count(),
    prisma.tool.count(),
    prisma.recipeVersion.count(),
  ])

  return {
    materials, products, customers, orders, events, quotes, payments,
    expenses, suppliers, staff, blockedDates, capacityDays, seasonMarkers,
    purchaseOrders, losses, executionLogs, tools, recipeVersions,
  }
}

const SECTION_COLORS: Record<string, string> = {
  pricing: "bg-emerald-50 text-emerald-700 border-emerald-300",
  branding: "bg-violet-50 text-violet-700 border-violet-300",
  sync: "bg-blue-50 text-blue-700 border-blue-300",
  integrations: "bg-amber-50 text-amber-700 border-amber-300",
  general: "bg-stone-100 text-stone-700 border-stone-300",
}

export default async function SettingsPage() {
  const [settings, counts] = await Promise.all([getSettings(), getSystemCounts()])

  // Group settings by section
  const settingsBySection = settings.reduce((acc, s) => {
    if (!acc[s.section]) acc[s.section] = []
    acc[s.section].push(s)
    return acc
  }, {} as Record<string, typeof settings>)

  return (
    <main className="min-h-screen bg-stone-50 px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6">
          <div className="text-xs uppercase tracking-wider text-stone-500">
            Workbook configuration + system info · v1.9
          </div>
          <h1 className="mt-1 text-3xl font-bold text-stone-900">Settings</h1>
          <p className="mt-1 text-sm text-stone-600">
            Generic key-value store for workbook-level configuration. Anything that doesn&apos;t fit in Assumptions (pricing rules) goes here.
          </p>
        </header>

        {/* System info — top */}
        <Card className="mb-6 border-stone-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">System Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 text-sm">
              <InfoCell label="Prisma models" value="39" sub="In schema" />
              <InfoCell label="Database" value="SQLite" sub="local file" />
              <InfoCell label="Cloudinary cloud" value="mvtqdpen" sub="public name" />
              <InfoCell label="ERP version" value="v1.9" sub="UI build in progress" />
            </div>
          </CardContent>
        </Card>

        {/* Database counts */}
        <Card className="mb-6 border-stone-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Database Row Counts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <CountCell label="Materials" count={counts.materials} color="rose" />
              <CountCell label="Products" count={counts.products} color="amber" />
              <CountCell label="Customers" count={counts.customers} color="blue" />
              <CountCell label="Orders" count={counts.orders} color="indigo" />
              <CountCell label="Events" count={counts.events} color="violet" />
              <CountCell label="Quotes" count={counts.quotes} color="emerald" />
              <CountCell label="Payments" count={counts.payments} color="emerald" />
              <CountCell label="Expenses" count={counts.expenses} color="red" />
              <CountCell label="Suppliers" count={counts.suppliers} color="stone" />
              <CountCell label="Staff" count={counts.staff} color="violet" />
              <CountCell label="POs" count={counts.purchaseOrders} color="amber" />
              <CountCell label="Losses" count={counts.losses} color="red" />
              <CountCell label="Execution logs" count={counts.executionLogs} color="emerald" />
              <CountCell label="Tools" count={counts.tools} color="stone" />
              <CountCell label="Recipe versions" count={counts.recipeVersions} color="blue" />
              <CountCell label="Blocked dates" count={counts.blockedDates} color="red" />
              <CountCell label="Capacity days" count={counts.capacityDays} color="amber" />
              <CountCell label="Season markers" count={counts.seasonMarkers} color="violet" />
            </div>
          </CardContent>
        </Card>

        {/* Settings by section */}
        <div className="space-y-6">
          {Object.entries(settingsBySection).map(([section, sectionSettings]) => (
            <Card key={section} className="border-stone-200">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <CardTitle className="text-base capitalize">{section}</CardTitle>
                  <Badge
                    variant="outline"
                    className={`text-xs ${SECTION_COLORS[section] ?? SECTION_COLORS.general}`}
                  >
                    {sectionSettings.length} {sectionSettings.length === 1 ? "key" : "keys"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {sectionSettings.map((s) => (
                    <div
                      key={s.id}
                      className="p-4 border border-stone-200 rounded-md bg-stone-50/50"
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <code className="text-sm font-mono text-stone-900 font-medium">
                          {s.key}
                        </code>
                      </div>
                      <div className="text-lg font-bold text-stone-900 mt-1">
                        {s.value || <span className="text-stone-400 italic text-sm">(empty)</span>}
                      </div>
                      {s.notes && (
                        <div className="text-xs text-stone-500 mt-2">{s.notes}</div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* About */}
        <Card className="mt-6 border-stone-200 bg-stone-50/50">
          <CardContent className="pt-6 text-sm text-stone-700 space-y-2">
            <div className="font-semibold text-stone-900">About this workbook</div>
            <p className="text-xs">
              <strong>Flor by Maria</strong> — Floristry ERP for bouquets, arrangements &amp; events. Built with Next.js 16, Prisma 6.19, Turso (libSQL), and Tailwind CSS. Deployed on Vercel.
            </p>
            <p className="text-xs">
              <strong>Geography:</strong> Monterrey, Nuevo León, México. Spanish default. WhatsApp as primary customer channel.
            </p>
            <p className="text-xs">
              <strong>Excel-first development convention</strong>: structure is built in Excel before Prisma/UI. The ERP workbook (v1.8.3) has 42 sheets and is the canonical source of truth for business rules.
            </p>
            <p className="text-xs">
              <strong>Currency:</strong> MXN. All prices are before IVA unless noted. IVA is 16%.
            </p>
            <p className="text-xs text-stone-500 mt-3">
              💡 To add a new setting, run <code className="rounded bg-white px-1.5 py-0.5 border border-stone-200">prisma.workbookSetting.create()</code> or add a row to the Excel Workbook Settings sheet.
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

function InfoCell({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div>
      <div className="text-stone-500 text-xs uppercase tracking-wider">{label}</div>
      <div className="text-lg font-bold text-stone-900 mt-1">{value}</div>
      <div className="text-xs text-stone-500">{sub}</div>
    </div>
  )
}

function CountCell({
  label,
  count,
  color,
}: {
  label: string
  count: number
  color: "rose" | "amber" | "blue" | "indigo" | "violet" | "emerald" | "red" | "stone"
}) {
  const colorMap = {
    rose: "text-rose-700",
    amber: "text-amber-700",
    blue: "text-blue-700",
    indigo: "text-indigo-700",
    violet: "text-violet-700",
    emerald: "text-emerald-700",
    red: "text-red-700",
    stone: "text-stone-700",
  }
  return (
    <div className="p-3 border border-stone-200 rounded-md bg-white">
      <div className="text-stone-500 text-xs uppercase tracking-wider">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${colorMap[color]}`}>{count}</div>
    </div>
  )
}
