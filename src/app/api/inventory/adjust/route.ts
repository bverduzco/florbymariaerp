import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

/**
 * POST /api/inventory/adjust
 * Body: { materialSku, deltaPacks, reason, notes? }
 * Creates a StockAdjustment record (append-only ledger — never edits past records).
 */
export async function POST(request: Request) {
  let body: {
    materialSku?: string
    deltaPacks?: number
    reason?: string
    notes?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  if (!body.materialSku || typeof body.materialSku !== "string") {
    return NextResponse.json({ error: "materialSku is required" }, { status: 400 })
  }
  if (typeof body.deltaPacks !== "number" || body.deltaPacks === 0) {
    return NextResponse.json({ error: "deltaPacks must be a non-zero number" }, { status: 400 })
  }

  const validReasons = ["loss", "expiration", "adjustment", "receipt", "sample", "other"]
  const reason = body.reason && validReasons.includes(body.reason) ? body.reason : "adjustment"

  const material = await db.material.findUnique({ where: { sku: body.materialSku } })
  if (!material) {
    return NextResponse.json({ error: "Material not found" }, { status: 404 })
  }

  const adjustment = await db.stockAdjustment.create({
    data: {
      materialSku: body.materialSku,
      deltaPacks: body.deltaPacks,
      reason,
      notes: body.notes || null,
    },
  })

  // Compute new stock
  const allAdjustments = await db.stockAdjustment.findMany({
    where: { materialSku: body.materialSku },
  })
  const adjustmentSum = allAdjustments.reduce((s, a) => s + a.deltaPacks, 0)
  const newStock = (material.currentStockPacks ?? 0) + adjustmentSum

  return NextResponse.json({
    success: true,
    adjustment: {
      id: adjustment.id,
      materialSku: adjustment.materialSku,
      deltaPacks: adjustment.deltaPacks,
      reason: adjustment.reason,
      notes: adjustment.notes,
      createdAt: adjustment.createdAt.toISOString(),
    },
    newStockPacks: newStock,
  }, { status: 201 })
}
