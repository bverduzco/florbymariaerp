import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@libsql/client"

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

// All migrations in order. Each migration file lives at
// prisma/turso-migrations/<name>.sql and is applied once (tracked in the
// __turso_migrations table). Re-running this script is safe — already-applied
// migrations are skipped.
const MIGRATIONS = [
  "20261023_expand_erp_schema",
  "20261103_add_discount_and_tier3_tables",
]

function loadEnvSync() {
  const inheritedKeys = new Set(Object.keys(process.env))
  for (const fileName of [".env", ".env.local"]) {
    const envPath = path.join(projectRoot, fileName)
    if (!existsSync(envPath)) continue

    for (const line of readFileSync(envPath, "utf-8").split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#")) continue
      const separator = trimmed.indexOf("=")
      if (separator < 0) continue
      const key = trimmed.slice(0, separator).trim()
      const value = trimmed.slice(separator + 1).trim().replace(/^["']|["']$/g, "")
      if (!inheritedKeys.has(key)) process.env[key] = value
    }
  }
}

function statementsFrom(sql: string): string[] {
  return sql
    .replace(/^\s*--.*$/gm, "")
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean)
}

async function isAlreadyApplied(
  client: ReturnType<typeof createClient>,
  name: string,
): Promise<boolean> {
  const result = await client.execute({
    sql: 'SELECT "name" FROM "__turso_migrations" WHERE "name" = ?',
    args: [name],
  })
  return result.rows.length > 0
}

async function applyMigration(
  client: ReturnType<typeof createClient>,
  migrationName: string,
) {
  const migrationPath = path.join(projectRoot, "prisma", "turso-migrations", `${migrationName}.sql`)
  if (!existsSync(migrationPath)) throw new Error(`Migration SQL not found: ${migrationPath}`)
  const sql = readFileSync(migrationPath, "utf-8")

  for (const statement of statementsFrom(sql)) {
    // ALTER TABLE ADD COLUMN — skip if column already exists
    const addedColumn = statement.match(/^ALTER TABLE\s+"([^"]+)"\s+ADD COLUMN\s+"([^"]+)"/i)
    if (addedColumn) {
      const columns = await client.execute(`PRAGMA table_info("${addedColumn[1]}")`)
      if (columns.rows.some((row) => row.name === addedColumn[2])) {
        console.log(`  skip (column exists): ${addedColumn[1]}.${addedColumn[2]}`)
        continue
      }
    }

    // CREATE TABLE — skip if table already exists
    const createdTable = statement.match(/^CREATE TABLE\s+(?:IF NOT EXISTS\s+)?"([^"]+)"/i)
    if (createdTable) {
      const existing = await client.execute({
        sql: 'SELECT "name" FROM "sqlite_master" WHERE "type" = ? AND "name" = ?',
        args: ["table", createdTable[1]],
      })
      if (existing.rows.length) {
        console.log(`  skip (table exists): ${createdTable[1]}`)
        continue
      }
    }

    // CREATE INDEX — skip if index already exists
    const createdIndex = statement.match(/^CREATE (?:UNIQUE )?INDEX\s+(?:IF NOT EXISTS\s+)?"([^"]+)"/i)
    if (createdIndex) {
      const existing = await client.execute({
        sql: 'SELECT "name" FROM "sqlite_master" WHERE "type" = ? AND "name" = ?',
        args: ["index", createdIndex[1]],
      })
      if (existing.rows.length) {
        console.log(`  skip (index exists): ${createdIndex[1]}`)
        continue
      }
    }

    await client.execute(statement)
  }

  await client.execute({
    sql: 'INSERT INTO "__turso_migrations" ("name") VALUES (?)',
    args: [migrationName],
  })
  console.log(`  ✓ Migration ${migrationName} applied.`)
}

async function apply() {
  loadEnvSync()
  const url = process.env.DATABASE_URL
  if (!url || !/^(libsql|https?):\/\//.test(url)) {
    throw new Error(
      "Set DATABASE_URL to the existing Turso/libSQL database before applying migrations.\n" +
      "  For Turso: libsql://<your-db>.turso.io?authToken=<token>",
    )
  }

  const client = createClient({ url })

  try {
    // Sanity-check that the base v1.8 schema exists
    const tables = await client.execute('SELECT "name" FROM "sqlite_master" WHERE "type" = \'table\'')
    const tableNames = new Set(tables.rows.map((row) => String(row.name)))
    const requiredTables = ["Material", "Product", "Supplier", "RecipeLine", "Customer", "Order", "Event"]
    const missingTables = requiredTables.filter((name) => !tableNames.has(name))
    if (missingTables.length) {
      throw new Error(
        `This is not the expected populated v1.8 database; missing tables: ${missingTables.join(", ")}. ` +
        "Run scripts/apply-turso-schema.ts first to create the base schema.",
      )
    }

    // Ensure the migrations tracker table exists
    await client.execute(
      'CREATE TABLE IF NOT EXISTS "__turso_migrations" ("name" TEXT PRIMARY KEY NOT NULL, "applied_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)',
    )

    console.log(`Applying ${MIGRATIONS.length} Turso migrations to ${url.replace(/\?authToken=.*/, "?authToken=***")}...`)
    let applied = 0
    let skipped = 0
    for (const migrationName of MIGRATIONS) {
      if (await isAlreadyApplied(client, migrationName)) {
        console.log(`  · ${migrationName} (already applied)`)
        skipped++
        continue
      }
      console.log(`  → Applying ${migrationName}...`)
      await applyMigration(client, migrationName)
      applied++
    }

    console.log(`\nDone. ${applied} migration(s) applied, ${skipped} already applied.`)

    // Verify final table count
    const finalTables = await client.execute('SELECT "name" FROM "sqlite_master" WHERE "type" = \'table\' ORDER BY "name"')
    console.log(`\nDatabase now has ${finalTables.rows.length} tables:`)
    for (const row of finalTables.rows) {
      console.log(`  - ${String(row.name)}`)
    }
  } finally {
    client.close()
  }
}

apply().catch((error: unknown) => {
  console.error("Turso migration failed:", error)
  process.exitCode = 1
})
