"use client"

import { useEffect, useMemo, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ChevronLeft, ChevronRight, CalendarDays, Package } from "lucide-react"
import { useCatalogue } from "@/lib/catalogue-store"
import { usePlanStore } from "@/lib/plan-store"
import { useNavStore } from "@/lib/nav-store"

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
const WEEKDAYS_LONG = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

interface DeliveryItem {
  productSku: string
  productName: string
  productSize: string
  qty: number
  customerName: string | null
  price: number
  orderId: string | null
  orderNumber: string | null
  eventId: string | null
  eventName: string | null
  eventNumber: string | null
  type: "order" | "event"
}

function isoFromDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function sameDay(a: string, b: string): boolean {
  return a === b
}

export function DeliveryView({ onNavigateToOrder }: { onNavigateToOrder?: (orderId: string) => void }) {
  const products = useCatalogue((s) => s.products)
  const items = usePlanStore((s) => s.items)
  const setPendingOrderId = useNavStore((s) => s.setPendingOrderId)
  const setPendingTab = useNavStore((s) => s.setPendingTab)

  // Fetch real Orders + Events from the API
  const [orders, setOrders] = useState<any[]>([])
  const [events, setEvents] = useState<any[]>([])
  useEffect(() => {
    fetch("/api/orders", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { orders: [] }))
      .then((data) => setOrders(data.orders ?? []))
      .catch(() => {})
    fetch("/api/events", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { events: [] }))
      .then((data) => setEvents(data.events ?? []))
      .catch(() => {})
  }, [])

  function handleDeliveryClick(d: DeliveryItem) {
    if (d.type === "event" && d.eventId) {
      // Navigate to Events tab — use pendingOrderId pattern but for events
      // We'll store the event ID and switch to Events tab
      setPendingTab("events")
      // Store event ID in sessionStorage so EventsTab can pick it up
      if (typeof window !== "undefined") {
        sessionStorage.setItem("pendingEventId", d.eventId)
      }
      return
    }
    if (d.orderId) {
      setPendingOrderId(d.orderId)
      if (onNavigateToOrder) {
        onNavigateToOrder(d.orderId)
      } else {
        setPendingTab("orders")
      }
    }
  }

  // Default to current month
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear())
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth()) // 0-indexed

  const productBySku = useMemo(() => {
    return new Map(products.map((p) => [p.sku, p]))
  }, [products])

  // Build a map: ISO date -> DeliveryItem[]
  // Sources: (1) Real Orders from DB, (2) legacy localStorage plan items
  const deliveriesByDate = useMemo(() => {
    const m = new Map<string, DeliveryItem[]>()

    // Source 1: Events
    for (const ev of events) {
      if (!ev.eventDate) continue
      const existing = m.get(ev.eventDate) ?? []
      existing.push({
        productSku: "",
        productName: ev.name,
        productSize: "",
        qty: ev.orderCount ?? 0,
        customerName: ev.customerName,
        price: ev.totalRevenue ?? 0,
        orderId: null,
        orderNumber: null,
        eventId: ev.id,
        eventName: ev.name,
        eventNumber: ev.eventNumber,
        type: "event",
      })
      m.set(ev.eventDate, existing)
    }

    // Source 2: Real Orders
    for (const o of orders) {
      if (!o.deliveryDate) continue
      for (const li of o.lineItems ?? []) {
        if (li.productSku?.startsWith("PRD-CUSTOM-")) {
          const existing = m.get(o.deliveryDate) ?? []
          existing.push({
            productSku: li.productSku,
            productName: li.productName,
            productSize: li.productSize ?? "",
            qty: li.qty,
            customerName: o.customerName,
            price: li.unitPrice,
            orderId: o.id,
            orderNumber: o.orderNumber,
            eventId: null,
            eventName: null,
            eventNumber: null,
            type: "order",
          })
          m.set(o.deliveryDate, existing)
          continue
        }
        const product = productBySku.get(li.productSku)
        const existing = m.get(o.deliveryDate) ?? []
        existing.push({
          productSku: li.productSku,
          productName: product?.name ?? li.productName,
          productSize: product?.size ?? li.productSize ?? "",
          qty: li.qty,
          customerName: o.customerName,
          price: product?.actualPriceBeforeIva ?? li.unitPrice,
          orderId: o.id,
          orderNumber: o.orderNumber,
          eventId: null,
          eventName: null,
          eventNumber: null,
          type: "order",
        })
        m.set(o.deliveryDate, existing)
      }
    }

    // Source 3: Legacy localStorage plan items
    for (const item of items) {
      if (!item.deliveryDate) continue
      const product = productBySku.get(item.productSku)
      if (!product) continue
      const existing = m.get(item.deliveryDate) ?? []
      existing.push({
        productSku: product.sku,
        productName: product.name,
        productSize: product.size ?? "",
        qty: item.qty,
        customerName: item.customerName,
        price: product.actualPriceBeforeIva,
        orderId: null,
        orderNumber: null,
        eventId: null,
        eventName: null,
        eventNumber: null,
        type: "order",
      })
      m.set(item.deliveryDate, existing)
    }
    return m
  }, [orders, events, items, productBySku])

  // Generate the calendar grid for the current view month
  // Layout: weeks starting Monday. Each week has 7 cells.
  const calendarWeeks = useMemo(() => {
    const firstOfMonth = new Date(viewYear, viewMonth, 1)
    // 0=Sun,1=Mon,...; convert to Monday-based offset
    const firstDayWeekday = (firstOfMonth.getDay() + 6) % 7 // 0=Mon, 6=Sun
    const startDate = new Date(firstOfMonth)
    startDate.setDate(firstOfMonth.getDate() - firstDayWeekday)

    const weeks: { date: Date; iso: string; inMonth: boolean }[][] = []
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
    const totalCells = Math.ceil((firstDayWeekday + daysInMonth) / 7) * 7

    for (let i = 0; i < totalCells; i++) {
      const d = new Date(startDate)
      d.setDate(startDate.getDate() + i)
      const iso = isoFromDate(d)
      const inMonth = d.getMonth() === viewMonth
      const weekIndex = Math.floor(i / 7)
      if (!weeks[weekIndex]) weeks[weekIndex] = []
      weeks[weekIndex].push({ date: d, iso, inMonth })
    }
    return weeks
  }, [viewYear, viewMonth])

  // Statistics for this month
  const monthStats = useMemo(() => {
    let totalDeliveries = 0
    let totalBouquets = 0
    let totalRevenue = 0
    let customers = new Set<string>()
    for (const week of calendarWeeks) {
      for (const { iso, inMonth } of week) {
        if (!inMonth) continue
        const list = deliveriesByDate.get(iso) ?? []
        for (const d of list) {
          totalDeliveries += 1
          totalBouquets += d.qty
          totalRevenue += d.price * d.qty
          if (d.customerName) customers.add(d.customerName)
        }
      }
    }
    return {
      totalDeliveries,
      totalBouquets,
      totalRevenue,
      distinctCustomers: customers.size,
    }
  }, [calendarWeeks, deliveriesByDate])

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString("es-MX", {
    month: "long",
    year: "numeric",
  })

  function goToPrevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11)
      setViewYear(viewYear - 1)
    } else {
      setViewMonth(viewMonth - 1)
    }
  }
  function goToNextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0)
      setViewYear(viewYear + 1)
    } else {
      setViewMonth(viewMonth + 1)
    }
  }
  function goToToday() {
    const now = new Date()
    setViewYear(now.getFullYear())
    setViewMonth(now.getMonth())
  }

  const todayIso = isoFromDate(new Date())

  return (
    <div className="space-y-4">
      {/* Header card */}
      <Card className="border-rose-200 bg-rose-50/40 p-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-rose-700" />
            <h2 className="text-lg font-semibold text-stone-800 capitalize">{monthLabel}</h2>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" onClick={goToPrevMonth} className="gap-1">
              <ChevronLeft className="h-4 w-4" />
              Prev
            </Button>
            <Button variant="outline" size="sm" onClick={goToToday}>
              Today
            </Button>
            <Button variant="outline" size="sm" onClick={goToNextMonth} className="gap-1">
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Stats strip */}
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <Stat label="Deliveries" value={String(monthStats.totalDeliveries)} />
          <Stat label="Bouquets" value={String(monthStats.totalBouquets)} />
          <Stat label="Customers" value={String(monthStats.distinctCustomers)} />
          <Stat
            label="Revenue"
            value={`$${monthStats.totalRevenue.toLocaleString("es-MX")}`}
          />
        </div>
      </Card>

      {/* Calendar grid */}
      <Card className="bg-white p-3 sm:p-4 overflow-x-auto">
        <div className="min-w-[720px]">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1.5 mb-1.5">
            {WEEKDAYS.map((d, i) => (
              <div
                key={d}
                className={`text-center text-xs font-semibold py-1 ${
                  i >= 5 ? "text-rose-600" : "text-stone-600"
                }`}
                title={WEEKDAYS_LONG[i]}
              >
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="space-y-1.5">
            {calendarWeeks.map((week, wi) => (
              <div key={wi} className="grid grid-cols-7 gap-1.5">
                {week.map(({ date, iso, inMonth }) => {
                  const list = deliveriesByDate.get(iso) ?? []
                  const isToday = sameDay(iso, todayIso)
                  const isWeekend = date.getDay() === 0 || date.getDay() === 6
                  return (
                    <div
                      key={iso}
                      className={`rounded-md border min-h-[100px] p-1.5 flex flex-col gap-1 ${
                        inMonth
                          ? isWeekend
                            ? "bg-rose-50/30 border-rose-100"
                            : "bg-stone-50 border-stone-200"
                          : "bg-stone-100/50 border-stone-200 text-stone-400"
                      } ${isToday ? "ring-2 ring-rose-400" : ""}`}
                    >
                      <div
                        className={`text-xs font-medium ${
                          isToday
                            ? "text-rose-700"
                            : inMonth
                              ? "text-stone-700"
                              : "text-stone-400"
                        }`}
                      >
                        {date.getDate()}
                      </div>

                      <div className="space-y-1 overflow-hidden">
                        {list.slice(0, 3).map((d, i) => {
                          const isEvent = d.type === "event"
                          const isClickable = d.orderId || (isEvent && d.eventId)
                          return (
                            <button
                              key={i}
                              onClick={() => handleDeliveryClick(d)}
                              disabled={!isClickable}
                              className={`text-[10px] leading-tight rounded bg-white border px-1 py-0.5 w-full text-left transition-colors ${
                                isEvent
                                  ? "border-purple-300 hover:bg-purple-50 hover:border-purple-500 cursor-pointer"
                                  : isClickable
                                    ? "border-rose-200 hover:bg-rose-50 hover:border-rose-400 cursor-pointer"
                                    : "border-stone-200 cursor-default"
                              }`}
                              title={isEvent ? `View event ${d.eventNumber}` : d.orderId ? `View order ${d.orderNumber}` : "No linked order"}
                            >
                              <div className={`font-medium truncate ${isEvent ? "text-purple-800" : "text-stone-800"}`}>
                                {isEvent && (
                                  <span className="text-purple-600 mr-1">🎉</span>
                                )}
                                {d.orderNumber && !isEvent && (
                                  <span className="text-blue-600 mr-1">{d.orderNumber}</span>
                                )}
                                {d.productName}
                                {!isEvent && d.productSize && (
                                  <span className="text-stone-500 ml-0.5">({d.productSize[0]})</span>
                                )}
                                {!isEvent && (
                                  <span className="text-rose-600 ml-1">×{d.qty}</span>
                                )}
                                {isEvent && d.qty > 0 && (
                                  <span className="text-purple-500 ml-1">{d.qty} orders</span>
                                )}
                              </div>
                              {d.customerName && (
                                <div className="text-stone-500 truncate">↳ {d.customerName}</div>
                              )}
                            </button>
                          )
                        })}
                        {list.length > 3 && (
                          <div className="text-[10px] text-stone-500 italic">
                            +{list.length - 3} more
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Legend */}
      <Card className="bg-white p-3 text-xs text-stone-500 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-rose-50/30 border border-rose-100" />
          <span>Weekend</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-stone-50 border border-stone-200" />
          <span>Weekday</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-stone-100/50 border border-stone-200" />
          <span>Out of month</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded border-2 border-rose-400 bg-white" />
          <span>Today</span>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <Package className="h-3.5 w-3.5 text-rose-600" />
          <span>
            Tip: Set delivery dates on the Catalogue or Weekly Plan tab to see them here.
          </span>
        </div>
      </Card>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-white/70 border border-rose-100 px-2.5 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-stone-500">{label}</div>
      <div className="text-sm font-semibold text-stone-800 mt-0.5">{value}</div>
    </div>
  )
}
