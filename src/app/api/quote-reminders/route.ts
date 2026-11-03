import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

/**
 * POST /api/quote-reminders
 * Body: { quoteId, remindAt, note? }
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body?.quoteId || !body?.remindAt) {
    return NextResponse.json({ error: "Missing required fields: quoteId, remindAt" }, { status: 400 })
  }

  const quote = await db.quote.findUnique({ where: { id: body.quoteId } })
  if (!quote) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 })
  }

  try {
    const reminder = await db.quoteReminder.create({
      data: {
        quoteId: body.quoteId,
        remindAt: new Date(body.remindAt),
        note: body.note ?? null,
      },
    })
    return NextResponse.json({ reminder }, { status: 201 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

/**
 * PATCH /api/quote-reminders
 * Body: { id, done? }
 */
export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body?.id) {
    return NextResponse.json({ error: "Missing required field: id" }, { status: 400 })
  }

  try {
    const data: Record<string, unknown> = {}
    if (typeof body.done === "boolean") data.done = body.done
    if (typeof body.note === "string") data.note = body.note

    const reminder = await db.quoteReminder.update({ where: { id: body.id }, data })
    return NextResponse.json({ reminder })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
