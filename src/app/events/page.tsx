// src/app/events/page.tsx
//
// Events list — weddings, corporate jobs, quinceañeras, demos.
// Each event bundles multiple orders under one occasion.

import { db as prisma } from "@/lib/db"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { NewEventDialog } from "./new-event-dialog"

async function getEvents() {
  return prisma.event.findMany({
    include: {
      customer: { select: { name: true, phone: true } },
      _count: {
        select: { orders: true, lineItems: true, executionLogs: true },
      },
      orders: {
        select: {
          deliveryFee: true,
          lineItems: { select: { unitPrice: true, qty: true } },
        },
      },
    },
    orderBy: { eventDate: "asc" },
  })
}

const STATUS_COLORS: Record<string, string> = {
  quote: "bg-stone-100 text-stone-700 border-stone-300",
  confirmed: "bg-blue-50 text-blue-700 border-blue-300",
  in_progress: "bg-amber-50 text-amber-700 border-amber-300",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-300",
  cancelled: "bg-red-50 text-red-700 border-red-300",
}

export default async function EventsPage() {
  const events = await getEvents()

  // KPIs
  const total = events.length
  const upcoming = events.filter((e) => e.eventDate && e.eventDate > new Date()).length
  const completed = events.filter((e) => e.status === "completed").length
  const inProgress = events.filter((e) => e.status === "in_progress" || e.status === "confirmed").length

  // Estimated revenue (sum of all orders' line items + delivery)
  const totalEstRevenue = events.reduce((sum, e) => {
    const ordersTotal = e.orders.reduce((s, o) => {
      const itemsTotal = o.lineItems.reduce((is, l) => is + l.unitPrice * l.qty, 0)
      return s + itemsTotal + o.deliveryFee
    }, 0)
    return sum + ordersTotal
  }, 0)

  return (
    <main className="min-h-screen bg-stone-50 px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-wrap justify-between items-start gap-4">
          <div>
            <div className="text-xs uppercase tracking-wider text-stone-500">
              Weddings &amp; corporate jobs · v1.9
            </div>
            <h1 className="mt-1 text-3xl font-bold text-stone-900">Events</h1>
            <p className="mt-1 text-sm text-stone-600">
              Larger jobs that bundle multiple products under one occasion. Includes paid customer events AND unpaid demos.
            </p>
          </div>
          <NewEventDialog />
        </header>

        {/* KPI bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 mb-6 border border-stone-200 rounded-lg overflow-hidden bg-white">
          <KpiCell value={`${total}`} label="Total events" />
          <KpiCell value={`${upcoming}`} label="Upcoming" color="blue" />
          <KpiCell value={`${inProgress}`} label="In progress" color="amber" />
          <KpiCell
            value={`$${totalEstRevenue.toLocaleString("es-MX", { maximumFractionDigits: 0 })}`}
            label="Est. revenue"
            color="purple"
          />
        </div>

        {/* Events cards */}
        <div className="space-y-4">
          {events.map((event) => {
            const eventDate = event.eventDate
            const isUpcoming = eventDate && eventDate > new Date()
            const isPast = eventDate && eventDate < new Date()
            const daysUntil = eventDate
              ? Math.ceil((eventDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
              : null

            return (
              <Card key={event.id} className="border-stone-200 hover:shadow-sm transition">
                <CardContent className="pt-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    {/* Left: ID + name + customer */}
                    <div className="flex-1 min-w-[280px]">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="font-mono text-xs text-stone-500">{event.eventNumber}</span>
                        <Badge
                          variant="outline"
                          className={`text-xs ${STATUS_COLORS[event.status] ?? STATUS_COLORS.quote}`}
                        >
                          {event.status.replace(/_/g, " ")}
                        </Badge>
                        {isUpcoming && daysUntil !== null && (
                          <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-300">
                            in {daysUntil} days
                          </Badge>
                        )}
                        {isPast && (
                          <Badge variant="outline" className="text-xs bg-stone-100 text-stone-500 border-stone-300">
                            past
                          </Badge>
                        )}
                      </div>
                      <h3 className="text-lg font-bold text-stone-900">{event.name}</h3>
                      {event.customer && (
                        <div className="text-sm text-stone-600 mt-1">
                          👤 {event.customer.name}
                          {event.customer.phone && <span className="text-stone-500 ml-2">· {event.customer.phone}</span>}
                        </div>
                      )}
                      {!event.customer && (
                        <div className="text-sm text-stone-500 italic mt-1">
                          No linked customer (e.g. unpaid demo event)
                        </div>
                      )}
                    </div>

                    {/* Middle: event details */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                      <div>
                        <div className="text-stone-500 text-xs uppercase tracking-wider">Event date</div>
                        <div className="font-medium text-stone-900 mt-0.5">
                          {eventDate
                            ? eventDate.toLocaleDateString("es-MX", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })
                            : "—"}
                        </div>
                      </div>
                      <div>
                        <div className="text-stone-500 text-xs uppercase tracking-wider">Guests</div>
                        <div className="font-medium text-stone-900 mt-0.5">
                          {event.guests ?? "—"}
                        </div>
                      </div>
                      <div>
                        <div className="text-stone-500 text-xs uppercase tracking-wider">Bundle</div>
                        <div className="font-medium text-stone-900 mt-0.5">
                          {event._count.orders} orders
                          <br />
                          <span className="text-xs text-stone-500">
                            {event._count.lineItems} line items
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Notes */}
                  {event.notes && (
                    <div className="mt-3 pt-3 border-t border-stone-100 text-sm text-stone-600">
                      📝 {event.notes}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
          {events.length === 0 && (
            <Card className="border-dashed border-stone-300">
              <CardContent className="py-12 text-center text-stone-400">
                No events yet. Click &quot;+ New Event&quot; to create one.
              </CardContent>
            </Card>
          )}
        </div>

        {/* Business rules */}
        <Card className="mt-6 border-stone-200 bg-stone-50/50">
          <CardContent className="pt-6 text-sm text-stone-700 space-y-2">
            <div className="font-semibold text-stone-900">Event business rules</div>
            <ul className="list-disc list-inside ml-2 space-y-1 text-xs">
              <li><strong>Payment schedule:</strong> 50% deposit at acceptance + 50% balance 14 days before event date.</li>
              <li><strong>Event lockout:</strong> when an event is on Saturday, the system auto-blocks Friday + Saturday + Sunday (Option A).</li>
              <li><strong>Paid vs unpaid:</strong> events can be paid customer work (weddings, corporate) OR unpaid (demos, photo shoots, displays).</li>
              <li><strong>Pipeline:</strong> quote → confirmed → in_progress → completed → cancelled.</li>
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
  color?: "default" | "blue" | "amber" | "purple"
}) {
  const colorMap = {
    default: "text-stone-900",
    blue: "text-blue-700",
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
