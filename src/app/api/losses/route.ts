import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

/**
 * POST /api/losses
 * Body: { materialSku, qtyLostPacks, reason, discoveredBy?, notes? }
 * Creates a new loss record. Computes costImpact from material's packPrice.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body?.materialSku || !body?.qtyLostPacks || !body?.reason) {
    return NextResponse.json(
      { error: "Missing required fields: materialSku, qtyLostPacks, reason" },
      { status: 400 }
    )
  }

  // Fetch material to compute cost impact
  const material = await db.material.findUnique({
    where: { sku: body.materialSku },
    select: { packPrice: true, name: true },
  })
  if (!material) {
    return NextResponse.json({ error: "Material not found" }, { status: 404 })
  }

  const qtyLost = Number(body.qtyLostPacks)
  const costImpact = (material.packPrice ?? 0) * qtyLost

  const count = await db.loss.count()
  const lossNumber = `LOSS-${String(count + 1).padStart(4, "0")}`

  try {
    const loss = await db.loss.create({
      data: {
        lossNumber,
        date: new Date(),
        materialSku: body.materialSku,
        qtyLostPacks: qtyLost,
        reason: body.reason,
        discoveredBy: body.discoveredBy ?? "Maria",
        costImpact,
        notes: body.notes ?? null,
      },
    })
    return NextResponse.json({ loss }, { status: 201 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
