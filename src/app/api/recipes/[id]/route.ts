import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

/**
 * PATCH /api/recipes/[id]
 * Body: {
 *   productId: string,
 *   updates: [{ lineId: string, qty?: number, color?: string | null }],
 *   deletes: [string],  // line IDs to delete
 *   newVersion?: string,  // e.g. "v2" — creates a RecipeVersion row
 * }
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json().catch(() => null)

  if (!body) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 })
  }

  try {
    const updates = body.updates as Array<{ lineId: string; qty?: number; color?: string | null }> || []
    const deletes = (body.deletes as string[]) || []

    // Update existing lines
    for (const u of updates) {
      if (!u.lineId) continue
      const data: Record<string, number | string | null> = {}
      if (u.qty !== undefined) {
        data.qty = u.qty
        // Recompute lineCost = qty * unitCost
        const line = await db.recipeLine.findUnique({ where: { id: u.lineId }, select: { unitCost: true } })
        if (line) {
          data.lineCost = u.qty * line.unitCost
        }
      }
      if (u.color !== undefined) {
        data.color = u.color
      }
      await db.recipeLine.update({ where: { id: u.lineId }, data })
    }

    // Delete lines
    if (deletes.length > 0) {
      await db.recipeLine.deleteMany({ where: { id: { in: deletes } } })
    }

    // Create new version if requested
    if (body.newVersion && body.productId) {
      const existingVersion = await db.recipeVersion.findUnique({
        where: { productId_version: { productId: body.productId, version: body.newVersion } },
      })
      if (!existingVersion) {
        // Mark old versions as superseded
        await db.recipeVersion.updateMany({
          where: { productId: body.productId, status: "active" },
          data: { status: "superseded" },
        })
        // Create new version
        await db.recipeVersion.create({
          data: {
            productId: body.productId,
            productSku: body.productSku ?? "",
            version: body.newVersion,
            effectiveFrom: new Date(),
            status: "active",
            notes: body.versionNotes ?? `Recipe edited — bumped to ${body.newVersion}`,
          },
        })
      }
    }

    return NextResponse.json({ ok: true, updated: updates.length, deleted: deletes.length })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
