import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

/**
 * PATCH /api/events/[id]/status
 * Body: { status: string }
 * Updates an event's status.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json().catch(() => null)

  if (!body?.status) {
    return NextResponse.json({ error: "Missing field: status" }, { status: 400 })
  }

  const validStatuses = ["quote", "confirmed", "in_progress", "completed", "cancelled"]
  if (!validStatuses.includes(body.status)) {
    return NextResponse.json(
      { error: `Invalid status. Valid: ${validStatuses.join(", ")}` },
      { status: 400 }
    )
  }

  try {
    const event = await db.event.update({
      where: { id },
      data: { status: body.status },
    })
    return NextResponse.json({ event })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
