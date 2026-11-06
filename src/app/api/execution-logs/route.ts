import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { generateSequentialNumber } from "@/lib/sequential-number"

export const dynamic = "force-dynamic"

/**
 * POST /api/execution-logs
 * Body: {
 *   eventId?: string,            // optional — links to Event
 *   orderId?: string,           // optional — links to Order (mutually exclusive with eventId in practice)
 *   executedAt: string (ISO),
 *   executedBy?: string,
 *   status: string,                  // planned | executed | partial | redone | cancelled
 *   quotedPrice?: number,
 *   notes?: string,
 *   lines: Array<{
 *     materialSku: string,
 *     materialName: string,          // denormalized snapshot
 *     qtyUsed: number,
 *     unit: string,
 *     unitCost: number,              // snapshot
 *     lineCost: number,             // qtyUsed × unitCost
 *     type: string,                  // recipe | addition | substitution | removal
 *     originalMaterialSku?: string,  // for substitutions
 *     originalQty?: number,          // for substitutions/removals
 *     notes?: string,
 *   }>,
 * }
 *
 * Computes:
 *  - executionNumber EXE-NNNN
 *  - estimatedCost = sum of lineCost where type in [recipe, substitution]  (proxy for "planned")
 *  - actualCost    = sum of lineCost where type != removal
 *  - marginDollars = quotedPrice - actualCost (when quotedPrice present)
 *  - marginPct     = marginDollars / quotedPrice (when quotedPrice > 0)
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body?.executedAt || !body?.status || !Array.isArray(body.lines)) {
    return NextResponse.json(
      { error: "Missing required fields: executedAt, status, lines[]" },
      { status: 400 }
    )
  }
  if (body.lines.length === 0) {
    return NextResponse.json(
      { error: "Execution log must contain at least one line item" },
      { status: 400 }
    )
  }

  // Validate every line has a real material
  for (const line of body.lines) {
    if (!line.materialSku || !line.qtyUsed || !line.unitCost) {
      return NextResponse.json(
        { error: `Line for ${line.materialSku ?? "(missing)"} is missing materialSku, qtyUsed, or unitCost` },
        { status: 400 }
      )
    }
  }

  // Snapshot material names + costs from DB so client can't lie about prices silently.
  // (We trust client-supplied unitCost because real cost may differ from catalog cost;
  //  but we DO verify the material exists and use its current name as fallback.)
  // v1.9: include unitsPerPack + currentStockPacks so we can deduct stock
  const materials = await db.material.findMany({
    where: { sku: { in: body.lines.map((l: { materialSku: string }) => l.materialSku) } },
    select: { sku: true, name: true, unit: true, unitCost: true, unitsPerPack: true, currentStockPacks: true },
  })
  const materialMap = new Map(materials.map((m) => [m.sku, m]))

  for (const line of body.lines) {
    if (!materialMap.has(line.materialSku)) {
      return NextResponse.json(
        { error: `Material not found: ${line.materialSku}` },
        { status: 404 }
      )
    }
  }

  // Compute costs
  const estimatedCost = body.lines
    .filter((l: { type: string }) => l.type === "recipe" || l.type === "substitution")
    .reduce((s: number, l: { lineCost: number }) => s + Number(l.lineCost || 0), 0)
  const actualCost = body.lines
    .filter((l: { type: string }) => l.type !== "removal")
    .reduce((s: number, l: { lineCost: number }) => s + Number(l.lineCost || 0), 0)

  const quotedPrice = body.quotedPrice ? Number(body.quotedPrice) : null
  const marginDollars = quotedPrice !== null ? quotedPrice - actualCost : null
  const marginPct = quotedPrice !== null && quotedPrice > 0
    ? (quotedPrice - actualCost) / quotedPrice
    : null

  // EXE-NNNN
  const executionNumber = await generateSequentialNumber(db, "executionLog", "executionNumber", "EXE-", 4)

  try {
    // Class 1 fix: wrap the entire execution log creation + stock deductions
    // in $transaction. If any stock update fails mid-loop, the execution log
    // itself is rolled back too — no partial state.
    //
    // Class 2 fix: stock deductions now use atomic { decrement } instead of
    // read-then-write. This prevents the stale-read race where two concurrent
    // operations on the same material would overwrite each other.
    const log = await db.$transaction(async (tx) => {
      const created = await tx.executionLog.create({
        data: {
          executionNumber,
          eventId: body.eventId || null,
          orderId: body.orderId || null,
          executedAt: new Date(body.executedAt),
          executedBy: body.executedBy || "Maria",
          status: body.status,
          estimatedCost,
          actualCost,
          quotedPrice,
          marginDollars,
          marginPct,
          notes: body.notes || null,
          lines: {
            create: body.lines.map((l: {
              materialSku: string
              materialName?: string
              qtyUsed: number
              unit: string
              unitCost: number
              lineCost: number
              type: string
              originalMaterialSku?: string
              originalQty?: number
              notes?: string
            }) => ({
              materialSku: l.materialSku,
              materialName: l.materialName || materialMap.get(l.materialSku)?.name || "(unknown)",
              qtyUsed: Number(l.qtyUsed),
              unit: l.unit || materialMap.get(l.materialSku)?.unit || "pack",
              unitCost: Number(l.unitCost),
              lineCost: Number(l.lineCost),
              type: l.type || "recipe",
              originalMaterialSku: l.originalMaterialSku || null,
              originalQty: l.originalQty ? Number(l.originalQty) : null,
              notes: l.notes || null,
            })),
          },
        },
        include: { lines: true },
      })

      // Deduct material stock for each line (except "removal" type)
      for (const line of body.lines) {
        if (line.type === "removal") continue

        const material = materialMap.get(line.materialSku)
        if (!material || !material.unitsPerPack || material.unitsPerPack <= 0) continue

        const packsUsed = Number(line.qtyUsed) / material.unitsPerPack
        if (packsUsed <= 0) continue

        // Class 2 fix: atomic decrement — translates to
        // UPDATE Material SET currentStockPacks = currentStockPacks - N
        await tx.material.update({
          where: { sku: line.materialSku },
          data: { currentStockPacks: { decrement: packsUsed } },
        })

        // StockMovement audit trail (best-effort — table might not exist)
        try {
          await tx.stockMovement.create({
            data: {
              date: new Date(),
              materialSku: line.materialSku,
              packs: -packsUsed,
              reason: "execution",
              reference: executionNumber,
              notes: `${line.type}: ${line.qtyUsed} ${line.unit} (${line.materialName || material.name})`,
            },
          })
        } catch {
          // StockMovement table might not exist — silently skip
        }
      }

      return created
    })

    return NextResponse.json({ log }, { status: 201 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
