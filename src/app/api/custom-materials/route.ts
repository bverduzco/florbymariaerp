import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

/**
 * GET /api/custom-materials
 * Returns only El Gato catalogue materials, optionally filtered by ?type=flower|foliage.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const type = searchParams.get("type")

  const where: Record<string, unknown> = { source: "El Gato" }
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
  }))

  return NextResponse.json({ materials: payload, count: payload.length })
}
