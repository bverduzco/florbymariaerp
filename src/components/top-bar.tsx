// src/components/top-bar.tsx — top bar of the ERP layout.
//
// Server component (no "use client" needed — no hooks used).
//
// Layout: 48px tall, white background, border-bottom. From left to right:
//   - DB badge: shows PROD / DEMO / LOCAL / TURSO based on the runtime
//     DATABASE_URL env var. Helps Maria always know which database her
//     edits are landing in. Badge is non-interactive for now — the
//     runtime DB toggle is on the wishlist.
//   - Spacer
//   - Logout link on the right.
//
// Why the badge is server-side:
//   The DATABASE_URL env var is only available on the server. By reading
//   it here (server component), we avoid exposing any DB wiring to the
//   client. The badge HTML is rendered once on the server and shipped as
//   part of the page; no client-side fetch is needed for the initial paint.
//
// Future: when the runtime DB toggle (Option B) is implemented, the badge
//   will become a client component that:
//   1. Reads the initial target from this server-rendered HTML
//   2. On click, POSTs to /api/admin/db-switch with the new target
//   3. Calls router.refresh() to re-fetch all server components against
//      the now-different DB connection.

import Link from "next/link"
import { getDbTarget } from "@/lib/db-target"

export function TopBar() {
  const db = getDbTarget()

  return (
    <div
      className="flex items-center justify-between px-4 bg-white border-b border-[#D6D3D1] flex-shrink-0"
      style={{ height: "48px" }}
    >
      {/* Left: DB badge */}
      <div
        className="flex items-center gap-2"
        title={`${db.description} — ${db.hostname}\n\nAll reads and writes go to this database.\n\nRuntime toggle (switch between prod and demo without leaving the page) is on the wishlist — see Settings → Wishlist.`}
        style={{ cursor: "default" }}
      >
        <span
          className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold tracking-wider"
          style={{
            background: db.color,
            color: db.textColor,
            letterSpacing: "0.05em",
            minWidth: "44px",
            justifyContent: "center",
          }}
        >
          {/* Pulsing dot to draw the eye */}
          <span
            aria-hidden
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              background: db.textColor,
              opacity: 0.7,
              display: "inline-block",
            }}
          />
          {db.label}
        </span>
        <span
          className="hidden sm:inline text-[10px] text-[#78716C]"
          style={{ fontFamily: "monospace", maxWidth: "240px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
        >
          {db.hostname}
        </span>
      </div>

      {/* Right: Logout */}
      <Link
        href="/login"
        className="text-xs text-[#78716C] hover:text-[#44403C] transition px-3 py-1.5 rounded border border-[#D6D3D1] hover:bg-[#FAFAF9]"
      >
        ⎋ Logout
      </Link>
    </div>
  )
}
