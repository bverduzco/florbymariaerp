/**
 * Apply the Prisma-generated SQL schema to a Turso database.
 *
 * Usage:
 *   TURSO_URL=libsql://... TURSO_TOKEN=... npx tsx scripts/apply-turso-schema.ts
 *
 * Or pass the URL + token inline:
 *   npx tsx scripts/apply-turso-schema.ts <url> <token>
 *
 * Idempotent: uses CREATE TABLE IF NOT EXISTS so re-running is safe.
 */
import { createClient } from "@libsql/client"
import { readFileSync } from "fs"

async function main() {
  const url = process.argv[2] ?? process.env.TURSO_URL
  const token = process.argv[3] ?? process.env.TURSO_TOKEN

  if (!url || !token) {
    console.error(
      "Usage: npx tsx scripts/apply-turso-schema.ts <turso-url> <turso-token>"
    )
    console.error("   Or set TURSO_URL + TURSO_TOKEN env vars.")
    process.exit(1)
  }

  const sqlPath = "/tmp/turso-schema.sql"
  const sql = readFileSync(sqlPath, "utf8")

  console.log(`Applying schema to ${url}...`)
  console.log(`SQL file: ${sqlPath} (${sql.length} bytes)`)

  const client = createClient({ url, authToken: token })

  // libsql/client's `executeMultiple` runs multiple statements in one call.
  // It's the right tool for DDL (CREATE TABLE, CREATE INDEX, etc).
  // Returns nothing per-statement, but throws on the first error.
  try {
    await client.executeMultiple(sql)
    console.log(`✓ All statements executed successfully`)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    // "table already exists" is fine on re-runs — but executeMultiple would
    // have stopped at the first error. Fall back to per-statement execution.
    if (msg.includes("already exists")) {
      console.log(`Some tables already exist — falling back to per-statement execution (skipping existing)...`)
      await applyPerStatement(client, sql)
    } else {
      console.error(`✗ executeMultiple failed: ${msg}`)
      console.log(`Falling back to per-statement execution...`)
      await applyPerStatement(client, sql)
    }
  }

  // Verify by listing tables
  const tables = await client.execute(
    "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
  )
  console.log(`\nTables in database (${tables.rows.length}):`)
  for (const row of tables.rows) {
    console.log(`  - ${(row as unknown as { name: string }).name}`)
  }

  client.close()
}

async function applyPerStatement(client: ReturnType<typeof createClient>, sql: string) {
  // Split on ");\n" (the actual statement terminator in Prisma's diff output)
  // and re-append the ");" so statements are complete.
  const rawStatements = sql.split(");\n")
  const statements = rawStatements
    .map((s, i) => (i < rawStatements.length - 1 ? s + ");" : s)) // re-add the ); except for last
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("--"))

  console.log(`Executing ${statements.length} SQL statements individually...`)

  let success = 0
  let skipped = 0
  let failed = 0
  const errors: string[] = []

  for (const stmt of statements) {
    try {
      await client.execute(stmt)
      success++
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.includes("already exists")) {
        skipped++
      } else {
        failed++
        errors.push(`${stmt.slice(0, 80)}... → ${msg}`)
      }
    }
  }

  console.log(`\nPer-statement results:`)
  console.log(`  Success: ${success}`)
  console.log(`  Skipped (already exists): ${skipped}`)
  console.log(`  Failed:  ${failed}`)
  if (errors.length > 0) {
    console.log("\nErrors:")
    for (const e of errors.slice(0, 10)) {
      console.log(`  - ${e}`)
    }
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
