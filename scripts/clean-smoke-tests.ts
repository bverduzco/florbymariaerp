// scripts/clean-smoke-tests.ts
//
// Cleans "smoke test" rows from a Turso database, leaving only the
// backbone (Materials, Suppliers, Products, RecipeLines, RecipeVersions,
// Tools, SeasonMarkers, BlockedDates, CapacityDays, WorkbookSettings,
// LegalTemplates, TemplateVariables, WikiArticles, CustomMaterials,
// CustomRecipes, CustomRecipeLines, SupplierPrices).
//
// Tables to TRUNCATE:
//   - Customer, CustomerNote
//   - Quote, QuoteLine, QuoteReminder
//   - Order, OrderLineItem
//   - Event, EventLineItem
//   - Payment
//   - Expense
//   - Loss
//   - Staff
//   - PurchaseOrder, PurchaseOrderLine
//   - AdHocPurchase
//   - StockMovement, StockAdjustment
//   - ExecutionLog, ExecutionLogLine
//   - AuditLog
//   - ShoppingList
//
// Usage:
//   npx tsx scripts/clean-smoke-tests.ts <turso-url-with-token>
//
// Idempotent: re-running on an already-clean DB is a no-op (DELETE FROM
// empty table just deletes 0 rows).
//
// !! DESTRUCTIVE — DOES NOT PROMPT. Verify the URL before running. !!

import { createClient } from "@libsql/client"

// Tables to truncate, in dependency order (children first, then parents).
// This matters because some tables have FK constraints — deleting children
// before parents avoids "FOREIGN KEY constraint failed" errors.
const TABLES_TO_TRUNCATE = [
  // Children of Quote
  "QuoteReminder",
  "QuoteLine",
  // Children of Order
  "OrderLineItem",
  // Children of Event
  "EventLineItem",
  // Children of ExecutionLog
  "ExecutionLogLine",
  // Children of PurchaseOrder
  "PurchaseOrderLine",
  // Independent smoke-test tables (no FK constraints that depend on them
  // being deleted first, but they reference backbone tables we're keeping).
  "AuditLog",
  "CustomerNote",
  "StockMovement",
  "StockAdjustment",
  "Loss",
  "Payment",
  "Expense",
  "ExecutionLog",
  "AdHocPurchase",
  "ShoppingList",
  // Quote + Order + Event + Customer (parents of the above; safe to delete
  // now that their children are gone)
  "Quote",
  "Order",
  "Event",
  "Customer",
  // Staff (independent, smoke-test only)
  "Staff",
]

async function main() {
  const url = process.argv[2] ?? process.env.DATABASE_URL
  if (!url || !/^(libsql|https?):\/\//.test(url)) {
    console.error("Usage: npx tsx scripts/clean-smoke-tests.ts <turso-url-with-token>")
    console.error("   Or set DATABASE_URL.")
    process.exit(1)
  }

  console.log(`Cleaning smoke-test rows from ${url.replace(/\?authToken=.*/, "?authToken=***")}...`)
  console.log(`Tables to truncate: ${TABLES_TO_TRUNCATE.length}`)
  console.log("")

  const client = createClient({ url })

  // First: take pre-counts so we can show what's being deleted
  console.log("Pre-truncation row counts:")
  const preCounts: Record<string, number> = {}
  for (const table of TABLES_TO_TRUNCATE) {
    try {
      // Use execute() with a plain string (NOT execute({sql, args: []}))
      // because the libsql client throws "Cannot convert undefined or
      // null to object" when args is an empty array.
      const r = await client.execute(`SELECT COUNT(*) as n FROM "${table}"`)
      preCounts[table] = Number(r.rows[0].n)
      console.log(`  ${table.padEnd(22)} ${preCounts[table]}`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.log(`  ${table.padEnd(22)} (error: ${msg.slice(0, 60)})`)
      preCounts[table] = -1
    }
  }

  // Truncate each table
  console.log("\nTruncating...")
  let totalDeleted = 0
  for (const table of TABLES_TO_TRUNCATE) {
    try {
      await client.execute(`DELETE FROM "${table}"`)
      const deleted = preCounts[table] > 0 ? preCounts[table] : 0
      totalDeleted += deleted
      console.log(`  ${table.padEnd(22)} deleted ${deleted} row(s)`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error(`  ${table.padEnd(22)} ✗ FAILED: ${msg.slice(0, 80)}`)
    }
  }

  // Verify post-counts
  console.log("\nPost-truncation verification (should all be 0):")
  for (const table of TABLES_TO_TRUNCATE) {
    try {
      const r = await client.execute(`SELECT COUNT(*) as n FROM "${table}"`)
      console.log(`  ${table.padEnd(22)} ${Number(r.rows[0].n)}`)
    } catch (e) {
      console.log(`  ${table.padEnd(22)} (table missing or error)`)
    }
  }

  // Show backbone tables that should remain intact
  console.log("\nBackbone tables (should retain their row counts):")
  const backboneTables = [
    "Material", "Supplier", "Product", "RecipeLine", "RecipeVersion",
    "Tool", "SeasonMarker", "BlockedDate", "CapacityDay",
    "WorkbookSetting", "LegalTemplate", "TemplateVariable",
    "WikiArticle", "CustomMaterial", "CustomRecipe", "CustomRecipeLine",
    "SupplierPrice",
  ]
  for (const table of backboneTables) {
    try {
      const r = await client.execute(`SELECT COUNT(*) as n FROM "${table}"`)
      console.log(`  ${table.padEnd(22)} ${Number(r.rows[0].n)}`)
    } catch (e) {
      console.log(`  ${table.padEnd(22)} (error)`)
    }
  }

  console.log(`\nDone. Total rows deleted: ${totalDeleted}`)
  client.close()
}

main().catch((e) => {
  console.error("Fatal error:", e instanceof Error ? e.message : e)
  process.exit(1)
})
