import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

/**
 * GET /api/orders
 * Returns all orders, optionally filtered by ?status=X
 * Supports multiple comma-separated statuses: ?status=draft,pending
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const statusParam = searchParams.get("status")

  const where = statusParam
    ? { status: { in: statusParam.split(",").map((s) => s.trim()).filter(Boolean) } }
    : {}

  const orders = await db.order.findMany({
    where,
    orderBy: [{ deliveryDate: "asc" }, { createdAt: "desc" }],
    include: {
      customer: true,
      event: true,
      lineItems: true,
    },
  })

  const payload = orders.map((o) => serializeOrder(o))

  return NextResponse.json({ orders: payload, count: payload.length })
}

/**
 * POST /api/orders
 * Body: {
 *   customerId: string,
 *   deliveryDate?: string (ISO yyyy-mm-dd),
 *   deliveryAddress?: string,
 *   cardMessage?: string,
 *   deliveryNotes?: string,
 *   internalNotes?: string,
 *   deliveryFee?: number (default 100),
 *   discount?: number (default 0),
 *   lineItems: [{ productSku, qty }]
 * }
 *
 * Creates an order with status="draft" by default.
 * Auto-generates the next order number (ORD-1001, ORD-1002, ...).
 */
export async function POST(request: Request) {
  let body: {
    customerId?: string
    deliveryDate?: string
    deliveryAddress?: string
    cardMessage?: string
    deliveryNotes?: string
    internalNotes?: string
    deliveryFee?: number
    discount?: number
    eventId?: string
    lineItems?: { productSku: string; qty: number }[]
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  if (!body.customerId || typeof body.customerId !== "string") {
    return NextResponse.json({ error: "customerId is required" }, { status: 400 })
  }
  if (!body.lineItems || !Array.isArray(body.lineItems) || body.lineItems.length === 0) {
    return NextResponse.json({ error: "lineItems (non-empty array) required" }, { status: 400 })
  }

  // Validate customer exists
  const customer = await db.customer.findUnique({ where: { id: body.customerId } })
  if (!customer) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 })
  }

  // v1.9: Check if the delivery date falls on a blocked date
  if (body.deliveryDate) {
    const deliveryDateObj = new Date(body.deliveryDate)
    const blocked = await db.blockedDate.findUnique({ where: { date: deliveryDateObj } })
    if (blocked) {
      const dateKey = deliveryDateObj.toISOString().slice(0, 10)
      return NextResponse.json(
        {
          error: `The delivery date ${dateKey} is blocked (${blocked.reason}). Cannot create an order for this date.`,
          blockedReason: blocked.reason,
          blockedBy: blocked.blockedBy,
          hint: blocked.blockedBy === "system"
            ? "This is a system block (Sunday/holiday). Choose a different date."
            : "Unblock this date in the Calendar tab, or choose a different date.",
        },
        { status: 422 }
      )
    }
  }

  // Validate line items + snapshot product info
  const productSkus = body.lineItems.map((i) => i.productSku)
  const products = await db.product.findMany({ where: { sku: { in: productSkus } } })
  const productBySku = new Map(products.map((p) => [p.sku, p]))

  for (const item of body.lineItems) {
    if (!productBySku.has(item.productSku)) {
      return NextResponse.json({ error: `Product not found: ${item.productSku}` }, { status: 404 })
    }
    if (typeof item.qty !== "number" || item.qty < 1) {
      return NextResponse.json({ error: `Invalid qty for ${item.productSku}: ${item.qty}` }, { status: 400 })
    }
  }

  // Generate next order number: ORD-XXXX
  const lastOrder = await db.order.findFirst({ orderBy: { orderNumber: "desc" } })
  let nextNum = 1001
  if (lastOrder?.orderNumber) {
    const match = /^ORD-(\d+)$/.exec(lastOrder.orderNumber)
    if (match) nextNum = parseInt(match[1]) + 1
  }
  const orderNumber = `ORD-${nextNum}`

  try {
    const created = await db.order.create({
      data: {
        orderNumber,
        status: "draft",
        customerId: body.customerId,
        eventId: body.eventId || null,
        deliveryDate: body.deliveryDate ? new Date(body.deliveryDate + "T00:00:00") : null,
        deliveryAddress: body.deliveryAddress || null,
        cardMessage: body.cardMessage || null,
        deliveryNotes: body.deliveryNotes || null,
        internalNotes: body.internalNotes || null,
        deliveryFee: body.deliveryFee ?? 100,
        discount: body.discount ?? 0,
        lineItems: {
          create: body.lineItems.map((item) => {
            const p = productBySku.get(item.productSku)!
            return {
              productSku: p.sku,
              productName: p.name,
              productSize: p.size,
              qty: item.qty,
              unitPrice: p.actualPriceBeforeIva,
            }
          }),
        },
      },
      include: { customer: true, event: true, lineItems: true },
    })

    return NextResponse.json(
      { order: serializeOrder(created) },
      { status: 201 },
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: "Failed to create order", detail: msg }, { status: 500 })
  }
}

// v1.9: Prisma 6.x removed $inferTypes. Using `any` here is fine since this
// function is only called with order objects fetched from Prisma.
function serializeOrder(o: any) {
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    status: o.status,
    customerId: o.customerId,
    customerName: o.customer?.name ?? null,
    customerPhone: o.customer?.phone ?? null,
    customerEmail: o.customer?.email ?? null,
    customerAddress: o.customer?.address ?? null,
    eventId: o.eventId ?? null,
    eventName: o.event?.name ?? null,
    eventNumber: o.event?.eventNumber ?? null,
    deliveryDate: o.deliveryDate?.toISOString().split("T")[0] ?? null,
    deliveryAddress: o.deliveryAddress,
    cardMessage: o.cardMessage,
    deliveryNotes: o.deliveryNotes,
    internalNotes: o.internalNotes,
    deliveryFee: o.deliveryFee,
    discount: o.discount,
    quoteSentAt: o.quoteSentAt?.toISOString() ?? null,
    quoteSentVia: o.quoteSentVia,
    paymentMethod: o.paymentMethod,
    paymentOptionsSentAt: o.paymentOptionsSentAt?.toISOString() ?? null,
    paymentInstructionsSent: o.paymentInstructionsSent,
    paymentStatus: o.paymentStatus,
    paymentConfirmedAt: o.paymentConfirmedAt?.toISOString() ?? null,
    paymentAmount: o.paymentAmount,
    paymentReference: o.paymentReference,
    procurementStartedAt: o.procurementStartedAt?.toISOString() ?? null,
    producedAt: o.producedAt?.toISOString() ?? null,
    deliveredAt: o.deliveredAt?.toISOString() ?? null,
    fulfilledAt: o.fulfilledAt?.toISOString() ?? null,
    cancelledAt: o.cancelledAt?.toISOString() ?? null,
    lineItems: o.lineItems?.map((li: any) => ({
      id: li.id,
      productSku: li.productSku,
      productName: li.productName,
      productSize: li.productSize,
      qty: li.qty,
      unitPrice: li.unitPrice,
      lineTotal: li.unitPrice * li.qty,
    })) ?? [],
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
  }
}

export { serializeOrder }
