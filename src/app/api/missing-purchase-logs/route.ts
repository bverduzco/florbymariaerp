import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

/**
 * GET /api/missing-purchase-logs
 * Returns missing purchase logs, optionally filtered by resolution status.
 * Query params:
 *   ?resolved=true  → only resolved logs
 *   ?resolved=false → only pending logs (default if no param)
 *   (no param)      → all logs
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const resolvedParam = searchParams.get("resolved")

  const where: Record<string, unknown> = {}
  if (resolvedParam === "true") {
    where.resolvedAt = { not: null }
  } else if (resolvedParam === "false") {
    where.resolvedAt = null
  }

  const logs = await db.missingPurchaseLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json({ logs, count: logs.length })
}
