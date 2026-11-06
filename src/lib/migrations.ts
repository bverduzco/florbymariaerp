// src/lib/migrations.ts — single source of truth for Turso schema migrations.
//
// Both `/api/admin/migrate` (applies pending migrations) and the Settings
// page (displays migration status) import from this file. Keeping the
// list in one place ensures the Settings page can't drift out of sync
// with what the migrator actually knows about.
//
// When you add a new migration:
//   1. Add the SQL file at prisma/turso-migrations/<name>.sql
//   2. Add a matching entry to MIGRATIONS below (with the SQL statements inlined
//      — Vercel serverless doesn't bundle arbitrary files for readFileSync).
//   3. Bump EXPECTED_PRISMA_MODEL_COUNT if you added a new model.
//   4. Commit + push. After Vercel redeploys, visit /api/admin/migrate while
//      logged in to apply the migration to production.

export type Migration = {
  /** Unique migration name (matches the .sql filename without extension). */
  name: string
  /** Short human-readable description shown in the Settings UI. */
  description: string
  /** ISO date the migration was added (for sorting / display). */
  addedAt: string
  /** SQL statements to execute, in order. Each must be a single statement. */
  statements: string[]
}

// Update this whenever you add a new `model X { ... }` to prisma/schema.prisma.
// The Settings page compares it against the live table count to flag drift.
export const EXPECTED_PRISMA_MODEL_COUNT = 43

