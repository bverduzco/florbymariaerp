import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

/**
 * POST /api/custom-recipes/create-order
 *
 * Saves a custom recipe as HIDDEN (not visible in Catalogue) + creates an Order
 * with a single line item whose description contains the full material breakdown.
 *
 * Body: {
 *   name: string,                    // recipe name (e.g. "Garden Romance")
 *   size?: string,
 *   description?: string,
 *   actualPrice?: number,            // pre-IVA; defaults to suggested
 *   customerId: string,              // required — who is this order for?
 *   deliveryDate?: string,            // ISO yyyy-mm-dd
 *   deliveryAddress?: string,
 *   cardMessage?: string,
 *   deliveryNotes?: string,
 *   internalNotes?: string,
 *   deliveryFee?: number,            // default 100
 *   discount?: number,               // default 0
 *   lines: [{ customMaterialId, qty }]
 * }
 *
 * Returns: { order: {...}, recipe: {...} }
 */
export async function POST(request: Request) {
  let body: {
    name?: string
    size?: string
    description?: string
    actualPrice?: number
    customerId?: string
    deliveryDate?: string
    deliveryAddress?: string
    cardMessage?: string
    deliveryNotes?: string
    internalNotes?: string
    deliveryFee?: number
    discount?: number
    lines?: { customMaterialId: string; qty: number }[]
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  // Validate required fields
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Recipe name is required" }, { status: 400 })
  }
  if (!body.customerId) {
    return NextResponse.json({ error: "customerId is required" }, { status: 400 })
  }
  if (!body.lines || body.lines.length === 0) {
    return NextResponse.json({ error: "At least one line item is required" }, { status: 400 })
  }

  // Validate customer exists
  const customer = await db.customer.findUnique({ where: { id: body.customerId } })
  if (!customer) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 })
  }

  // Fetch custom materials
  const materialIds = body.lines.map((l) => l.customMaterialId)
  const customMats = await db.customMaterial.findMany({
    where: { id: { in: materialIds } },
  })
  const matById = new Map(customMats.map((m) => [m.id, m]))

  // Validate line items
  for (const line of body.lines) {
    if (!matById.has(line.customMaterialId)) {
      return NextResponse.json({ error: `Custom material not found: ${line.customMaterialId}` }, { status: 404 })
    }
    if (typeof line.qty !== "number" || line.qty < 1) {
      return NextResponse.json({ error: `Invalid qty: ${line.qty}` }, { status: 400 })
    }
  }

  // Compute costs using El Gato prices
  let flowersCost = 0
  let otherMaterialsCost = 0
  const lineItems = body.lines.map((l) => {
    const m = matById.get(l.customMaterialId)!
    const lineCost = m.pricePerStem * l.qty
    if (m.type === "flower") {
      flowersCost += lineCost
    } else {
      otherMaterialsCost += lineCost
    }
    return {
      customMaterialId: l.customMaterialId,
      qty: l.qty,
      materialName: m.name,
      materialPrice: m.pricePerStem,
      materialType: m.type,
    }
  })

  const totalCost = flowersCost + otherMaterialsCost

  // Apply ERP pricing rules
  const flowersMultiplier = 2.5
  const otherMultiplier = 2.0
  const laborSurcharge = 0.40
  const iva = 0.16

  const subtotal = flowersCost * flowersMultiplier + otherMaterialsCost * otherMultiplier
  const withLabor = subtotal * (1 + laborSurcharge)
  const suggestedPrice = withLabor
  const actualPrice = typeof body.actualPrice === "number" && body.actualPrice > 0
    ? body.actualPrice
    : Math.round(suggestedPrice / 5) * 5

  // Generate consecutive SKU: PRD-CUSTOM-0001, PRD-CUSTOM-0002, ...
  const lastCustom = await db.customRecipe.findFirst({
    where: { erpProductSku: { startsWith: "PRD-CUSTOM-" } },
    orderBy: { erpProductSku: "desc" },
  })
  let nextNum = 1
  if (lastCustom?.erpProductSku) {
    const match = /^PRD-CUSTOM-(\d+)$/.exec(lastCustom.erpProductSku)
    if (match) nextNum = parseInt(match[1]) + 1
  }
  const sku = `PRD-CUSTOM-${String(nextNum).padStart(4, "0")}`

  // Build the line item description string
  // e.g. "Custom Bouquet: 5× Alstroemeria Amarilla, 3× Lisianthus Morado, 2× Ruscus"
  const breakdownStr = lineItems
    .map((li) => `${li.qty}× ${li.materialName}`)
    .join(", ")
  const lineItemDescription = `Custom Bouquet: ${breakdownStr}`

  // Build internal notes with "[Custom]" prefix
  const userInternalNotes = body.internalNotes?.trim() || ""
  const internalNotes = `[Custom] ${userInternalNotes}`.trim()

  // 1. Create the CustomRecipe (hidden = true — NOT visible in Catalogue)
  const recipe = await db.customRecipe.create({
    data: {
      name: body.name.trim(),
      size: body.size ?? null,
      description: body.description ?? lineItemDescription,
      flowersCost,
      otherMaterialsCost,
      totalCost,
      suggestedPrice,
      actualPrice,
      erpProductSku: sku,
      hidden: true,
      lines: {
        create: lineItems.map((li) => ({
          customMaterialId: li.customMaterialId,
          qty: li.qty,
          materialName: li.materialName,
          materialPrice: li.materialPrice,
          materialType: li.materialType,
        })),
      },
    },
    include: { lines: true },
  })

  // 2. Generate the next order number: ORD-XXXX
  const lastOrder = await db.order.findFirst({ orderBy: { orderNumber: "desc" } })
  let orderNum = 1001
  if (lastOrder?.orderNumber) {
    const match = /^ORD-(\d+)$/.exec(lastOrder.orderNumber)
    if (match) orderNum = parseInt(match[1]) + 1
  }
  const orderNumber = `ORD-${orderNum}`

  // 3. Create the Order with a single line item carrying the full breakdown
  const order = await db.order.create({
    data: {
      orderNumber,
      status: "draft",
      customerId: body.customerId,
      deliveryDate: body.deliveryDate ? new Date(body.deliveryDate + "T00:00:00") : null,
      deliveryAddress: body.deliveryAddress || null,
      cardMessage: body.cardMessage || null,
      deliveryNotes: body.deliveryNotes || null,
      internalNotes,
      deliveryFee: body.deliveryFee ?? 100,
      discount: body.discount ?? 0,
      lineItems: {
        create: {
          productSku: sku,
          productName: lineItemDescription,
          productSize: body.size ?? null,
          qty: 1,
          unitPrice: actualPrice,
        },
      },
    },
    include: { customer: true, lineItems: true },
  })

  return NextResponse.json(
    {
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        customerName: order.customer.name,
        lineItemDescription,
        actualPrice,
        sku,
      },
      recipe: {
        id: recipe.id,
        name: recipe.name,
        sku,
        hidden: true,
        totalCost,
        suggestedPrice,
        actualPrice,
        lineCount: lineItems.length,
      },
    },
    { status: 201 },
  )
}
