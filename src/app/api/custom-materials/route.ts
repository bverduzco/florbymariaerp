import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

/**
 * GET /api/custom-materials
 * Returns all custom materials (e.g. from El Gato catalogue), optionally filtered by ?type=flower|foliage.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const type = searchParams.get("type")
  const source = searchParams.get("source") ?? "El Gato"

  const where: Record<string, unknown> = { source }
  if (type) where.type = type

  const materials = await db.customMaterial.findMany({
    where,
    orderBy: [{ type: "asc" }, { name: "asc" }],
  })

  const payload = materials.map((m) => ({
    id: m.id,
    name: m.name,
    pricePerStem: m.pricePerStem,
    type: m.type,
    class: m.class ?? "",
    source: m.source,
    erpSku: m.erpSku ?? "",
    erpName: m.erpName ?? "",
    matchScore: m.matchScore ?? null,
    matchConfidence: m.matchConfidence ?? null,
  }))

  return NextResponse.json({ materials: payload, count: payload.length })
}
