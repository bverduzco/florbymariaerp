import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

/**
 * POST /api/supplier-prices
 * Body: { materialSku, supplierName, supplierId?, packPrice, unitsPerPack?, notes? }
 * Creates a new supplier price. Sets isLatest=true on the new record and
 * isLatest=false on all previous prices for the same (materialSku, supplierName).
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body?.materialSku || !body?.supplierName || !body?.packPrice) {
    return NextResponse.json(
      { error: "Missing required fields: materialSku, supplierName, packPrice" },
      { status: 400 }
    )
  }

  // Validate material exists
  const material = await db.material.findUnique({ where: { sku: body.materialSku } })
  if (!material) {
    return NextResponse.json({ error: "Material not found" }, { status: 404 })
  }

  try {
    // Mark previous prices from same supplier as not latest
    await db.supplierPrice.updateMany({
      where: { materialSku: body.materialSku, supplierName: body.supplierName },
      data: { isLatest: false },
    })

    const price = await db.supplierPrice.create({
      data: {
        date: new Date(),
        materialSku: body.materialSku,
        supplierName: body.supplierName,
        supplierId: body.supplierId ?? null,
        packPrice: Number(body.packPrice),
        unitsPerPack: body.unitsPerPack ? Number(body.unitsPerPack) : null,
        isLatest: true,
        notes: body.notes ?? null,
      },
    })
    return NextResponse.json({ price }, { status: 201 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
