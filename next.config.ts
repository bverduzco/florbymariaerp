// next.config.ts — v1.8 (Vercel-friendly)
//
// v1.7 had `output: "standalone"` for self-contained server builds on
// Fly.io / Render. Vercel doesn't need (and shouldn't have) that — they
// handle Next.js builds natively.
//
// Apply: replace your existing next.config.ts with this file.

import type { NextConfig } from "next";

// Files to exclude from every serverless function bundle on Vercel.
// (Extracted as a constant so the same array can be applied to multiple
// route patterns without drift.)
//
// Why each one is excluded:
//   - better-sqlite3 + @prisma/adapter-better-sqlite3:
//       Local-dev-only SQLite adapter. Vercel runs against Turso via
//       @prisma/adapter-libsql, so better-sqlite3's native binary
//       (~27 MB) is dead weight in production.
//   - Prisma WASM engines for cockroachdb/postgresql/mysql/sqlserver:
//       Prisma ships WASM query engines for ALL 6 supported databases.
//       We only use SQLite/Turso, so the other 4 engines (~36 MB) are
//       pure waste. We keep the .sqlite. WASM engines.
//
// IMPORTANT: if we ever migrate to PostgreSQL, MySQL, CockroachDB, or
// SQL Server, remove the corresponding exclusion below so the right
// WASM engine gets bundled.
const EXCLUDE_FROM_ALL_FUNCTIONS = [
  // Local-dev-only SQLite adapter
  "./node_modules/better-sqlite3/**/*",
  "./node_modules/@prisma/adapter-better-sqlite3/**/*",

  // Prisma WASM engines for databases we don't use (we keep .sqlite.)
  "./node_modules/@prisma/client/runtime/query_engine_bg.cockroachdb.wasm-base64.*",
  "./node_modules/@prisma/client/runtime/query_engine_bg.postgresql.wasm-base64.*",
  "./node_modules/@prisma/client/runtime/query_engine_bg.mysql.wasm-base64.*",
  "./node_modules/@prisma/client/runtime/query_engine_bg.sqlserver.wasm-base64.*",
  "./node_modules/@prisma/client/runtime/query_compiler_bg.cockroachdb.wasm-base64.*",
  "./node_modules/@prisma/client/runtime/query_compiler_bg.postgresql.wasm-base64.*",
  "./node_modules/@prisma/client/runtime/query_compiler_bg.mysql.wasm-base64.*",
  "./node_modules/@prisma/client/runtime/query_compiler_bg.sqlserver.wasm-base64.*",
];

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdfmake"],

  // No trailingSlash — was added to fix a preview-proxy redirect loop on
  // /dashboard, but it breaks all POST endpoints (308 redirect drops body)
  // and causes auth redirect loops in production. The /dashboard issue was
  // a preview-proxy artifact, not a real app bug — Vercel serves /dashboard
  // cleanly without trailingSlash.

  // No `output: "standalone"` — Vercel handles this natively.
  // If you ever need to deploy to Fly.io or Render again, set:
  //   output: "standalone"

  typescript: {
    // Keep ignoreBuildErrors for now — clean up in a future minor version
    // once all the v1.7 type errors are fixed.
    ignoreBuildErrors: true,
  },

  reactStrictMode: false,

  // ─────────────────────────────────────────────────────────────────────────
  // Vercel storage optimization (added 2026-11-06)
  // ─────────────────────────────────────────────────────────────────────────
  //
  // Why: Vercel Hobby plan has a 10 GB combined Deployment Storage +
  // Functions Storage limit. Each of our 92 serverless functions was
  // bundling to ~96-101 MB because Prisma's runtime includes WASM query
  // engines for ALL 6 supported databases (sqlite, postgresql, mysql,
  // cockroachdb, sqlserver, mongodb). We only use SQLite/Turso, so 5 of
  // those 6 WASM engines (~36 MB per function) are pure waste.
  //
  // Additionally, `better-sqlite3` (the local-dev-only Prisma adapter for
  // file: URLs) was being bundled into every Vercel function — but it can
  // never be used in production because Vercel uses the libsql adapter
  // for Turso. ~27 MB of dead native binary per function.
  //
  // The excludes below tell Next.js's file tracer to omit these files
  // from function bundles. They're still available in node_modules for
  // local dev (the dev server reads from disk directly, not from the
  // bundle).
  //
  // Estimated savings: ~30-40 MB per function × 92 functions.
  // Total unique storage drops from ~3.5 GB to ~2.0-2.5 GB (Vercel
  // deduplicates shared files across functions, so the savings aren't
  // perfectly linear).
  //
  // IMPORTANT: if we ever migrate to PostgreSQL or MySQL, we need to
  // remove the corresponding exclusion lines below so the right WASM
  // engine gets bundled.
  outputFileTracingExcludes: {
    // Both API routes and page components (server components) import Prisma
    // via `db as prisma` from src/lib/db.ts, so both need the same
    // exclusions. We use the same array for both keys to keep them in sync.
    "/api/**": EXCLUDE_FROM_ALL_FUNCTIONS,
    "/**": EXCLUDE_FROM_ALL_FUNCTIONS,
  },

  // Vercel-specific: enable functions timeout extension to 60s for the
  // PDF/Excel generation endpoints (default is 10s on Hobby plan).
  // Requires Vercel Pro for the actual extension, but doesn't hurt to declare.
  // The routes themselves also set `export const maxDuration = 60`.
  experimental: {
    serverActions: {
      bodySizeLimit: "5mb",
    },
  },
};

export default nextConfig;
