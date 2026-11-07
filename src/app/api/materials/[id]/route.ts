import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { logChange } from "@/lib/audit"

export const dynamic = "force-dynamic"

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * PATCH /api/materials/[id]
 * Body: { name?, unitCost?, packPrice?, currentStockPacks?, supplier?, category?, unit?, notes? }
 * Updates the material. Only non-null fields are updated.
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  const { id } = await params
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const existing = await db.material.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: "Material not found" }, { status: 404 })
  }

  const data: Record<string, unknown> = {}
  if (typeof body.name === "string") data.name = body.name.trim()
  if (typeof body.unitCost === "number") data.unitCost = body.unitCost
  if (typeof body.packPrice === "number") data.packPrice = body.packPrice
  if (typeof body.currentStockPacks === "number") data.currentStockPacks = body.currentStockPacks
  if (typeof body.supplier === "string") data.supplier = body.supplier.trim() || null
  if (typeof body.category === "string") data.category = body.category
  if (typeof body.unit === "string") data.unit = body.unit
  if (typeof body.notes === "string") data.notes = body.notes.trim() || null
  if (typeof body.unitsPerPack === "number") data.unitsPerPack = body.unitsPerPack

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 })
  }

  try {
    const material = await db.material.update({ where: { id }, data })

    // Tier 2 audit: log which fields were changed
    const changedFields = Object.keys(data)
    await logChange({
      entityType: "Material",
      entityId: id,
      action: "update",
      fieldName: changedFields.join(", "),
      oldValue: existing.name,
      newValue: material.name,
    })

    return NextResponse.json({ material })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
