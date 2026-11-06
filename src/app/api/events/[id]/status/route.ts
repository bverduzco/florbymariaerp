import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { isValidEventTransition, EVENT_VALID_STATUSES } from "@/lib/status-transitions"

export const dynamic = "force-dynamic"

/**
 * PATCH /api/events/[id]/status
 * Body: { status: string }
 *
 * Updates an event's status. Validates that the transition is allowed
 * per the canonical pipeline (Class 6 fix):
 *   quote → confirmed → in_progress → completed
 *
 *   - Cancellation ("cancelled") is allowed from any non-terminal state.
 *   - Forward skips are allowed (e.g. quote → in_progress).
 *   - Backward transitions are NOT allowed (e.g. completed → quote).
 *   - Terminal states (completed, cancelled) are locked.
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

  if (!EVENT_VALID_STATUSES.includes(body.status)) {
    return NextResponse.json(
      { error: `Invalid status. Valid: ${EVENT_VALID_STATUSES.join(", ")}` },
      { status: 400 }
    )
  }

  // Class 6 fix: fetch current status and validate the transition
  const existing = await db.event.findUnique({
    where: { id },
    select: { status: true },
  })
  if (!existing) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 })
  }

  const transition = isValidEventTransition(existing.status, body.status)
  if (!transition.valid) {
    return NextResponse.json(
      {
        error: transition.reason ?? "Invalid status transition",
        currentStatus: existing.status,
        requestedStatus: body.status,
      },
      { status: 422 }
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
