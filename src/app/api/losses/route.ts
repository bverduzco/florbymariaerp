import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { generateSequentialNumber } from "@/lib/sequential-number"
import { logChange } from "@/lib/audit"

export const dynamic = "force-dynamic"

/**
 * POST /api/losses
 * Body: {
 *   materialSku: string,
 *   qtyLost: number,           // the quantity Maria actually lost (in the unit she picks)
 *   unit: string,              // "stem" | "pack" | "piece" — defaults to material's unit
 *   reason: string,
 *   discoveredBy?: string,
 *   notes?: string,
 *   acknowledgeDiscrepancy?: boolean,
 * }
 *
 * v1.9.2: Stem-level loss reporting.
 *   Maria logs "3 stems damaged" — the system converts to packs internally
 *   for stock deduction. The loss record stores BOTH:
 *     - qtyLostUnits: 3 (what Maria reported)
 *     - qtyLostPacks: 0.15 (3 / 20 unitsPerPack, for stock deduction)
 *
 * Cost impact is computed per-stem when unit != "pack":
 *   costImpact = qtyLostUnits × (packPrice / unitsPerPack)
 *   e.g. 3 stems × ($190 / 20 per pack) = 3 × $9.50 = $28.50
 *
 * Stock floor check: stock is deducted in packs, capped at currentStock.
 * Stock NEVER goes negative. MissingPurchaseLog created if insufficient.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body?.materialSku || !body?.qtyLost || !body?.reason) {
    return NextResponse.json(
      { error: "Missing required fields: materialSku, qtyLost, reason" },
      { status: 400 }
    )
  }

  // Fetch material data
  const material = await db.material.findUnique({
    where: { sku: body.materialSku },
    select: { packPrice: true, name: true, currentStockPacks: true, unitsPerPack: true, unit: true },
  })
  if (!material) {
    return NextResponse.json({ error: "Material not found" }, { status: 404 })
  }

  // Determine the unit Maria is reporting in
  // Default to the material's native unit, or "pack" if not set
  const reportUnit = body.unit || material.unit || "pack"

  // Determine unitsPerPack for conversion
  // If unitsPerPack is 0/null, treat as 1:1 (1 unit = 1 pack)
  const upp = material.unitsPerPack && material.unitsPerPack > 0
    ? material.unitsPerPack
    : 1

  const qtyLostUnits = Number(body.qtyLost)  // what Maria reported (e.g. 3 stems)

  // Convert to packs for stock deduction
  let packsRequested: number
  if (reportUnit === "pack") {
    // Maria logged in packs directly — no conversion needed
    packsRequested = qtyLostUnits
  } else {
    // Convert from stems/pieces to packs
    packsRequested = qtyLostUnits / upp
  }

  // Compute cost impact
  // Per-stem cost = packPrice / unitsPerPack
  // Total = qtyLostUnits × per-stem cost (when reporting in stems)
  // Or = packsRequested × packPrice (when reporting in packs)
  const perUnitCost = reportUnit === "pack"
    ? (material.packPrice ?? 0)
    : (material.packPrice ?? 0) / upp
  const costImpact = qtyLostUnits * perUnitCost

  // Stock floor check: cap at current stock
  const currentStock = material.currentStockPacks ?? 0
  const packsToDeduct = Math.min(packsRequested, Math.max(0, currentStock))
  const packsShort = Math.max(0, packsRequested - currentStock)
  const hasDiscrepancy = packsShort > 0

  const lossNumber = await generateSequentialNumber(db, "loss", "lossNumber", "LOSS-", 4)

  try {
    const result = await db.$transaction(async (tx) => {
      // Loss record stores BOTH the reported units AND the packs value
      const created = await tx.loss.create({
        data: {
          lossNumber,
          date: new Date(),
          materialSku: body.materialSku,
          qtyLostPacks: packsRequested,        // packs (for stock ledger)
          qtyLostUnits: qtyLostUnits,          // what Maria reported (3 stems)
          unit: reportUnit,                   // "stem" | "pack" | "piece"
          reason: body.reason,
          discoveredBy: body.discoveredBy ?? "Maria",
          costImpact,
          notes: body.notes ?? null,
        },
      })

      // Stock deduction: always capped (never goes negative)
      if (packsToDeduct > 0) {
        await tx.material.update({
          where: { sku: body.materialSku },
          data: { currentStockPacks: { decrement: packsToDeduct } },
        })
      }

      // StockMovement: records the ACTUAL deduction (capped)
      try {
        await tx.stockMovement.create({
          data: {
            date: new Date(),
            materialSku: body.materialSku,
            packs: -packsToDeduct,
            reason: "loss",
            reference: lossNumber,
            notes: hasDiscrepancy
              ? `Loss: ${body.reason}. ${qtyLostUnits} ${reportUnit} reported (${packsRequested.toFixed(2)} packs). CAPPED: only ${packsToDeduct.toFixed(2)} packs in stock — deducted all available.`
              : `Loss: ${body.reason}. ${qtyLostUnits} ${reportUnit} (${packsRequested.toFixed(2)} packs).`,
          },
        })
      } catch {
        // StockMovement table might not exist — silently skip
      }

      // If there's a discrepancy, create a MissingPurchaseLog
      if (hasDiscrepancy) {
        try {
          await tx.missingPurchaseLog.create({
            data: {
              materialSku: body.materialSku,
              materialName: material.name,
              qtyShort: packsShort,
              estCost: packsShort * (material.packPrice ?? 0),
              triggerType: "loss",
              triggerRef: lossNumber,
              notes: `Discovered via ${lossNumber}: reported ${qtyLostUnits} ${reportUnit} lost (${packsRequested.toFixed(2)} packs), only ${currentStock.toFixed(2)} packs in stock. ${packsShort.toFixed(2)} packs unaccounted.`,
            },
          })
        } catch {
          // MissingPurchaseLog table might not exist — silently skip
        }
      }

      return created
    })

    // Build response with warning if there was a discrepancy
    const response: Record<string, unknown> = {
      loss: result,
      stockAfter: Math.max(0, currentStock - packsToDeduct),
    }

    if (hasDiscrepancy) {
      response.warning = `Stock was ${currentStock.toFixed(2)} packs, not ${packsRequested.toFixed(2)} packs. Deducted ${packsToDeduct.toFixed(2)} (all available). Loss recorded at full reported value of ${qtyLostUnits} ${reportUnit}. A missing purchase log was created — check the Procurement tab.`
      response.qtyRequested = packsRequested
      response.qtyDeducted = packsToDeduct
      response.qtyShort = packsShort
      response.missingPurchaseFlagged = true
    }

    await logChange({
      entityType: "Loss",
      entityId: result.id,
      action: "create",
      newValue: `${lossNumber}: ${qtyLostUnits} ${reportUnit} of ${body.materialSku} — $${costImpact.toFixed(2)}`,
    })

    return NextResponse.json(response, { status: 201 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
