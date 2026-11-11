-- 20261109_add_execution_workflow_fields
--
-- v1.9.3: Execution workflow improvements
--
-- Supports the four gaps from the 2026-11-09 design session:
--   Gap 1: Ad-hoc-purchase source option in execution dialog
--          → AdHocPurchase.materialSku becomes nullable + new materialName +
--            materialType columns for free-text when no SKU
--   Gap 3: Paid/Unpaid dropdown on execution logs
--          → ExecutionLog.paymentStatus column (paid | unpaid)
--   Gap 4: Per-line costBasis (list / linked-purchase / manual)
--          → ExecutionLogLine.costBasis + linkedAdhocPurchaseId columns
--          → New FK from ExecutionLogLine to AdHocPurchase
--   Plus: time tracking on execution logs
--          → ExecutionLog.startedAt + completedAt + durationMinutes columns
--
-- All new columns are nullable (or have defaults) so existing rows are
-- unaffected. Existing ad-hoc purchases get materialName denormalized from
-- their materialSku via a one-time UPDATE.
--
-- The "source" column on ExecutionLogLine keeps its existing values
-- (inventory | donation | loan) — the new "ad-hoc-purchase" value is added
-- at the application layer only. SQLite doesn't enforce CHECK constraints
-- retroactively on existing rows, so no migration needed for that.

-- ─── AdHocPurchase ──────────────────────────────────────────────────────────

-- Make materialSku nullable. SQLite doesn't support ALTER COLUMN, so we
-- recreate the column with the new nullability by:
--   1. Adding a new nullable column (materialSkuNew)
--   2. Copying data from the old column
--   3. Dropping the old column (SQLite supports DROP COLUMN since 3.35)
--   4. Renaming the new column to the original name
--
-- NOTE: the existing schema has materialSku as a NOT NULL TEXT with a FK to
-- Material(sku). SQLite's ALTER TABLE DROP COLUMN preserves indexes if
-- possible; the FK constraint might be dropped, which is fine — Prisma
-- recreates the FK on the next db push (which we don't run on Turso, but
-- Prisma client doesn't enforce FK at the driver level for libsql anyway).
--
-- To keep this migration simple and reversible, we use the simpler approach:
-- add the new columns (materialName, materialType) as nullable, backfill
-- materialName from Material.name via a JOIN, and leave materialSku as-is.
-- Making materialSku nullable requires recreating the table — too risky for
-- a hot migration. Instead, the Prisma client now treats materialSku as
-- nullable, and new INSERTs can set it to NULL even though the column is
-- formally NOT NULL.
--
-- Wait — that won't work. SQLite enforces NOT NULL on INSERT. So we DO need
-- to recreate the table. Doing it safely:
--   1. Rename AdHocPurchase → AdHocPurchase_old
--   2. CREATE TABLE AdHocPurchase with materialSku nullable + new columns
--   3. INSERT INTO AdHocPurchase SELECT * FROM AdHocPurchase_old (with
--      materialName denormalized from Material.name)
--   4. DROP TABLE AdHocPurchase_old
--
-- This is the standard SQLite migration pattern for column type changes.

-- Step 1: rename existing table
ALTER TABLE "AdHocPurchase" RENAME TO "AdHocPurchase_old";

-- Step 2: create new table with the updated schema
CREATE TABLE "AdHocPurchase" (
  "id"              TEXT PRIMARY KEY NOT NULL,
  "adhocNumber"     TEXT NOT NULL UNIQUE,
  "date"            DATETIME NOT NULL,
  "vendor"          TEXT NOT NULL,
  "materialSku"     TEXT,
  "materialName"    TEXT NOT NULL,
  "materialType"    TEXT,
  "qtyPacks"        REAL NOT NULL,
  "unitCost"        REAL NOT NULL,
  "total"           REAL NOT NULL,
  "ticketNumber"    TEXT,
  "paymentMethod"   TEXT,
  "notes"           TEXT,
  "sourceRowKey"    TEXT UNIQUE,
  "createdAt"       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Step 3: copy data + denormalize materialName from Material.name
INSERT INTO "AdHocPurchase" (
  "id", "adhocNumber", "date", "vendor",
  "materialSku", "materialName", "materialType",
  "qtyPacks", "unitCost", "total",
  "ticketNumber", "paymentMethod", "notes", "sourceRowKey", "createdAt"
)
SELECT
  o."id", o."adhocNumber", o."date", o."vendor",
  o."materialSku",
  COALESCE(m."name", o."materialSku") AS "materialName",
  m."category" AS "materialType",
  o."qtyPacks", o."unitCost", o."total",
  o."ticketNumber", o."paymentMethod", o."notes", o."sourceRowKey", o."createdAt"
FROM "AdHocPurchase_old" o
LEFT JOIN "Material" m ON m."sku" = o."materialSku";

-- Step 4: drop the old table
DROP TABLE "AdHocPurchase_old";

-- Recreate indexes (they were dropped with the old table)
CREATE INDEX IF NOT EXISTS "AdHocPurchase_date_idx" ON "AdHocPurchase"("date");
CREATE INDEX IF NOT EXISTS "AdHocPurchase_vendor_idx" ON "AdHocPurchase"("vendor");
CREATE INDEX IF NOT EXISTS "AdHocPurchase_materialSku_idx" ON "AdHocPurchase"("materialSku");

-- ─── ExecutionLog ───────────────────────────────────────────────────────────

ALTER TABLE "ExecutionLog" ADD COLUMN "paymentStatus" TEXT NOT NULL DEFAULT 'unpaid';
ALTER TABLE "ExecutionLog" ADD COLUMN "startedAt" DATETIME;
ALTER TABLE "ExecutionLog" ADD COLUMN "completedAt" DATETIME;
ALTER TABLE "ExecutionLog" ADD COLUMN "durationMinutes" INTEGER;

CREATE INDEX IF NOT EXISTS "ExecutionLog_paymentStatus_idx" ON "ExecutionLog"("paymentStatus");

-- ─── ExecutionLogLine ───────────────────────────────────────────────────────

ALTER TABLE "ExecutionLogLine" ADD COLUMN "costBasis" TEXT NOT NULL DEFAULT 'list';
ALTER TABLE "ExecutionLogLine" ADD COLUMN "linkedAdhocPurchaseId" TEXT;

CREATE INDEX IF NOT EXISTS "ExecutionLogLine_costBasis_idx" ON "ExecutionLogLine"("costBasis");

-- Note: we do NOT add a FK constraint on linkedAdhocPurchaseId → AdHocPurchase(id)
-- here. Prisma will create it on the next schema push; for Turso, the
-- application layer enforces it. Adding the FK via ALTER TABLE in SQLite
-- requires recreating the table (same pattern as AdHocPurchase above),
-- which is overkill for one nullable column. The Prisma client treats the
-- relation as optional, and the UI only offers valid AdHocPurchase IDs in
-- the dropdown, so referential integrity is maintained at the app layer.
