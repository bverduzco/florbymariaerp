import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

/**
 * GET /api/season-markers
 * Returns all season markers, ordered by startDate.
 */
export async function GET() {
  const markers = await db.seasonMarker.findMany({
    orderBy: { startDate: "asc" },
  })
  return NextResponse.json({ markers, count: markers.length })
}

/**
 * POST /api/season-markers
 * Body: { name, type, startDate, endDate?, color?, intensity?, description?, recurrence?, recurrenceRule? }
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body?.name || !body?.type || !body?.startDate) {
    return NextResponse.json(
      { error: "Missing required fields: name, type, startDate" },
      { status: 400 }
    )
  }

  // Generate next markerId
  const count = await db.seasonMarker.count()
  const markerId = `sm_${String(count + 1).padStart(3, "0")}`

  try {
    const marker = await db.seasonMarker.create({
      data: {
        markerId,
        name: body.name,
        type: body.type,
        startDate: new Date(body.startDate),
        endDate: body.endDate ? new Date(body.endDate) : null,
        color: body.color ?? "#A78BFA",
        intensity: body.intensity ?? null,
        description: body.description ?? null,
        recurrence: body.recurrence ?? "NONE",
        recurrenceRule: body.recurrenceRule ?? null,
      },
    })
    return NextResponse.json({ marker }, { status: 201 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
