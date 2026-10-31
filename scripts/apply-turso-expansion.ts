import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@libsql/client"

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const migrationName = "20261023_expand_erp_schema"

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

async function apply() {
  loadEnvSync()
  const url = process.env.DATABASE_URL
  if (!url || !/^(libsql|https?):\/\//.test(url)) {
    throw new Error("Set DATABASE_URL to the existing Turso/libSQL database before applying this migration.")
  }

  const migrationPath = path.join(projectRoot, "prisma", "turso-migrations", `${migrationName}.sql`)
  if (!existsSync(migrationPath)) throw new Error(`Migration SQL not found: ${migrationPath}`)
  const client = createClient({ url })

  try {
    const tables = await client.execute('SELECT "name" FROM "sqlite_master" WHERE "type" = \'table\'')
    const tableNames = new Set(tables.rows.map((row) => String(row.name)))
    const requiredTables = ["Material", "Product", "Supplier", "RecipeLine", "Customer", "Order", "Event"]
    const missingTables = requiredTables.filter((name) => !tableNames.has(name))
    if (missingTables.length) {
      throw new Error(`This is not the expected populated v1.8 database; missing tables: ${missingTables.join(", ")}`)
    }

    await client.execute(
      'CREATE TABLE IF NOT EXISTS "__turso_migrations" ("name" TEXT PRIMARY KEY NOT NULL, "applied_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)',
    )
    const applied = await client.execute({
      sql: 'SELECT "name" FROM "__turso_migrations" WHERE "name" = ?',
      args: [migrationName],
    })
    if (applied.rows.length) {
      console.log(`Migration ${migrationName} is already applied.`)
      return
    }

    const sql = readFileSync(migrationPath, "utf-8")
    for (const statement of statementsFrom(sql)) {
      const addedColumn = statement.match(/^ALTER TABLE\s+"([^"]+)"\s+ADD COLUMN\s+"([^"]+)"/i)
      if (addedColumn) {
        const columns = await client.execute(`PRAGMA table_info("${addedColumn[1]}")`)
        if (columns.rows.some((row) => row.name === addedColumn[2])) continue
      }

      const createdTable = statement.match(/^CREATE TABLE\s+"([^"]+)"/i)
      if (createdTable) {
        const existing = await client.execute({
          sql: 'SELECT "name" FROM "sqlite_master" WHERE "type" = ? AND "name" = ?',
          args: ["table", createdTable[1]],
        })
        if (existing.rows.length) continue
      }

      const createdIndex = statement.match(/^CREATE (?:UNIQUE )?INDEX\s+"([^"]+)"/i)
      if (createdIndex) {
        const existing = await client.execute({
          sql: 'SELECT "name" FROM "sqlite_master" WHERE "type" = ? AND "name" = ?',
          args: ["index", createdIndex[1]],
        })
        if (existing.rows.length) continue
      }

      await client.execute(statement)
    }

    await client.execute({
      sql: 'INSERT INTO "__turso_migrations" ("name") VALUES (?)',
      args: [migrationName],
    })
    console.log(`Migration ${migrationName} applied successfully.`)
  } finally {
    client.close()
  }
}

apply().catch((error: unknown) => {
  console.error("Turso schema expansion failed:", error)
  process.exitCode = 1
})
