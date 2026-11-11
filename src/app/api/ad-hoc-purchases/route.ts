import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { generateSequentialNumber } from "@/lib/sequential-number"

export const dynamic = "force-dynamic"

/**
 * POST /api/ad-hoc-purchases
 *
 * Body (v1.9.4 — adds color + variant fields):
 *   {
 *     vendor: string,                    // required
 *     materialSku?: string | null,       // optional — null when no SKU (first-time purchase)
 *     materialName?: string,             // required when materialSku is null (free-text); optional otherwise (denormalized from Material)
 *     materialType?: string,             // optional but recommended when no SKU: flower | foliage | packaging | other
 *     qtyPacks: number,                  // required
 *     unitCost: number,                  // required
 *     ticketNumber?: string,
 *     paymentMethod?: string,            // cash | card | transfer
 *     notes?: string,
 *     resolveMissingPurchaseId?: string, // when resolving a MissingPurchaseLog
 *     color?: string,                    // v1.9.4: free-text — primary visual axis (rose color, vase color, etc.)
 *     variant?: string,                  // v1.9.4: free-text — secondary axis (rose variety, eucalyptus species, vase size, etc.)
 *   }
 *
 * Creates a new ad-hoc purchase record. When resolveMissingPurchaseId is
 * provided, the purchase is treated as resolving an inventory discrepancy
 * (materials already consumed by execution/loss). The notes are auto-filled
 * with the discrepancy reference, and the MissingPurchaseLog is resolved.
 * No stock bump occurs — the materials were already used.
 *
 * v1.9.3: When materialSku is null, the purchase is logged with free-text
 * materialName + materialType. This supports first-time purchases from
 * vendors where the item has no SKU yet (e.g. Costco foliage mix). The
 * purchase exists in the financial records but doesn't bump inventory
 * (since we don't know which Material to bump). Maria can later create a
 * proper Material record and link past ad-hoc purchases to it if needed.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body?.vendor || !body?.qtyPacks || !body?.unitCost) {
    return NextResponse.json(
      { error: "Missing required fields: vendor, qtyPacks, unitCost" },
      { status: 400 }
    )
  }

  const qtyPacks = Number(body.qtyPacks)
  const unitCost = Number(body.unitCost)
  const total = qtyPacks * unitCost

  // Two paths: SKU-linked (existing) or no-SKU free-text (v1.9.3)
  let materialSku: string | null = null
  let materialName: string
  let materialType: string | null = null

  if (body.materialSku && typeof body.materialSku === "string") {
    // SKU path — look up the Material to denormalize name + type
    const material = await db.material.findUnique({ where: { sku: body.materialSku } })
    if (!material) {
      return NextResponse.json({ error: "Material not found" }, { status: 404 })
    }
    materialSku = body.materialSku
    // Use the user-provided materialName if given, otherwise denormalize from Material.name
    materialName = body.materialName?.trim() || material.name
    materialType = body.materialType?.trim() || material.category
  } else {
    // No-SKU path — free-text name + type (v1.9.3)
    if (!body.materialName?.trim()) {
      return NextResponse.json(
        { error: "materialName is required when materialSku is not provided (no-SKU purchase)" },
        { status: 400 }
      )
    }
    materialName = body.materialName.trim()
    materialType = body.materialType?.trim() || null
  }

  const adhocNumber = await generateSequentialNumber(db, "adHocPurchase", "adhocNumber", "ADHOC-", 4)

  // If resolving a missing purchase, auto-fill notes
  let notes = body.notes?.trim() || null
  let missingPurchaseLog: { id: string; triggerRef: string | null; materialName: string; qtyShort: number } | null = null

  if (body.resolveMissingPurchaseId) {
    try {
      missingPurchaseLog = await db.missingPurchaseLog.findUnique({
        where: { id: body.resolveMissingPurchaseId },
        select: { id: true, triggerRef: true, materialName: true, qtyShort: true },
      })
      if (missingPurchaseLog) {
        const resolutionNote = `Resolving inventory discrepancy for ${missingPurchaseLog.triggerRef ?? "execution"}: ${qtyPacks} packs of ${materialName} were used but not in inventory.`
        notes = notes ? `${notes}\n\n${resolutionNote}` : resolutionNote
      }
    } catch {
      // MissingPurchaseLog table might not exist — proceed without resolution
    }
  }

  try {
    const purchase = await db.adHocPurchase.create({
      data: {
        adhocNumber,
        date: new Date(),
        vendor: body.vendor.trim(),
        materialSku,  // null when no-SKU
        materialName, // always populated
        materialType, // null when SKU path + Material has no category; set when no-SKU path
        qtyPacks,
        unitCost,
        total,
        ticketNumber: body.ticketNumber?.trim() || null,
        paymentMethod: body.paymentMethod || null,
        notes,
        // v1.9.4: per-line color + variant (free-text with autocomplete offered
        // from material.colors in the UI). Trim + nullify empties so the DB
        // doesn't fill up with "" strings.
        color: typeof body.color === "string" && body.color.trim() ? body.color.trim() : null,
        variant: typeof body.variant === "string" && body.variant.trim() ? body.variant.trim() : null,
      },
    })

    // If resolving a missing purchase, mark it as resolved
    if (missingPurchaseLog) {
      try {
        await db.missingPurchaseLog.update({
          where: { id: missingPurchaseLog.id },
          data: {
            resolutionType: "purchase",
            resolvedAt: new Date(),
            resolvedByPo: adhocNumber,
            resolvedNotes: `Resolved via ${adhocNumber}. Materials were already consumed — purchase recorded for financial accuracy.`,
          },
        })
      } catch {
        // Best-effort — the purchase was created, resolution tracking is secondary
      }
    }

    return NextResponse.json({ purchase, resolvedMissingPurchase: !!missingPurchaseLog }, { status: 201 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
