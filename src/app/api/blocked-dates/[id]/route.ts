import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * DELETE /api/blocked-dates/[id]
 * Removes a blocked date by its ID. Unblocks the date so orders can be
 * scheduled on it again.
 *
 * Safety: only non-system blocks can be deleted. System blocks (sundays,
 * holidays) should be managed differently — rejecting with 403 if attempted.
 */
export async function DELETE(_request: Request, { params }: RouteParams) {
  const { id } = await params

  try {
    const existing = await db.blockedDate.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: "Blocked date not found" }, { status: 404 })
    }

    // Prevent deletion of system blocks (auto-generated sundays, holidays)
    if (existing.blockedBy === "system") {
      return NextResponse.json(
        { error: "Cannot delete system-generated blocks (sundays, auto-holidays). These are managed automatically." },
        { status: 403 }
      )
    }

    await db.blockedDate.delete({ where: { id } })
    return NextResponse.json({ deleted: id, date: existing.date.toISOString() })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
