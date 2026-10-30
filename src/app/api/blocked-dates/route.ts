import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

/**
 * POST /api/blocked-dates
 * Body: { date: string (ISO), reason: string, notes?: string, blockedBy?: string }
 * Creates a new blocked date.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body?.date || !body?.reason) {
    return NextResponse.json(
      { error: "Missing required fields: date, reason" },
      { status: 400 }
    )
  }

  const date = new Date(body.date)
  if (isNaN(date.getTime())) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 })
  }

  try {
    const blocked = await db.blockedDate.upsert({
      where: { date },
      update: {
        reason: body.reason,
        notes: body.notes ?? null,
        blockedBy: body.blockedBy ?? "Maria",
      },
      create: {
        date,
        reason: body.reason,
        notes: body.notes ?? null,
        blockedBy: body.blockedBy ?? "Maria",
      },
    })
    return NextResponse.json({ blockedDate: blocked }, { status: 201 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