// All migrations, oldest first. Each is applied once and tracked in the
// __turso_migrations table.
export const MIGRATIONS: Migration[] = [
  {
    name: "20261023_expand_erp_schema",
    description:
      "v1.9 catch-up batch — adds 22 missing models (EventLineItem, StockMovement, SupplierPrice, MaterialAvailability, MaterialSubstitution, ToolsEquipment, MenuItem, WorkbookSetting, WorkbookVersionHistory, RecipeVersion, plus columns on existing tables).",
    addedAt: "2026-10-23",
    statements: [
      // This migration was applied to Turso at commit 6659ad2 (Oct 31) via the
      // standalone scripts/apply-turso-expansion.ts. We list it here so the
      // Settings page can show it as "applied before tracking began" — but we
      // don't include its SQL statements because it's already done everywhere.
      // If a fresh database is ever created, run scripts/apply-turso-schema.ts
      // first (which creates all base tables), then this list handles the
      // delta from there.
    ],
  },
  {
    name: "20261103_add_discount_and_tier3_tables",
    description:
      "Adds Quote.deliveryFee/discount/discountType + Order.discountType columns, and creates the 3 Tier-3 tables (CustomerNote, QuoteReminder, AuditLog) that were added to the schema after the initial Turso setup. Fixed the production 500 errors on /, /calendar, /quotes, /orders, /customers, /events, /shoppinglist.",
    addedAt: "2026-11-03",
    statements: [
      // Quote: 3 new columns
      'ALTER TABLE "Quote" ADD COLUMN "deliveryFee" REAL NOT NULL DEFAULT 100',
      'ALTER TABLE "Quote" ADD COLUMN "discount" REAL NOT NULL DEFAULT 0',
      'ALTER TABLE "Quote" ADD COLUMN "discountType" TEXT NOT NULL DEFAULT \'flat\'',
      // Order: 1 new column
      'ALTER TABLE "Order" ADD COLUMN "discountType" TEXT NOT NULL DEFAULT \'flat\'',

      // CustomerNote
      `CREATE TABLE IF NOT EXISTS "CustomerNote" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "customerId" TEXT NOT NULL,
        "channel" TEXT NOT NULL,
        "direction" TEXT NOT NULL DEFAULT 'outbound',
        "subject" TEXT,
        "body" TEXT NOT NULL,
        "followUpDate" DATETIME,
        "followUpDone" BOOLEAN NOT NULL DEFAULT 0,
        "recordedBy" TEXT NOT NULL DEFAULT 'Maria',
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE
      )`,
      'CREATE INDEX IF NOT EXISTS "CustomerNote_customerId_idx" ON "CustomerNote"("customerId")',
      'CREATE INDEX IF NOT EXISTS "CustomerNote_followUpDate_idx" ON "CustomerNote"("followUpDate")',
      'CREATE INDEX IF NOT EXISTS "CustomerNote_createdAt_idx" ON "CustomerNote"("createdAt")',

      // QuoteReminder
      `CREATE TABLE IF NOT EXISTS "QuoteReminder" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "quoteId" TEXT NOT NULL,
        "remindAt" DATETIME NOT NULL,
        "note" TEXT,
        "done" BOOLEAN NOT NULL DEFAULT 0,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE
      )`,
      'CREATE INDEX IF NOT EXISTS "QuoteReminder_quoteId_idx" ON "QuoteReminder"("quoteId")',
      'CREATE INDEX IF NOT EXISTS "QuoteReminder_remindAt_idx" ON "QuoteReminder"("remindAt")',
      'CREATE INDEX IF NOT EXISTS "QuoteReminder_done_idx" ON "QuoteReminder"("done")',

      // AuditLog
      `CREATE TABLE IF NOT EXISTS "AuditLog" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "entityType" TEXT NOT NULL,
        "entityId" TEXT NOT NULL,
        "action" TEXT NOT NULL,
        "fieldName" TEXT,
        "oldValue" TEXT,
        "newValue" TEXT,
        "changedBy" TEXT NOT NULL DEFAULT 'Maria',
        "changedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      'CREATE INDEX IF NOT EXISTS "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId")',
      'CREATE INDEX IF NOT EXISTS "AuditLog_changedAt_idx" ON "AuditLog"("changedAt")',
    ],
  },
]

/**
 * Status of a single migration, computed by comparing the in-code list
 * against the __turso_migrations table in the live database.
 */
export type MigrationStatus = {
  name: string
  description: string
  addedAt: string
  applied: boolean
  appliedAt: string | null
  /**
   * True if this migration has no SQL statements to run (it's listed for
   * historical context only — e.g. the initial schema that was applied
   * before the tracker existed). Such migrations can never be "pending"
   * in a meaningful sense, since there's nothing to apply.
   */
  informational: boolean
}

/**
 * Result of querying the live database for migration status.
 */
export type MigrationStatusResult = {
  statuses: MigrationStatus[]
  /** True if the __turso_migrations table exists in the database. */
  trackerExists: boolean
  /** Number of tables in the database (excluding internal SQLite tables). */
  liveTableCount: number
}

/**
 * Query the live database for which migrations have been applied.
 *
 * Uses Prisma's $queryRawUnsafe so this works on both Turso (libsql://) and
 * local SQLite (file:). The Prisma client already handles the adapter
 * selection, so we don't deal with @libsql/client directly here.
 *
 * Returns one entry per migration in MIGRATIONS (in declared order), with
 * `applied: true` if the database's __turso_migrations table contains its
 * name, and `appliedAt` set to the timestamp recorded by the migrator.
 *
 * If the __turso_migrations table doesn't exist (e.g. on a fresh database
 * where the migrator has never run, or on local SQLite where we never run
 * the migration script), every migration is reported as `applied: false`.
 *
 * Never throws — on any DB error, returns trackerExists=false and an empty
 * applied list so the Settings page can show "no tracker table" rather
 * than crashing.
 *
 * The `db` parameter accepts the application's Prisma client (from
 * `src/lib/db.ts`). It's typed as a minimal interface so this module
 * doesn't create a circular dependency on `@/lib/db`.
 */
type QueryableDb = {
  // Prisma exposes $queryRawUnsafe(query: string, ...params: unknown[]) for
  // plain-string SQL. We use this instead of $queryRaw (which requires a
  // tagged template literal or Prisma.sql) so the call sites stay simple.
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>
}

export async function getMigrationStatuses(db: QueryableDb): Promise<MigrationStatusResult> {
  let trackerExists = false
  let liveTableCount = 0
  let appliedRows: Array<{ name: string; applied_at: string }> = []

  try {
    // Get all tables in the DB (including sqlite_master entries)
    const tables = await db.$queryRawUnsafe<Array<{ name: string; type: string }>>(
      `SELECT name, type FROM sqlite_master WHERE type IN ('table', 'view')`,
    )
    const tableNames = new Set(tables.map((t) => t.name))
    liveTableCount = tableNames.size
    trackerExists = tableNames.has("__turso_migrations")

    if (trackerExists) {
      appliedRows = await db.$queryRawUnsafe<Array<{ name: string; applied_at: string }>>(
        `SELECT name, applied_at FROM "__turso_migrations"`,
      )
    }
  } catch {
    // Database error (e.g. connection failed, table doesn't exist) — return
    // a graceful "unknown" status instead of crashing the Settings page.
    return {
      statuses: MIGRATIONS.map((m) => ({
        name: m.name,
        description: m.description,
        addedAt: m.addedAt,
        applied: m.statements.length === 0, // informational migrations are "applied" by definition
        appliedAt: null,
        informational: m.statements.length === 0,
      })),
      trackerExists: false,
      liveTableCount: 0,
    }
  }

  const appliedMap = new Map(appliedRows.map((r) => [r.name, r.applied_at]))

  const statuses: MigrationStatus[] = MIGRATIONS.map((m) => {
    const isInformational = m.statements.length === 0
    const appliedAt = appliedMap.get(m.name) ?? null
    return {
      name: m.name,
      description: m.description,
      addedAt: m.addedAt,
      // Informational migrations (no SQL to run) are always "applied" for
      // display purposes — there's nothing to apply.
      applied: isInformational || appliedAt !== null,
      appliedAt,
      informational: isInformational,
    }
  })

  return { statuses, trackerExists, liveTableCount }
}

/**
 * Categorize schema changes that require a Turso migration.
 * Used by the Settings page to explain when Maria needs to update Turso.
 */
export const SCHEMA_CHANGE_REQUIRES_MIGRATION = [
  "Adding a new model (table) to prisma/schema.prisma",
  "Adding a new field (column) to an existing model",
  "Renaming a field or model",
  "Changing a field type in a way that requires a column type conversion",
  "Adding, removing, or changing a @relation, @@index, or @unique constraint",
  "Changing a default value or nullability that needs an ALTER TABLE",
]

/**
 * Schema changes that do NOT require a Turso migration
 * (Prisma client regenerates on `prisma generate`, no DB change needed).
 */
export const SCHEMA_CHANGE_NO_MIGRATION = [
  "Adding or removing a comment in prisma/schema.prisma",
  "Reordering fields within a model",
  "Adding a new client-only helper function in src/lib/",
  "Changing a Prisma client query (findMany, create, update) in a route handler",
]
