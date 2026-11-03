import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * PATCH /api/season-markers/[id]
 * Body: { name?, type?, startDate?, endDate?, color?, intensity?, description?, recurrence?, recurrenceRule? }
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  const { id } = await params
  const body = await request.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 })
  }

  const existing = await db.seasonMarker.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: "Season marker not found" }, { status: 404 })
  }

  const data: Record<string, unknown> = {}
  if (typeof body.name === "string") data.name = body.name
  if (typeof body.type === "string") data.type = body.type
  if (body.startDate) data.startDate = new Date(body.startDate)
  if (body.endDate !== undefined) data.endDate = body.endDate ? new Date(body.endDate) : null
  if (typeof body.color === "string") data.color = body.color
  if (body.intensity !== undefined) data.intensity = body.intensity || null
  if (typeof body.description === "string") data.description = body.description || null
  if (typeof body.recurrence === "string") data.recurrence = body.recurrence
  if (body.recurrenceRule !== undefined) data.recurrenceRule = body.recurrenceRule || null

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 })
  }

  try {
    const marker = await db.seasonMarker.update({ where: { id }, data })
    return NextResponse.json({ marker })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

/**
 * DELETE /api/season-markers/[id]
 */
export async function DELETE(_request: Request, { params }: RouteParams) {
  const { id } = await params
  const existing = await db.seasonMarker.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: "Season marker not found" }, { status: 404 })
  }

  try {
    await db.seasonMarker.delete({ where: { id } })
    return NextResponse.json({ deleted: id, name: existing.name })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
