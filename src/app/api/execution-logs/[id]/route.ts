import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { logChange } from "@/lib/audit"

export const dynamic = "force-dynamic"

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/execution-logs/[id]
 * Returns a single execution log with its lines, event, and order.
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params
  const log = await db.executionLog.findUnique({
    where: { id },
    include: {
      lines: { orderBy: { id: "asc" } },
      event: { select: { eventNumber: true, name: true, eventDate: true } },
      order: { select: { orderNumber: true, status: true, customer: { select: { name: true } } } },
    },
  })
  if (!log) {
    return NextResponse.json({ error: "Execution log not found" }, { status: 404 })
  }
  return NextResponse.json({ log })
}

/**
 * PATCH /api/execution-logs/[id]
 *
 * v1.9.3 (Gap 2): editable execution logs. Replaces the previous "delete +
 * recreate" workaround with proper in-place edits. Allows fixing mistakes
 * without losing the original record's audit trail.
 *
 * Body (all optional — only fields you want to change):
 *   {
 *     status?: string,
 *     executedBy?: string,
 *     executedAt?: string (ISO),
 *     paymentStatus?: "paid" | "unpaid",
 *     quotedPrice?: number | null,
 *     notes?: string | null,
 *     startedAt?: string | null,
 *     completedAt?: string | null,
 *     durationMinutes?: number | null,
 *     lines?: Array<{
 *       id?: string,                // existing line ID — if absent, treat as new line
 *       materialSku: string,
 *       materialName?: string,
 *       qtyUsed: number,
 *       unit: string,
 *       unitCost: number,
 *       lineCost: number,
 *       type: string,
 *       source?: string,
 *       originalMaterialSku?: string | null,
 *       originalQty?: number | null,
 *       notes?: string | null,
 *       costBasis?: string,
 *       linkedAdhocPurchaseId?: string | null,
 *     }>,
 *   }
 *
 * If `lines` is provided, it's treated as the complete new set of lines:
 *   - Existing lines NOT in the new set are deleted (cascades their stock
 *     effects: refund any previously-deducted stock).
 *   - Existing lines in the new set (matched by id) are updated.
 *   - New lines (no id) are created.
 *
 * Stock delta logic on line edits:
 *   - If `qtyUsed` increased: deduct the delta (capped at current stock).
 *   - If `qtyUsed` decreased: refund the delta (atomic increment).
 *   - If `source` flipped from "inventory" to "donation"/"loan": refund the
 *     full previously-deducted amount.
 *   - If `source` flipped from "donation"/"loan" to "inventory": deduct
 *     the qtyUsed (capped at current stock).
 *   - If a line is deleted: refund the previously-deducted amount.
 *   - If a new line is added: deduct based on its source (same as POST).
 *
 * All changes are wrapped in $transaction (Class 1 fix pattern).
 *
 * Audit log entry created on every edit with a summary of what changed.
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  const { id } = await params
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  // Look up existing log + its lines (need the old lines to compute stock deltas)
  const existing = await db.executionLog.findUnique({
    where: { id },
    include: { lines: { orderBy: { id: "asc" } } },
  })
  if (!existing) {
    return NextResponse.json({ error: "Execution log not found" }, { status: 404 })
  }

  // Build top-level update payload from allowed fields
  const allowedTopFields = [
    "status", "executedBy", "paymentStatus", "notes",
  ]
  const topData: Record<string, unknown> = {}
  for (const key of allowedTopFields) {
    if (key in body) topData[key] = body[key]
  }

  // Validate paymentStatus if provided
  if (topData.paymentStatus !== undefined) {
    const validPaymentStatuses = ["paid", "unpaid"]
    if (!validPaymentStatuses.includes(topData.paymentStatus as string)) {
      return NextResponse.json(
        { error: `Invalid paymentStatus. Valid: ${validPaymentStatuses.join(", ")}` },
        { status: 400 },
      )
    }
  }

  // Parse executedAt if provided
  if (typeof body.executedAt === "string") {
    topData.executedAt = new Date(body.executedAt)
  }

  // Parse quotedPrice if provided (allow null to clear)
  if ("quotedPrice" in body) {
    const qp = body.quotedPrice
    if (qp === null || qp === undefined) {
      topData.quotedPrice = null
    } else if (typeof qp === "number" && Number.isFinite(qp)) {
      topData.quotedPrice = qp
    }
  }

  // Parse time tracking fields (all allow null to clear)
  if ("startedAt" in body) {
    topData.startedAt = body.startedAt ? new Date(body.startedAt as string) : null
  }
  if ("completedAt" in body) {
    topData.completedAt = body.completedAt ? new Date(body.completedAt as string) : null
  }
  if ("durationMinutes" in body) {
    const dm = body.durationMinutes
    if (dm === null || dm === undefined || dm === "") {
      topData.durationMinutes = null
    } else if (typeof dm === "number" && Number.isFinite(dm) && dm > 0) {
      topData.durationMinutes = Math.round(dm)
    }
  }

  // Parse the lines array if provided — this is the full new set of lines
  const newLinesRaw = Array.isArray(body.lines) ? body.lines as Array<Record<string, unknown>> : null

  // Track changes for audit log summary
  const changes: string[] = []
  if (Object.keys(topData).length > 0) {
    changes.push(`top-level: ${Object.keys(topData).join(", ")}`)
  }

  // If we have new lines, we need to compute the stock deltas + update the actualCost/etc.
  // We'll wrap everything in a transaction (Class 1 fix pattern).
  try {
    const log = await db.$transaction(async (tx) => {
      // ─── Step 1: handle line changes ───────────────────────────────
      if (newLinesRaw) {
        // Snapshot all materials referenced by the new lines (for stock + cost computation)
        const newSkus = newLinesRaw
          .map((l) => String(l.materialSku ?? ""))
          .filter((s) => s.length > 0)
        const existingSkus = existing.lines.map((l) => l.materialSku)
        const allSkus = Array.from(new Set([...newSkus, ...existingSkus]))

        const materials = await tx.material.findMany({
          where: { sku: { in: allSkus } },
          select: { sku: true, name: true, unit: true, unitCost: true, unitsPerPack: true, currentStockPacks: true, packPrice: true },
        })
        const materialMap = new Map(materials.map((m) => [m.sku, m]))

        // Build a map of OLD lines by id (for delta computation)
        const oldLinesById = new Map(existing.lines.map((l) => [l.id, l]))

        // Identify which old lines are being deleted (not in new set)
        const newLineIds = new Set(
          newLinesRaw
            .map((l) => l.id as string | undefined)
            .filter((id): id is string => typeof id === "string" && id.length > 0)
        )
        const deletedOldLines = existing.lines.filter((l) => !newLineIds.has(l.id))

        // ─── Stock refund for deleted lines ──────────────────────────
        for (const oldLine of deletedOldLines) {
          // Refund stock if the old line had source=inventory and type !== removal
          if (oldLine.source === "inventory" && oldLine.type !== "removal") {
            const material = materialMap.get(oldLine.materialSku)
            if (material) {
              const upp = material.unitsPerPack && material.unitsPerPack > 0
                ? material.unitsPerPack
                : 1
              const oldPacksDeducted = oldLine.qtyUsed / upp
              if (oldPacksDeducted > 0) {
                await tx.material.update({
                  where: { sku: oldLine.materialSku },
                  data: { currentStockPacks: { increment: oldPacksDeducted } },
                })
                // StockMovement for the refund
                try {
                  await tx.stockMovement.create({
                    data: {
                      date: new Date(),
                      materialSku: oldLine.materialSku,
                      packs: oldPacksDeducted,  // positive = refund
                      reason: "execution_edit_refund",
                      reference: existing.executionNumber,
                      notes: `Line deleted during edit of ${existing.executionNumber}: refunding ${oldPacksDeducted.toFixed(2)} packs of ${oldLine.materialName}.`,
                    },
                  })
                } catch { /* StockMovement table might not exist */ }
              }
            }
          }
        }

        // ─── Process new/updated lines ──────────────────────────────
        const lineIdsToKeep = new Set<string>()  // ids of lines that exist in DB and we keep
        // Build create payloads with concrete types so Prisma accepts createMany
        const newLineCreateData: Array<{
          executionLogId: string
          materialSku: string
          materialName: string
          qtyUsed: number
          unit: string
          unitCost: number
          lineCost: number
          type: string
          source: string
          originalMaterialSku: string | null
          originalQty: number | null
          notes: string | null
          costBasis: string
          linkedAdhocPurchaseId: string | null
        }> = []

        for (const newLine of newLinesRaw) {
          const materialSku = String(newLine.materialSku ?? "")
          if (!materialSku) continue
          const material = materialMap.get(materialSku)
          if (!material) {
            throw new Error(`Material not found: ${materialSku}`)
          }

          const qtyUsed = Number(newLine.qtyUsed) || 0
          const unitCost = Number(newLine.unitCost) || 0
          const lineCost = Number(newLine.lineCost) || (qtyUsed * unitCost)
          const type = String(newLine.type ?? "recipe")
          const source = String(newLine.source ?? "inventory")
          const costBasis = String(newLine.costBasis ?? "list")
          const linkedAdhocPurchaseId = (newLine.linkedAdhocPurchaseId as string | null) ?? null

          const lineId = typeof newLine.id === "string" ? newLine.id : null
          const oldLine = lineId ? oldLinesById.get(lineId) : null

          // ─── Stock delta computation ───────────────────────────────
          if (type !== "removal") {
            const upp = material.unitsPerPack && material.unitsPerPack > 0
              ? material.unitsPerPack
              : 1

            if (oldLine) {
              // Existing line being updated — compute delta
              lineIdsToKeep.add(oldLine.id)
              const oldSource = oldLine.source
              const oldType = oldLine.type

              if (source === "inventory" && oldSource === "inventory" && oldType !== "removal") {
                // Both old and new are inventory deductions — only the qty delta matters
                const oldPacks = oldLine.qtyUsed / upp
                const newPacks = qtyUsed / upp
                const deltaPacks = newPacks - oldPacks  // positive = more deduction, negative = refund
                if (Math.abs(deltaPacks) > 0.0001) {
                  if (deltaPacks > 0) {
                    // Additional deduction — capped at current stock
                    const currentStock = material.currentStockPacks ?? 0
                    const cappedDelta = Math.min(deltaPacks, Math.max(0, currentStock))
                    if (cappedDelta > 0) {
                      await tx.material.update({
                        where: { sku: materialSku },
                        data: { currentStockPacks: { decrement: cappedDelta } },
                      })
                      try {
                        await tx.stockMovement.create({
                          data: {
                            date: new Date(),
                            materialSku,
                            packs: -cappedDelta,
                            reason: "execution_edit",
                            reference: existing.executionNumber,
                            notes: `Edit: qty ${oldLine.qtyUsed}→${qtyUsed} for ${material.name}. Capped additional deduction: ${cappedDelta.toFixed(2)} packs.`,
                          },
                        })
                      } catch { /* ignore */ }
                    }
                  } else {
                    // Refund the negative delta
                    const refund = Math.abs(deltaPacks)
                    await tx.material.update({
                      where: { sku: materialSku },
                      data: { currentStockPacks: { increment: refund } },
                    })
                    try {
                      await tx.stockMovement.create({
                        data: {
                          date: new Date(),
                          materialSku,
                          packs: refund,
                          reason: "execution_edit_refund",
                          reference: existing.executionNumber,
                          notes: `Edit: qty ${oldLine.qtyUsed}→${qtyUsed} for ${material.name}. Refund: ${refund.toFixed(2)} packs.`,
                        },
                      })
                    } catch { /* ignore */ }
                  }
                }
              } else if (source === "inventory" && (oldSource === "donation" || oldSource === "loan") && oldType !== "removal") {
                // Source flipped donation/loan → inventory — now we DO deduct (capped)
                const newPacks = qtyUsed / upp
                const currentStock = material.currentStockPacks ?? 0
                const capped = Math.min(newPacks, Math.max(0, currentStock))
                if (capped > 0) {
                  await tx.material.update({
                    where: { sku: materialSku },
                    data: { currentStockPacks: { decrement: capped } },
                  })
                  try {
                    await tx.stockMovement.create({
                      data: {
                        date: new Date(),
                        materialSku,
                        packs: -capped,
                        reason: "execution_edit",
                        reference: existing.executionNumber,
                        notes: `Edit: source ${oldSource}→inventory for ${material.name}. Deducted ${capped.toFixed(2)} packs.`,
                      },
                    })
                  } catch { /* ignore */ }
                }
              } else if (source !== "inventory" && oldSource === "inventory" && oldType !== "removal") {
                // Source flipped inventory → donation/loan — refund the old deduction
                const oldPacks = oldLine.qtyUsed / upp
                if (oldPacks > 0) {
                  await tx.material.update({
                    where: { sku: materialSku },
                    data: { currentStockPacks: { increment: oldPacks } },
                  })
                  try {
                    await tx.stockMovement.create({
                      data: {
                        date: new Date(),
                        materialSku,
                        packs: oldPacks,
                        reason: "execution_edit_refund",
                        reference: existing.executionNumber,
                        notes: `Edit: source ${oldSource}→${source} for ${material.name}. Refunded ${oldPacks.toFixed(2)} packs.`,
                      },
                    })
                  } catch { /* ignore */ }
                }
              }
              // If both old and new are donation/loan, no stock change. If old was removal,
              // no stock was deducted before, so no refund needed.
            } else {
              // New line (no existing id) — deduct if source=inventory
              if (source === "inventory") {
                const newPacks = qtyUsed / upp
                const currentStock = material.currentStockPacks ?? 0
                const capped = Math.min(newPacks, Math.max(0, currentStock))
                if (capped > 0) {
                  await tx.material.update({
                    where: { sku: materialSku },
                    data: { currentStockPacks: { decrement: capped } },
                  })
                  try {
                    await tx.stockMovement.create({
                      data: {
                        date: new Date(),
                        materialSku,
                        packs: -capped,
                        reason: "execution_edit",
                        reference: existing.executionNumber,
                        notes: `Edit: new line added for ${material.name}. Deducted ${capped.toFixed(2)} packs.`,
                      },
                    })
                  } catch { /* ignore */ }
                }
              }
            }
          }

          // Build the create/update data for this line
          const lineData = {
            materialSku,
            materialName: String(newLine.materialName ?? material.name),
            qtyUsed,
            unit: String(newLine.unit ?? material.unit ?? "pack"),
            unitCost,
            lineCost,
            type,
            source,
            originalMaterialSku: (newLine.originalMaterialSku as string | null) ?? null,
            originalQty: newLine.originalQty != null ? Number(newLine.originalQty) : null,
            notes: (newLine.notes as string | null) ?? null,
            costBasis,
            linkedAdhocPurchaseId,
          }

          if (oldLine) {
            // Update existing line
            await tx.executionLogLine.update({
              where: { id: oldLine.id },
              data: lineData,
            })
          } else {
            // New line — collect for batch create
            newLineCreateData.push({
              ...lineData,
              executionLogId: existing.id,
            })
          }
        }

        // Delete lines that aren't in the keep set
        const idsToDelete = existing.lines
          .filter((l) => !lineIdsToKeep.has(l.id))
          .map((l) => l.id)
        if (idsToDelete.length > 0) {
          await tx.executionLogLine.deleteMany({
            where: { id: { in: idsToDelete } },
          })
        }

        // Create new lines
        if (newLineCreateData.length > 0) {
          await tx.executionLogLine.createMany({
            data: newLineCreateData,
          })
        }

        changes.push(`lines: ${newLinesRaw.length} (was ${existing.lines.length})`)
      }

      // ─── Step 2: recompute costs if lines changed OR top-level quotedPrice changed ──
      // Re-fetch the lines (post-edit) to compute actualCost
      const finalLines = await tx.executionLogLine.findMany({
        where: { executionLogId: existing.id },
      })
      const estimatedCost = finalLines
        .filter((l) => l.type === "recipe" || l.type === "substitution")
        .reduce((s, l) => s + (l.lineCost ?? 0), 0)
      const actualCost = finalLines
        .filter((l) => l.type !== "removal")
        .reduce((s, l) => s + (l.lineCost ?? 0), 0)

      const quotedPrice = topData.quotedPrice !== undefined
        ? (topData.quotedPrice as number | null)
        : existing.quotedPrice
      const marginDollars = quotedPrice !== null ? (quotedPrice ?? 0) - actualCost : null
      const marginPct = quotedPrice !== null && quotedPrice > 0
        ? ((quotedPrice - actualCost) / quotedPrice)
        : null

      topData.estimatedCost = estimatedCost
      topData.actualCost = actualCost
      topData.marginDollars = marginDollars
      topData.marginPct = marginPct

      // ─── Step 3: apply top-level updates ──────────────────────────
      const updated = await tx.executionLog.update({
        where: { id: existing.id },
        data: topData,
        include: { lines: { orderBy: { id: "asc" } } },
      })

      return updated
    })

    // Audit log entry
    await logChange({
      entityType: "ExecutionLog",
      entityId: existing.id,
      action: "update",
      newValue: `${existing.executionNumber} edited: ${changes.join(" · ") || "no changes"}`,
    })

    return NextResponse.json({ log })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
