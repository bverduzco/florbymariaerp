// scripts/snapshot-turso.ts
//
// Snapshots every table in a Turso database to a JSON file. Used as a
// safety net before destructive operations (e.g., cleaning smoke-test
// rows from prod).
//
// Output: a single JSON file containing all rows from every table,
// organized as { tableName: [{...row}, {...row}, ...] }.
//
// Usage:
//   npx tsx scripts/snapshot-turso.ts <turso-url-with-token> <output-path>
//
// If no output path is provided, defaults to:
//   /home/z/my-project/download/turso-snapshot-YYYY-MM-DD-HHMM.json

import { createClient } from "@libsql/client"
import { writeFileSync, mkdirSync } from "node:fs"
import { join } from "node:path"

async function main() {
  const url = process.argv[2]
  const outputPath = process.argv[3]
  if (!url || !/^(libsql|https?):\/\//.test(url)) {
    console.error("Usage: npx tsx scripts/snapshot-turso.ts <turso-url-with-token> [output-path]")
    process.exit(1)
  }

  // Default output path with timestamp
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")
  const finalPath = outputPath ?? `/home/z/my-project/download/turso-snapshot-${stamp}.json`

  // Ensure download dir exists
  mkdirSync(join(finalPath, ".."), { recursive: true })

  console.log(`Connecting to ${url.replace(/\?authToken=.*/, "?authToken=***")}...`)
  const client = createClient({ url })

  // Get all tables
  const tablesRes = await client.execute(
    `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_turso%' ORDER BY name`,
  )
  const tables = tablesRes.rows.map((r) => String(r.name))
  console.log(`Found ${tables.length} tables to snapshot.`)

  const snapshot: Record<string, unknown[]> = {}
  let totalRows = 0

  for (const table of tables) {
    try {
      const r = await client.execute(`SELECT * FROM "${table}"`)
      // Convert rows to plain objects (libsql rows have a typed wrapper)
      const rows = r.rows.map((row) => {
        const obj: Record<string, unknown> = {}
        for (const col of r.columns) {
          obj[col] = (row as Record<string, unknown>)[col]
        }
        return obj
      })
      snapshot[table] = rows
      totalRows += rows.length
      console.log(`  ${table.padEnd(22)} ${rows.length} row(s)`)
    } catch (e) {
      console.log(`  ${table.padEnd(22)} ✗ error: ${(e instanceof Error ? e.message : String(e)).slice(0, 80)}`)
      snapshot[table] = []
    }
  }

  writeFileSync(finalPath, JSON.stringify({
    snapshot_at: new Date().toISOString(),
    source_url: url.replace(/\?authToken=.*/, "?authToken=***"),
    total_tables: tables.length,
    total_rows: totalRows,
    tables: snapshot,
  }, null, 2))

  console.log(`\n✓ Snapshot saved to ${finalPath}`)
  console.log(`  Total tables: ${tables.length}, total rows: ${totalRows}, file size: ${(JSON.stringify(snapshot).length / 1024).toFixed(1)} KB`)
  client.close()
}

main().catch((e) => {
  console.error("Fatal error:", e instanceof Error ? e.message : e)
  process.exit(1)
})
