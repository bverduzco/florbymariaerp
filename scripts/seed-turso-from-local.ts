/**
 * Seed a Turso database from the local SQLite database.
 *
 * Usage:
 *   npx tsx scripts/seed-turso-from-local.ts <turso-url> <turso-token>
 *
 * Reads all rows from every table in the local SQLite DB (via Prisma +
 * better-sqlite3 adapter) and inserts them into the Turso database (via
 * @libsql/client). Idempotent: clears Turso tables first (DELETE FROM),
 * then re-inserts.
 *
 * Order matters: parent tables must be inserted before child tables that
 * reference them via FK. The script handles this by iterating tables in
 * dependency order (defined below).
 *
 * Large tables (Material with 179 rows, etc.) are inserted in batches of 50.
 */

import { PrismaClient } from "@prisma/client"
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3"
import { createClient } from "@libsql/client"

// ───────────────────────────────────────────────────────────────────────────
// Tables in dependency order (parents before children)
// ───────────────────────────────────────────────────────────────────────────
const TABLES_IN_ORDER = [
  // Independent reference data
  "Supplier",
  "Material",
  "Product",
  "Customer",
  "Event",
  "Staff",
  "Tool",
  "BlockedDate",
  "CapacityDay",
  "SeasonMarker",
  "LegalTemplate",
  "TemplateVariable",
  "WorkbookSetting",
  "MaterialAvailability",
  "MaterialSubstitution",
  "RibbonProperty",
  "PaperProperty",
  "WikiArticle",

  // Sales pipeline (depends on Customer + Product + Event)
  "Quote",
  "QuoteLine",
  "EventLineItem",
  "Order",
  "OrderLineItem",

  // Recipes (depends on Product + Material)
  "RecipeLine",
  "RecipeVersion",

  // Procurement (depends on Supplier + Material)
  "SupplierPrice",
  "PurchaseOrder",
  "PurchaseOrderLine",
  "AdHocPurchase",
  "StockMovement",
  "StockAdjustment",
  "Loss",
  "ShoppingList",

  // Money (depends on Order + Customer)
  "Payment",
  "Expense",

  // Execution (depends on Order + Event + Material)
  "ExecutionLog",
  "ExecutionLogLine",

  // Custom builder (depends on Product + Material)
  "CustomMaterial",
  "CustomRecipe",
  "CustomRecipeLine",
]

async function main() {
  const tursoUrl = process.argv[2]
  const tursoToken = process.argv[3]

  if (!tursoUrl || !tursoToken) {
    console.error(
      "Usage: npx tsx scripts/seed-turso-from-local.ts <turso-url> <turso-token>"
    )
    process.exit(1)
  }

  // ── Connect to local SQLite via Prisma ──────────────────────
  const localUrl = "file:/home/z/my-project/db/custom.db"
  const localAdapter = new PrismaBetterSqlite3({ url: localUrl })
  const prisma = new PrismaClient({ adapter: localAdapter })

  // ── Connect to Turso via @libsql/client ─────────────────────
  const turso = createClient({ url: tursoUrl, authToken: tursoToken })

  console.log(`Seeding Turso (${tursoUrl}) from local SQLite (${localUrl})`)
  console.log("")

  let totalInserted = 0
  let totalSkipped = 0
  const errors: string[] = []

  for (const table of TABLES_IN_ORDER) {
    try {
      // Read all rows from local
      const rows = await (prisma as unknown as Record<string, { findMany: () => Promise<unknown[]> }>)[
        table.charAt(0).toLowerCase() + table.slice(1)
      ].findMany()

      if (rows.length === 0) {
        console.log(`  ${table}: 0 rows (skipped)`)
        totalSkipped++
        continue
      }

      // Clear existing rows in Turso (idempotent)
      await turso.execute(`DELETE FROM "${table}"`)

      // Insert rows in batches of 50
      const BATCH_SIZE = 50
      let batchInserted = 0
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE)
        for (const row of batch) {
          const insert = buildInsert(table, row as Record<string, unknown>)
          try {
            await turso.execute(insert.sql, insert.args)
            batchInserted++
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e)
            errors.push(`${table}: ${msg.slice(0, 100)}`)
          }
        }
      }

      console.log(`  ${table}: ${batchInserted}/${rows.length} rows inserted`)
      totalInserted += batchInserted
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.log(`  ${table}: ERROR — ${msg.slice(0, 100)}`)
      errors.push(`${table}: ${msg}`)
    }
  }

  console.log("")
  console.log(`=== Summary ===`)
  console.log(`Total inserted: ${totalInserted}`)
  console.log(`Tables skipped (empty): ${totalSkipped}`)
  console.log(`Errors: ${errors.length}`)
  if (errors.length > 0) {
    console.log("\nFirst 10 errors:")
    for (const e of errors.slice(0, 10)) {
      console.log(`  - ${e}`)
    }
  }

  await prisma.$disconnect()
  turso.close()
}

/**
 * Build a parameterized INSERT statement for a row.
 * Handles nulls, booleans (→ 0/1 for SQLite), Dates (→ ISO string).
 */
function buildInsert(table: string, row: Record<string, unknown>): {
  sql: string
  args: unknown[]
} {
  const columns = Object.keys(row)
  const placeholders = columns.map(() => "?").join(", ")
  const args = columns.map((col) => {
    const val = row[col]
    if (val === null || val === undefined) return null
    if (val instanceof Date) return val.toISOString()
    if (typeof val === "boolean") return val ? 1 : 0
    return val
  })
  const quotedCols = columns.map((c) => `"${c}"`).join(", ")
  const sql = `INSERT INTO "${table}" (${quotedCols}) VALUES (${placeholders})`
  return { sql, args }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
