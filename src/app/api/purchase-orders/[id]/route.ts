import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/purchase-orders/[id]
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params
  const po = await db.purchaseOrder.findUnique({
    where: { id },
    include: { lines: true },
  })
  if (!po) {
    return NextResponse.json({ error: "PO not found" }, { status: 404 })
  }
  return NextResponse.json({ purchaseOrder: po })
}

/**
 * PATCH /api/purchase-orders/[id]
 * Body: { status?, notes? }
 * When status changes to "received", also creates StockAdjustment records
 * for each line (adding qtyPacks to inventory).
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  const { id } = await params
  let body: { status?: string; notes?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const existing = await db.purchaseOrder.findUnique({
    where: { id },
    include: { lines: true },
  })
  if (!existing) {
    return NextResponse.json({ error: "PO not found" }, { status: 404 })
  }

  const data: Record<string, unknown> = {}
  if (body.status) data.status = body.status
  if (body.notes !== undefined) data.notes = body.notes

  // If marking as received, create stock adjustments for each line
  if (body.status === "received" && existing.status !== "received") {
    for (const line of existing.lines) {
      await db.stockAdjustment.create({
        data: {
          materialSku: line.materialSku,
          deltaPacks: line.qtyPacks,
          reason: "receipt",
          notes: `Received from PO ${existing.poNumber}`,
        },
      })
    }
  }

  const updated = await db.purchaseOrder.update({
    where: { id },
    data,
    include: { lines: true },
  })

  return NextResponse.json({ purchaseOrder: updated })
}

/**
 * DELETE /api/purchase-orders/[id]
 */
export async function DELETE(_request: Request, { params }: RouteParams) {
  const { id } = await params
  try {
    await db.purchaseOrder.delete({ where: { id } })
    return NextResponse.json({ success: true, id })
  } catch {
    return NextResponse.json({ error: "PO not found" }, { status: 404 })
  }
}
