import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * PATCH /api/orders/[id]/line-items
 * Body: { lineItems: [{ id?: string, productSku, qty }] }
 *
 * Replaces ALL line items on the order with the new list.
 * If an item has an `id`, it's updated (qty). If no `id`, it's created.
 * Existing line items not in the new list are deleted.
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  const { id } = await params
  let body: { lineItems?: { id?: string; productSku?: string; qty?: number }[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  if (!body.lineItems || !Array.isArray(body.lineItems)) {
    return NextResponse.json({ error: "lineItems array required" }, { status: 400 })
  }

  // Validate each line item
  for (const li of body.lineItems) {
    if (typeof li.qty !== "number" || li.qty < 0) {
      return NextResponse.json({ error: `Invalid qty: ${li.qty}` }, { status: 400 })
    }
    if (!li.id && !li.productSku) {
      return NextResponse.json({ error: "Line item must have id or productSku" }, { status: 400 })
    }
  }

  // Look up the order
  const order = await db.order.findUnique({
    where: { id },
    include: { lineItems: true },
  })
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 })
  }

  // Fetch products for any new line items (to snapshot name/price)
  const newSkus = body.lineItems
    .filter((li) => !li.id && li.productSku)
    .map((li) => li.productSku!) as string[]
  const products = newSkus.length > 0
    ? await db.product.findMany({ where: { sku: { in: newSkus } } })
    : []
  const productBySku = new Map(products.map((p) => [p.sku, p]))

  for (const li of body.lineItems) {
    if (!li.id && li.productSku && !productBySku.has(li.productSku)) {
      return NextResponse.json({ error: `Product not found: ${li.productSku}` }, { status: 404 })
    }
  }

  // Strategy: delete all existing line items, then create new ones.
  // This is simpler than tracking updates vs creates vs deletes individually.
  // SQLite handles this fine at our scale.
  try {
    await db.orderLineItem.deleteMany({ where: { orderId: id } })

    const itemsToCreate = body.lineItems
      .filter((li) => li.qty > 0)
      .map((li) => {
        // For existing items being updated, find the original (to preserve productSku + unitPrice snapshot)
        const existing = li.id ? order.lineItems.find((x) => x.id === li.id) : null
        const product = li.productSku ? productBySku.get(li.productSku) : null
        const productSku = existing?.productSku ?? li.productSku ?? ""
        const productName = existing?.productName ?? product?.name ?? ""
        const productSize = existing?.productSize ?? product?.size ?? null
        const unitPrice = existing?.unitPrice ?? product?.actualPriceBeforeIva ?? 0
        return {
          orderId: id,
          productSku,
          productName,
          productSize,
          qty: li.qty,
          unitPrice,
        }
      })

    if (itemsToCreate.length > 0) {
      await db.orderLineItem.createMany({ data: itemsToCreate })
    }

    const updated = await db.order.findUnique({
      where: { id },
      include: { customer: true, lineItems: true },
    })
    // Serialize the same way as the main orders endpoint — compute lineTotal
    // (the raw Prisma object doesn't have lineTotal, which crashes the UI)
    const serialized = updated ? {
      ...updated,
      lineItems: updated.lineItems.map((li) => ({
        ...li,
        lineTotal: li.unitPrice * li.qty,
      })),
    } : null
    return NextResponse.json({ order: serialized })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: "Failed to update line items", detail: msg }, { status: 500 })
  }
}
