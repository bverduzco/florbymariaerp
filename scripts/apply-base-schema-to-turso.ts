// scripts/apply-base-schema-to-turso.ts
//
// One-off script: applies the full Prisma-generated SQL schema (CREATE TABLE
// statements for all 43 models) to a Turso database. Used to bootstrap the
// fresh florbymaria-sandbox database.
//
// Generates the SQL on-the-fly via `prisma migrate diff` (no need to commit
// a snapshot .sql file — it would drift out of sync with the schema).
//
// Usage:
//   npx tsx scripts/apply-base-schema-to-turso.ts <turso-url-with-token>
//
// Idempotent: uses CREATE TABLE IF NOT EXISTS so re-running is safe (existing
// tables are skipped silently).

import { createClient } from "@libsql/client"
import { execSync } from "node:child_process"
import { writeFileSync, readFileSync, unlinkSync, existsSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

async function main() {
  const url = process.argv[2] ?? process.env.DATABASE_URL
  if (!url || !/^(libsql|https?):\/\//.test(url)) {
    console.error("Usage: npx tsx scripts/apply-base-schema-to-turso.ts <turso-url-with-token>")
    console.error("   Or set DATABASE_URL to the Turso database URL (with authToken).")
    process.exit(1)
  }

  // Step 1: Generate the schema SQL via `prisma migrate diff`
  const tmpSqlPath = join(tmpdir(), `turso-init-${Date.now()}.sql`)
  console.log("Step 1: Generating full Prisma schema SQL via `prisma migrate diff`...")
  try {
    execSync(
      `npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script --output "${tmpSqlPath}"`,
      { stdio: "inherit" },
    )
  } catch (e) {
    console.error("Failed to generate SQL via prisma migrate diff:", e instanceof Error ? e.message : e)
    process.exit(1)
  }

  if (!existsSync(tmpSqlPath)) {
    console.error("prisma migrate diff did not produce a SQL file")
    process.exit(1)
  }

  const sql = readFileSync(tmpSqlPath, "utf8")
  console.log(`  Generated ${sql.length} bytes of SQL`)

  // Step 2: Connect to the Turso database
  console.log(`\nStep 2: Connecting to ${url.replace(/\?authToken=.*/, "?authToken=***")}...`)
  const client = createClient({ url })

  // Step 3: Apply all SQL statements
  // Prisma's migrate diff output format:
  //   -- Comment
  //   CREATE TABLE "Foo" (
  //       "id" TEXT NOT NULL PRIMARY KEY,
  //       "name" TEXT
  //   );
  //   -- Comment
  //   CREATE INDEX "Foo_name_idx" ON "Foo"("name");
  //
  // Statements end with `;` at end of line (e.g. `);` or `INDEX"X");`).
  // We split on the `;` followed by newline, then re-add the `;`.
  // Strip comments (-- ...) before splitting so they don't confuse the parser.
  console.log("\nStep 3: Applying SQL statements...")
  const statements = sql
    .replace(/^\s*--.*$/gm, "") // strip comment lines
    .split(/;\s*\n/)            // split on `;` followed by whitespace+newline
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => s.endsWith(";") ? s : s + ";") // re-add the trailing ; if missing

  let applied = 0
  let skipped = 0
  let failed = 0

  for (const stmt of statements) {
    try {
      await client.execute(stmt)
      applied++
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.includes("already exists")) {
        skipped++
      } else {
        console.error(`  ✗ Failed: ${stmt.slice(0, 80)}...`)
        console.error(`    Error: ${msg}`)
        failed++
      }
    }
  }

  console.log(`\nStep 4: Verification — listing all tables in the database:`)
  const tables = await client.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
  console.log(`  Total tables: ${tables.rows.length}`)
  for (const row of tables.rows) {
    console.log(`    - ${String(row.name)}`)
  }

  console.log(`\nDone. ${applied} applied, ${skipped} skipped (already existed), ${failed} failed.`)

  // Cleanup
  try {
    unlinkSync(tmpSqlPath)
  } catch {}
  client.close()

  if (failed > 0) process.exit(1)
}

main().catch((e) => {
  console.error("Fatal error:", e instanceof Error ? e.message : e)
  process.exit(1)
})
