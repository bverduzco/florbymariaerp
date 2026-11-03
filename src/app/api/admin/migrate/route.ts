// src/app/api/admin/migrate/route.ts — one-time schema migration endpoint
//
// Visiting this URL (while authenticated) applies any pending Turso
// migrations defined in src/lib/migrations.ts to the production database.
// Uses the DATABASE_URL env var that Vercel already has set.
//
// Why this exists:
//   The original Turso schema was applied at commit 6659ad2 (Oct 31) when
//   the schema had 40 tables. Since then, 3 new tables (CustomerNote,
//   QuoteReminder, AuditLog) and 4 new columns (Quote.deliveryFee/discount/
//   discountType, Order.discountType) were added to the Prisma schema but
//   never applied to Turso. This caused every page touching Quote/Order/
//   Customer to return HTTP 500 in production.
//
//   Rather than asking Maria to set up local env vars and run a script,
//   this endpoint lets her apply the migration by visiting a URL.
//
// Usage:
//   Visit https://florbymaria.vercel.app/api/admin/migrate in a browser
//   while logged in. Or:
//   curl -b cookies.txt https://florbymaria.vercel.app/api/admin/migrate
//
// After the migration is applied, this endpoint becomes a no-op (returns
// "already applied"). Safe to leave in place for future migrations.

import { NextResponse } from "next/server"
import { isAuthed } from "@/lib/auth"
import { MIGRATIONS } from "@/lib/migrations"
import type { NextRequest } from "next/server"
import { createClient } from "@libsql/client"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(req: NextRequest) {
  // Auth check — only authenticated users can run migrations
  const authed = await isAuthed(req)
  if (!authed) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 })
  }

  const url = process.env.DATABASE_URL
  if (!url || !/^(libsql|https?):\/\//.test(url)) {
    return NextResponse.json(
      { error: "DATABASE_URL is not set to a Turso/libSQL URL on this environment." },
      { status: 500 },
    )
  }

  const client = createClient({ url })
  const log: string[] = []

  try {
    // Sanity-check base schema
    const tables = await client.execute('SELECT "name" FROM "sqlite_master" WHERE "type" = \'table\'')
    const tableNames = new Set(tables.rows.map((row) => String(row.name)))
    log.push(`Database has ${tableNames.size} tables before migration.`)

    // Create migrations tracker if missing
    await client.execute(
      'CREATE TABLE IF NOT EXISTS "__turso_migrations" ("name" TEXT PRIMARY KEY NOT NULL, "applied_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)',
    )

    let applied = 0
    let skipped = 0
    let failed = 0

    for (const migration of MIGRATIONS) {
      // Skip if already applied
      const already = await client.execute({
        sql: 'SELECT "name" FROM "__turso_migrations" WHERE "name" = ?',
        args: [migration.name],
      })
      if (already.rows.length > 0) {
        log.push(`· ${migration.name} (already applied)`)
        skipped++
        continue
      }

      // Skip migrations with no statements (e.g. the initial schema migration
      // that was applied before this tracker existed — listed for visibility
      // in the Settings page but no-op here).
      if (migration.statements.length === 0) {
        await client.execute({
          sql: 'INSERT INTO "__turso_migrations" ("name") VALUES (?)',
          args: [migration.name],
        })
        log.push(`✓ ${migration.name} (marked as applied — no SQL statements to run)`)
        // Count as applied, not skipped, since we did write a row
        applied++
        continue
      }

      log.push(`→ Applying ${migration.name}...`)

      for (const statement of migration.statements) {
        // ALTER TABLE ADD COLUMN — skip if column already exists
        const addedColumn = statement.match(/^ALTER TABLE\s+"([^"]+)"\s+ADD COLUMN\s+"([^"]+)"/i)
        if (addedColumn) {
          const cols = await client.execute(`PRAGMA table_info("${addedColumn[1]}")`)
          if (cols.rows.some((r) => r.name === addedColumn[2])) {
            log.push(`  skip (column exists): ${addedColumn[1]}.${addedColumn[2]}`)
            continue
          }
        }

        // CREATE TABLE — skip if exists
        const createdTable = statement.match(/^CREATE TABLE\s+(?:IF NOT EXISTS\s+)?"([^"]+)"/i)
        if (createdTable) {
          const existing = await client.execute({
            sql: 'SELECT "name" FROM "sqlite_master" WHERE "type" = ? AND "name" = ?',
            args: ["table", createdTable[1]],
          })
          if (existing.rows.length > 0) {
            log.push(`  skip (table exists): ${createdTable[1]}`)
            continue
          }
        }

        // CREATE INDEX — skip if exists
        const createdIndex = statement.match(/^CREATE (?:UNIQUE )?INDEX\s+(?:IF NOT EXISTS\s+)?"([^"]+)"/i)
        if (createdIndex) {
          const existing = await client.execute({
            sql: 'SELECT "name" FROM "sqlite_master" WHERE "type" = ? AND "name" = ?',
            args: ["index", createdIndex[1]],
          })
          if (existing.rows.length > 0) continue
        }

        try {
          await client.execute(statement)
        } catch (e) {
          // If the error is "already exists" or "duplicate column", skip silently
          const msg = e instanceof Error ? e.message : String(e)
          if (msg.includes("already exists") || msg.includes("duplicate column")) {
            log.push(`  skip (already exists): ${statement.slice(0, 60)}...`)
            continue
          }
          throw e
        }
      }

      await client.execute({
        sql: 'INSERT INTO "__turso_migrations" ("name") VALUES (?)',
        args: [migration.name],
      })
      log.push(`  ✓ ${migration.name} applied.`)
      applied++
    }

    // Verify final state
    const finalTables = await client.execute('SELECT "name" FROM "sqlite_master" WHERE "type" = \'table\' ORDER BY "name"')
    log.push(`\nDatabase now has ${finalTables.rows.length} tables.`)

    return NextResponse.json({
      ok: true,
      applied,
      skipped,
      failed,
      log,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    log.push(`\nERROR: ${msg}`)
    return NextResponse.json(
      { ok: false, error: msg, log },
      { status: 500 },
    )
  } finally {
    client.close()
  }
}
