import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

/**
 * PATCH /api/quotes/[id]
 * Body: { status?, lostReason?, linkedOrderId? }
 * Updates a quote's status (and optionally lost reason / linked order).
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json().catch(() => null)

  if (!body || (!body.status && !body.lostReason && !body.linkedOrderId)) {
    return NextResponse.json(
      { error: "Nothing to update — provide status, lostReason, or linkedOrderId" },
      { status: 400 }
    )
  }

  try {
    const data: Record<string, string | null> = {}
    if (body.status) data.status = body.status
    if (body.lostReason !== undefined) data.lostReason = body.lostReason ?? null
    if (body.linkedOrderId !== undefined) data.linkedOrderId = body.linkedOrderId ?? null

    const quote = await db.quote.update({
      where: { id },
      data,
    })
    return NextResponse.json({ quote })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
