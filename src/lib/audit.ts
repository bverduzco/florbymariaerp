import { db } from "@/lib/db"

/**
 * Audit trail helper — logs entity changes to the AuditLog table.
 *
 * Usage:
 *   await logChange({ entityType: "Quote", entityId: id, action: "status_change", fieldName: "status", oldValue: "draft", newValue: "accepted" })
 *
 * Silently fails if the AuditLog table doesn't exist (catches errors).
 */
export async function logChange(params: {
  entityType: string
  entityId: string
  action: string
  fieldName?: string
  oldValue?: string | null
  newValue?: string | null
  changedBy?: string
}) {
  try {
    await db.auditLog.create({
      data: {
        entityType: params.entityType,
        entityId: params.entityId,
        action: params.action,
        fieldName: params.fieldName ?? null,
        oldValue: params.oldValue ?? null,
        newValue: params.newValue ?? null,
        changedBy: params.changedBy ?? "Maria",
      },
    })
  } catch {
    // AuditLog table might not exist — silently skip
  }
}

/**
 * Fetch audit trail for a specific entity.
 */
export async function getAuditTrail(entityType: string, entityId: string, limit = 20) {
  try {
    return await db.auditLog.findMany({
      where: { entityType, entityId },
      orderBy: { changedAt: "desc" },
      take: limit,
    })
  } catch {
    return []
  }
}

/**
 * Fetch recent audit log entries across all entities.
 */
export async function getRecentAudit(limit = 50) {
  try {
    return await db.auditLog.findMany({
      orderBy: { changedAt: "desc" },
      take: limit,
    })
  } catch {
    return []
  }
}
