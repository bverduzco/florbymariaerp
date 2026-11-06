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

  // If marking as received, update material stock for each line
  if (body.status === "received" && existing.status !== "received") {
    // Class 1 fix: wrap all stock updates + PO status change in $transaction.
    // If any material update fails mid-loop, the PO isn't marked as received
    // and no stock changes are committed.
    //
    // Class 2 fix: atomic increment instead of read-then-write.
    const updated = await db.$transaction(async (tx) => {
      for (const line of existing.lines) {
        // Atomic stock increment — translates to
        // UPDATE Material SET currentStockPacks = currentStockPacks + N
        await tx.material.update({
          where: { sku: line.materialSku },
          data: { currentStockPacks: { increment: line.qtyPacks } },
        })

        // StockMovement audit trail (best-effort)
        try {
          await tx.stockMovement.create({
            data: {
              date: new Date(),
              materialSku: line.materialSku,
              packs: line.qtyPacks,
              reason: "PO_received",
              reference: existing.poNumber,
              notes: `Received ${line.qtyPacks} packs of ${line.materialName}`,
            },
          })
        } catch {
          // StockMovement table might not exist — silently skip
        }

        // Also create StockAdjustment (legacy — some code may read this table)
        try {
          await tx.stockAdjustment.create({
            data: {
              materialSku: line.materialSku,
              deltaPacks: line.qtyPacks,
              reason: "receipt",
              notes: `Received from PO ${existing.poNumber}`,
            },
          })
        } catch {
          // StockAdjustment table might not exist — silently skip
        }
      }

      // Update the PO status itself (inside the transaction)
      return tx.purchaseOrder.update({
        where: { id },
        data,
        include: { lines: true },
      })
    })

    return NextResponse.json({ purchaseOrder: updated })
  }

  // For non-receive updates (status changes, notes, etc.) — no stock mutation needed
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
