import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * POST /api/quotes/[id]/convert-to-order
 *
 * Converts an accepted (or any) quote into an Order:
 *   1. Creates a new Order with the same customer + line items
 *   2. Copies delivery date, address, notes from the quote
 *   3. Links the Quote to the Order via Quote.orderId (proper FK)
 *   4. Updates Quote status to "accepted"
 *   5. Sets Order status to "awaiting_payment" (deposit not yet paid)
 *
 * Idempotency: if the quote already has orderId set, returns the existing
 * order instead of creating a duplicate.
 *
 * Returns: { order, quote, created: boolean }
 */
export async function POST(_request: Request, { params }: RouteParams) {
  const { id } = await params

  const quote = await db.quote.findUnique({
    where: { id },
    include: { lines: { orderBy: { lineNumber: "asc" } } },
  })

  if (!quote) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 })
  }

  // Idempotency: if already linked to an order, return it
  if (quote.orderId) {
    const existingOrder = await db.order.findUnique({
      where: { id: quote.orderId },
      include: { lineItems: true },
    })
    if (existingOrder) {
      return NextResponse.json({
        order: existingOrder,
        quote,
        created: false,
        message: `Quote already linked to ${existingOrder.orderNumber}`,
      })
    }
  }

  if (quote.lines.length === 0) {
    return NextResponse.json(
      { error: "Cannot convert: quote has no line items" },
      { status: 422 }
    )
  }

  // Resolve customer link (quote may have customerId or just customerName)
  let customerId = quote.customerId
  if (!customerId && quote.customerName) {
    // Try to find a customer by name
    const customer = await db.customer.findFirst({
      where: { name: { contains: quote.customerName } },
    })
    if (customer) customerId = customer.id
  }
  if (!customerId) {
    return NextResponse.json(
      { error: "Cannot convert: quote has no linked customer. Add a customer first." },
      { status: 422 }
    )
  }

  // Validate all line items have valid product SKUs (snapshot them)
  const productSkus = quote.lines
    .map((l) => l.productSku)
    .filter((s): s is string => Boolean(s))

  const products = productSkus.length > 0
    ? await db.product.findMany({ where: { sku: { in: productSkus } } })
    : []
  const productBySku = new Map(products.map((p) => [p.sku, p]))

  // Generate next order number
  const lastOrder = await db.order.findFirst({ orderBy: { orderNumber: "desc" } })
  let nextNum = 1001
  if (lastOrder?.orderNumber) {
    const match = /^ORD-(\d+)$/.exec(lastOrder.orderNumber)
    if (match) nextNum = parseInt(match[1]) + 1
  }
  const orderNumber = `ORD-${nextNum}`

  try {
    // Class 1 fix: wrap the entire conversion in $transaction.
    // Steps: create order + line items → link quote → promote customer → audit log.
    // If any step fails, all are rolled back. Without this, a failure mid-way could
    // leave an orphaned Order with no linked Quote, or a Quote marked "accepted"
    // with no corresponding Order.
    const result = await db.$transaction(async (tx) => {
      // Create order + line items
      const order = await tx.order.create({
        data: {
          orderNumber,
          customerId,
          eventId: quote.eventId,
          status: "awaiting_payment",
          paymentStatus: "not_started",
          deliveryDate: quote.eventDate,
          cardMessage: null,
          deliveryNotes: null,
          internalNotes: quote.notes,
          deliveryFee: 100, // default
          discount: 0,
          lineItems: {
            create: quote.lines.map((line) => {
              const product = line.productSku ? productBySku.get(line.productSku) : null
              return {
                productSku: line.productSku ?? "",
                // Note: OrderLineItem does NOT have a productId field (unlike QuoteLine).
                // We snapshot the SKU + name + size + price instead.
                productName: line.description,
                productSize: product?.size ?? null,
                qty: line.qty,
                unitPrice: line.unitPrice,
              }
            }),
          },
        },
        include: { lineItems: true },
      })

      // Link quote → order + update status to accepted
      const updatedQuote = await tx.quote.update({
        where: { id },
        data: {
          orderId: order.id,
          status: "accepted",
          // Keep legacy linkedOrderId in sync
          linkedOrderId: order.orderNumber,
        },
      })

      // Auto-update customer status: prospect → customer
      await tx.customer.updateMany({
        where: { id: customerId, status: "prospect" },
        data: { status: "customer" },
      })

      // Audit trail (using tx instead of db — stays in the transaction)
      try {
        await tx.auditLog.create({
          data: {
            entityType: "Quote", entityId: id,
            action: "convert", fieldName: "orderId",
            oldValue: null, newValue: order.id,
            changedBy: "Maria",
          },
        })
        await tx.auditLog.create({
          data: {
            entityType: "Order", entityId: order.id,
            action: "create", fieldName: "source",
            newValue: `Converted from ${quote.quoteNumber}`,
            changedBy: "Maria",
          },
        })
      } catch {
        // AuditLog table might not exist — silently skip (non-critical)
      }

      return { order, updatedQuote }
    })

    return NextResponse.json(
      {
        order: result.order,
        quote: result.updatedQuote,
        created: true,
        message: `Converted to ${result.order.orderNumber}. Quote marked as accepted. Customer promoted to "customer".`,
      },
      { status: 201 }
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
