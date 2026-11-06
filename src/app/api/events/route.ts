import { NextResponse } from "next/server"
import { parseDateAsGMTMinus6 } from "@/lib/date-helpers"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

/**
 * GET /api/events
 * Returns all events, optionally filtered by ?status=X
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const status = searchParams.get("status")

  const events = await db.event.findMany({
    where: status ? { status } : undefined,
    orderBy: [{ eventDate: "asc" }, { createdAt: "desc" }],
    include: {
      customer: true,
      orders: { include: { customer: true, lineItems: true } },
    },
  })

  const payload = events.map((e) => {
    const totalRevenue = e.orders.reduce((s, o) =>
      s + o.lineItems.reduce((ls, li) => ls + li.unitPrice * li.qty, 0), 0)
    return {
      id: e.id,
      eventNumber: e.eventNumber,
      name: e.name,
      customerId: e.customerId,
      customerName: e.customer?.name ?? null,
      eventDate: e.eventDate?.toISOString().split("T")[0] ?? null,
      guests: e.guests,
      status: e.status,
      notes: e.notes ?? "",
      orderCount: e.orders.length,
      totalRevenue,
      orders: e.orders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        customerName: o.customer?.name ?? null,
        deliveryDate: o.deliveryDate?.toISOString().split("T")[0] ?? null,
        lineItems: o.lineItems.map((li) => ({
          productName: li.productName,
          qty: li.qty,
          unitPrice: li.unitPrice,
          lineTotal: li.unitPrice * li.qty,
        })),
      })),
      createdAt: e.createdAt.toISOString(),
    }
  })

  return NextResponse.json({ events: payload, count: payload.length })
}

/**
 * POST /api/events
 * Body: { name, customerId?, eventDate?, guests?, notes? }
 */
export async function POST(request: Request) {
  let body: {
    name?: string
    customerId?: string
    eventDate?: string
    guests?: number
    notes?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Event name is required" }, { status: 400 })
  }

  // Generate next event number
  const lastEvent = await db.event.findFirst({ orderBy: { eventNumber: "desc" } })
  let nextNum = 2001
  if (lastEvent?.eventNumber) {
    const match = /^EVT-(\d+)$/.exec(lastEvent.eventNumber)
    if (match) nextNum = parseInt(match[1]) + 1
  }
  const eventNumber = `EVT-${nextNum}`

  const event = await db.event.create({
    data: {
      eventNumber,
      name: body.name.trim(),
      customerId: body.customerId || null,
      eventDate: body.eventDate ? parseDateAsGMTMinus6(body.eventDate) as Date : null,
      guests: body.guests ?? null,
      notes: body.notes ?? null,
    },
    include: { customer: true, orders: { include: { lineItems: true } } },
  })

  return NextResponse.json({
    event: {
      id: event.id,
      eventNumber: event.eventNumber,
      name: event.name,
      status: event.status,
      createdAt: event.createdAt.toISOString(),
    },
  }, { status: 201 })
}
