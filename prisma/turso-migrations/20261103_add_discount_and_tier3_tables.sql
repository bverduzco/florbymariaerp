-- Migration: 20261103_add_discount_and_tier3_tables
--
-- Adds the schema changes that were committed AFTER the initial Turso schema
-- was applied at commit 6659ad2 (Oct 31, 2026). At that point Turso was set
-- up with 40 tables. The current schema has 43 models. The missing pieces
-- are the 3 Tier-3 tables (CustomerNote, QuoteReminder, AuditLog) plus the
-- new discount/deliveryFee columns added to Quote and Order in commits
-- b2e12ff (delivery fee) and 73ee2f3 (per-quote discount).
--
-- Without this migration, every page that touches Customer or Quote returns
-- HTTP 500 on the deployed Vercel build, because Prisma tries to SELECT
-- columns / JOIN tables that don't exist in the database.
--
-- Idempotent: uses IF NOT EXISTS / PRAGMA column check (handled by the
-- apply script) so re-running is safe.

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Add missing columns to existing tables
-- ────────────────────────────────────────────────────────────────────────────

-- Quote: 3 new columns (deliveryFee, discount, discountType)
ALTER TABLE "Quote" ADD COLUMN "deliveryFee" REAL NOT NULL DEFAULT 100;
ALTER TABLE "Quote" ADD COLUMN "discount" REAL NOT NULL DEFAULT 0;
ALTER TABLE "Quote" ADD COLUMN "discountType" TEXT NOT NULL DEFAULT 'flat';

-- Order: 1 new column (discountType)
ALTER TABLE "Order" ADD COLUMN "discountType" TEXT NOT NULL DEFAULT 'flat';

-- ────────────────────────────────────────────────────────────────────────────
-- 2. Create the 3 Tier-3 tables that don't exist yet
-- ────────────────────────────────────────────────────────────────────────────

-- CustomerNote — v1.9 Tier 3: customer communication log
CREATE TABLE IF NOT EXISTS "CustomerNote" (
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
);
CREATE INDEX IF NOT EXISTS "CustomerNote_customerId_idx" ON "CustomerNote"("customerId");
CREATE INDEX IF NOT EXISTS "CustomerNote_followUpDate_idx" ON "CustomerNote"("followUpDate");
CREATE INDEX IF NOT EXISTS "CustomerNote_createdAt_idx" ON "CustomerNote"("createdAt");

-- QuoteReminder — v1.9 Tier 3: quote follow-up reminders
CREATE TABLE IF NOT EXISTS "QuoteReminder" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "quoteId" TEXT NOT NULL,
  "remindAt" DATETIME NOT NULL,
  "note" TEXT,
  "done" BOOLEAN NOT NULL DEFAULT 0,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "QuoteReminder_quoteId_idx" ON "QuoteReminder"("quoteId");
CREATE INDEX IF NOT EXISTS "QuoteReminder_remindAt_idx" ON "QuoteReminder"("remindAt");
CREATE INDEX IF NOT EXISTS "QuoteReminder_done_idx" ON "QuoteReminder"("done");

-- AuditLog — v1.9 Tier 3: audit trail of entity changes
CREATE TABLE IF NOT EXISTS "AuditLog" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "fieldName" TEXT,
  "oldValue" TEXT,
  "newValue" TEXT,
  "changedBy" TEXT NOT NULL DEFAULT 'Maria',
  "changedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");
CREATE INDEX IF NOT EXISTS "AuditLog_changedAt_idx" ON "AuditLog"("changedAt");
