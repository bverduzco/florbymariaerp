import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

/**
 * GET /api/purchase-orders
 * Returns all POs, optionally filtered by ?status=X
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const status = searchParams.get("status")

  const pos = await db.purchaseOrder.findMany({
    where: status ? { status } : undefined,
    orderBy: [{ createdAt: "desc" }],
    include: { lines: true },
  })

  const payload = pos.map((po) => ({
    id: po.id,
    poNumber: po.poNumber,
    supplier: po.supplier,
    status: po.status,
    totalCost: po.totalCost,
    notes: po.notes ?? "",
    lineCount: po.lines.length,
    createdAt: po.createdAt.toISOString(),
    lines: po.lines.map((l) => ({
      id: l.id,
      materialSku: l.materialSku,
      materialName: l.materialName,
      qtyPacks: l.qtyPacks,
      costPerPack: l.costPerPack,
      lineTotal: l.lineTotal,
    })),
  }))

  return NextResponse.json({ purchaseOrders: payload, count: payload.length })
}

/**
 * POST /api/purchase-orders
 * Body: {
 *   supplier: string,
 *   lines: [{ materialSku, materialName, qtyPacks, costPerPack }]
 * }
 * Creates a single PO for one supplier with the given lines.
 * Auto-generates PO number (PO-3001, PO-3002, ...).
 */
export async function POST(request: Request) {
  let body: {
    supplier?: string
    lines?: { materialSku: string; materialName: string; qtyPacks: number; costPerPack: number }[]
    notes?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  if (!body.supplier) {
    return NextResponse.json({ error: "Supplier is required" }, { status: 400 })
  }
  if (!body.lines || body.lines.length === 0) {
    return NextResponse.json({ error: "At least one line item is required" }, { status: 400 })
  }

  // Generate next PO number
  const lastPO = await db.purchaseOrder.findFirst({ orderBy: { poNumber: "desc" } })
  let nextNum = 3001
  if (lastPO?.poNumber) {
    const match = /^PO-(\d+)$/.exec(lastPO.poNumber)
    if (match) nextNum = parseInt(match[1]) + 1
  }
  const poNumber = `PO-${nextNum}`

  // Compute total
  const totalCost = body.lines.reduce((s, l) => s + l.qtyPacks * l.costPerPack, 0)

  try {
    const po = await db.purchaseOrder.create({
      data: {
        poNumber,
        supplier: body.supplier,
        status: "draft",
        totalCost,
        notes: body.notes ?? null,
        lines: {
          create: body.lines.map((l) => ({
            materialSku: l.materialSku,
            materialName: l.materialName,
            qtyPacks: l.qtyPacks,
            costPerPack: l.costPerPack,
            lineTotal: l.qtyPacks * l.costPerPack,
          })),
        },
      },
      include: { lines: true },
    })

    return NextResponse.json({
      purchaseOrder: {
        id: po.id,
        poNumber: po.poNumber,
        supplier: po.supplier,
        status: po.status,
        totalCost: po.totalCost,
        lineCount: po.lines.length,
        createdAt: po.createdAt.toISOString(),
      },
    }, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: "Failed to create PO", detail: msg }, { status: 500 })
  }
}
