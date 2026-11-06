// src/app/api/admin/db-status/route.ts
//
// GET /api/admin/db-status
//   Returns the current database target (prod / demo / local / unknown)
//   based on the runtime DATABASE_URL env var.
//
// Why this exists:
//   The TopBar DB badge is a server component that already has access to
//   the target via getDbTarget(). The endpoint is provided for client-side
//   components that need to refresh the badge after a future toggle
//   operation, or for diagnostic curl use.
//
// Auth: requires the demo auth cookie. Returns 401 if not authenticated.
//   The DB target is not sensitive (it's already visible via the hostname
//   in network traffic), but we gate it behind auth so anonymous visitors
//   can't probe the deployment's DB wiring.

import { NextResponse } from "next/server"
import { isAuthed } from "@/lib/auth"
import { getDbTarget } from "@/lib/db-target"
import type { NextRequest } from "next/server"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const authed = await isAuthed(req)
  if (!authed) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 })
  }

  const info = getDbTarget()
  return NextResponse.json({
    target: info.target,
    label: info.label,
    description: info.description,
    hostname: info.hostname,
    isTurso: info.isTurso,
    isReadOnly: info.isReadOnly,
    // Note: env vars containing auth tokens are NOT exposed — only the
    // hostname (which is already visible in network traffic via Turso's
    // libsql protocol) and derived labels.
  })
}
