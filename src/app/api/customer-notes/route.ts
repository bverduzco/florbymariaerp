import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { logChange } from "@/lib/audit"

export const dynamic = "force-dynamic"

/**
 * POST /api/customer-notes
 * Body: { customerId, channel, direction?, subject?, body, followUpDate?, recordedBy? }
 * Creates a customer communication note.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body?.customerId || !body?.channel || !body?.body) {
    return NextResponse.json(
      { error: "Missing required fields: customerId, channel, body" },
      { status: 400 }
    )
  }

  const customer = await db.customer.findUnique({ where: { id: body.customerId } })
  if (!customer) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 })
  }

  try {
    const note = await db.customerNote.create({
      data: {
        customerId: body.customerId,
        channel: body.channel,
        direction: body.direction ?? "outbound",
        subject: body.subject ?? null,
        body: body.body,
        followUpDate: body.followUpDate ? new Date(body.followUpDate) : null,
        recordedBy: body.recordedBy ?? "Maria",
      },
    })

    await logChange({
      entityType: "Customer", entityId: body.customerId,
      action: "create", fieldName: "customerNote",
      newValue: `${body.channel}: ${body.body.slice(0, 80)}`,
    })

    return NextResponse.json({ note }, { status: 201 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

/**
 * PATCH /api/customer-notes (by id in body)
 * Body: { id, followUpDone? }
 * Used to mark follow-up as done.
 */
export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body?.id) {
    return NextResponse.json({ error: "Missing required field: id" }, { status: 400 })
  }

  try {
    const data: Record<string, unknown> = {}
    if (typeof body.followUpDone === "boolean") data.followUpDone = body.followUpDone
    if (typeof body.body === "string") data.body = body.body

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 })
    }

    const note = await db.customerNote.update({ where: { id: body.id }, data })
    return NextResponse.json({ note })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
