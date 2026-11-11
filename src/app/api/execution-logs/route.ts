import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { generateSequentialNumber } from "@/lib/sequential-number"
import { logChange } from "@/lib/audit"

export const dynamic = "force-dynamic"

/**
 * POST /api/execution-logs
 * Body: {
 *   eventId?: string,
 *   orderId?: string,
 *   executedAt: string (ISO),
 *   executedBy?: string,
 *   status: string,
 *   quotedPrice?: number,
 *   paymentStatus?: string,            // v1.9.3: "paid" | "unpaid" (default: "paid" if orderId set, else "unpaid")
 *   notes?: string,
 *   lines: Array<{
 *     materialSku: string,
 *     materialName?: string,
 *     qtyUsed: number,
 *     unit: string,
 *     unitCost: number,
 *     lineCost: number,
 *     type: string,                   // recipe | addition | substitution | removal
 *     source?: string,                 // inventory (default) | donation | loan
 *     originalMaterialSku?: string,
 *     originalQty?: number,
 *     notes?: string,
 *     costBasis?: string,             // v1.9.3: list (default) | linked-purchase | manual
 *     linkedAdhocPurchaseId?: string,  // v1.9.3: FK to AdHocPurchase.id when costBasis=linked-purchase
 *     color?: string,                  // v1.9.4: free-text — primary visual axis (rose color, vase color, etc.)
 *     variant?: string,                // v1.9.4: free-text — secondary axis (rose variety, eucalyptus species, vase size, etc.)
 *   }>,
 * }
 *
 * v1.9.2 Stock floor check + source handling:
 *   - Lines with source="donation" or source="loan" do NOT deduct stock.
 *     They're recorded for recipe accuracy + cost tracking ($0 for donations/loans).
 *   - Lines with source="inventory" (default) deduct stock, capped at currentStock.
 *     If qtyUsed > available stock, the deduction is capped and a MissingPurchaseLog
 *     is created for the difference.
 *   - Stock NEVER goes negative.
 *   - "removal" type lines don't deduct stock regardless of source.
 *
 * v1.9.3 paymentStatus + costBasis + time tracking:
 *   - paymentStatus defaults to "paid" when orderId is set, "unpaid" otherwise.
 *     Caller can override by passing paymentStatus explicitly. Replaces the
 *     previous implicit inference from quotedPrice (which conflated "real sale"
 *     with "has quote price field set").
 *   - costBasis + linkedAdhocPurchaseId on each line are passed through to the
 *     ExecutionLogLine record. The actual cost lookup (snapshotting unitCost
 *     from the linked AdHocPurchase) is done client-side in the dialog — the
 *     API just stores whatever unitCost/lineCost the client sends, plus the
 *     optional link to the AdHocPurchase.
 *   - Time tracking: startedAt, completedAt, durationMinutes all optional.
 *     The dialog supports three input modes:
 *       - Timer mode: user clicks Start (sets startedAt), clicks Stop (sets
 *         completedAt + computes durationMinutes from the delta).
 *       - Manual mode: user types durationMinutes directly; startedAt/
 *         completedAt stay null.
 *       - Hybrid: timer runs, user overrides durationMinutes at the end.
 *     Reports use durationMinutes if set, else compute from start/end.
 *     If durationMinutes is provided directly, we trust it (no recompute
 *     from startedAt/completedAt — the user's explicit override wins).
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

  // v1.9.3: paymentStatus default — paid if linked to an Order, unpaid otherwise.
  // Caller can override by passing paymentStatus explicitly. Validate the value.
  const validPaymentStatuses = ["paid", "unpaid"]
  const paymentStatus = body.paymentStatus && validPaymentStatuses.includes(body.paymentStatus)
    ? body.paymentStatus
    : (body.orderId ? "paid" : "unpaid")

  // v1.9.3: time tracking fields. All optional. Parse defensively — client
  // may send ISO strings (timer mode) or null (manual mode).
  const startedAt = body.startedAt ? new Date(body.startedAt) : null
  const completedAt = body.completedAt ? new Date(body.completedAt) : null
  // If the client provided durationMinutes explicitly, trust it (manual override).
  // Otherwise compute from start/end if both are present.
  let durationMinutes: number | null = null
  if (typeof body.durationMinutes === "number" && Number.isFinite(body.durationMinutes) && body.durationMinutes > 0) {
    durationMinutes = Math.round(body.durationMinutes)
  } else if (startedAt && completedAt) {
    const deltaMs = completedAt.getTime() - startedAt.getTime()
    if (deltaMs > 0) {
      durationMinutes = Math.round(deltaMs / 60000)
    }
  }

  // Validate every line has required fields
  for (const line of body.lines) {
    if (!line.materialSku || !line.qtyUsed || !line.unitCost) {
      return NextResponse.json(
        { error: `Line for ${line.materialSku ?? "(missing)"} is missing materialSku, qtyUsed, or unitCost` },
        { status: 400 }
      )
    }
  }

  // Snapshot material data from DB
  const materials = await db.material.findMany({
    where: { sku: { in: body.lines.map((l: { materialSku: string }) => l.materialSku) } },
    select: { sku: true, name: true, unit: true, unitCost: true, unitsPerPack: true, currentStockPacks: true, packPrice: true },
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

  // Track warnings for the response
  const warnings: string[] = []

  try {
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
          paymentStatus,  // v1.9.3: paid | unpaid
          startedAt,       // v1.9.3: optional, from timer
          completedAt,     // v1.9.3: optional, from timer
          durationMinutes, // v1.9.3: optional, manual override or computed
          lines: {
            create: body.lines.map((l: {
              materialSku: string
              materialName?: string
              qtyUsed: number
              unit: string
              unitCost: number
              lineCost: number
              type: string
              source?: string
              originalMaterialSku?: string
              originalQty?: number
              notes?: string
              costBasis?: string
              linkedAdhocPurchaseId?: string
              color?: string
              variant?: string
            }) => ({
              materialSku: l.materialSku,
              materialName: l.materialName || materialMap.get(l.materialSku)?.name || "(unknown)",
              qtyUsed: Number(l.qtyUsed),
              unit: l.unit || materialMap.get(l.materialSku)?.unit || "pack",
              unitCost: Number(l.unitCost),
              lineCost: Number(l.lineCost),
              type: l.type || "recipe",
              source: l.source || "inventory",
              originalMaterialSku: l.originalMaterialSku || null,
              originalQty: l.originalQty ? Number(l.originalQty) : null,
              notes: l.notes || null,
              // v1.9.3: cost basis + optional link to AdHocPurchase
              costBasis: l.costBasis || "list",
              linkedAdhocPurchaseId: l.linkedAdhocPurchaseId || null,
              // v1.9.4: per-line color + variant (free-text with autocomplete
              // from material.colors in the UI). Trim + nullify empties.
              color: typeof l.color === "string" && l.color.trim() ? l.color.trim() : null,
              variant: typeof l.variant === "string" && l.variant.trim() ? l.variant.trim() : null,
            })),
          },
        },
        include: { lines: true },
      })

      // Deduct material stock for each line
      for (const line of body.lines) {
        // "removal" type lines never deduct stock
        if (line.type === "removal") continue

        // donation/loan source lines never deduct stock — materials weren't from inventory
        const lineSource = line.source || "inventory"
        if (lineSource === "donation" || lineSource === "loan") continue

        const material = materialMap.get(line.materialSku)
        if (!material) continue

        // Bug fix: previously, materials with unitsPerPack=0 or null were
        // SKIPPED entirely — no stock check, no deduction, no MissingPurchaseLog.
        // This silently bypassed the stock floor check for 4 of 6 materials
        // in the database (most foliage + packaging have unitsPerPack=0).
        //
        // Fix: when unitsPerPack is 0/null, treat as 1:1 ratio
        // (1 unit used = 1 pack deducted). This is correct for most
        // foliage and packaging materials where "1 stem" or "1 base" = "1 pack."
        const upp = material.unitsPerPack && material.unitsPerPack > 0
          ? material.unitsPerPack
          : 1  // default 1:1 when unknown

        const packsRequested = Number(line.qtyUsed) / upp
        if (packsRequested <= 0) continue

        // Stock floor check: cap at current stock
        const currentStock = material.currentStockPacks ?? 0
        const packsToDeduct = Math.min(packsRequested, Math.max(0, currentStock))
        const packsShort = Math.max(0, packsRequested - currentStock)

        // Deduct (capped — never goes negative)
        if (packsToDeduct > 0) {
          await tx.material.update({
            where: { sku: line.materialSku },
            data: { currentStockPacks: { decrement: packsToDeduct } },
          })
        }

        // StockMovement: records the ACTUAL deduction (capped)
        try {
          await tx.stockMovement.create({
            data: {
              date: new Date(),
              materialSku: line.materialSku,
              packs: -packsToDeduct,
              reason: "execution",
              reference: executionNumber,
              notes: packsShort > 0
                ? `${line.type}: ${line.qtyUsed} ${line.unit} (${line.materialName || material.name}). CAPPED: requested ${packsRequested.toFixed(2)} packs, only ${packsToDeduct.toFixed(2)} in stock — deducted all available.`
                : `${line.type}: ${line.qtyUsed} ${line.unit} (${line.materialName || material.name})`,
            },
          })
        } catch {
          // StockMovement table might not exist — silently skip
        }

        // If there's a discrepancy, create a MissingPurchaseLog
        if (packsShort > 0) {
          const estCost = packsShort * (material.packPrice ?? 0)
          const lineId = created.lines.find((l) => l.materialSku === line.materialSku)?.id

          try {
            await tx.missingPurchaseLog.create({
              data: {
                materialSku: line.materialSku,
                materialName: material.name,
                qtyShort: packsShort,
                estCost,
                triggerType: "execution",
                triggerRef: executionNumber,
                triggerLineId: lineId ?? null,
                notes: `Discovered via ${executionNumber}: used ${line.qtyUsed} ${line.unit} of ${line.materialSku}, but only ${packsToDeduct.toFixed(2)} packs were in stock. ${packsShort.toFixed(2)} packs unaccounted — possible unlogged purchase.`,
              },
            })
          } catch {
            // MissingPurchaseLog table might not exist — silently skip
          }

          warnings.push(
            `${line.materialSku}: used ${line.qtyUsed} ${line.unit} but only ${packsToDeduct.toFixed(2)} packs were in stock. ` +
            `${packsShort.toFixed(2)} packs unaccounted — a missing purchase log was created. Check the Procurement tab.`
          )
        }
      }

      return created
    })

    const response: Record<string, unknown> = { log }
    if (warnings.length > 0) {
      response.warnings = warnings
    }

    await logChange({
      entityType: "ExecutionLog",
      entityId: log.id,
      action: "create",
      newValue: `${executionNumber}: ${body.lines.length} line(s) · actual $${actualCost.toFixed(2)}`,
    })

    return NextResponse.json(response, { status: 201 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
