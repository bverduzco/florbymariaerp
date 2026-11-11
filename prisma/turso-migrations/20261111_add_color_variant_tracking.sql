-- 20261111_add_color_variant_tracking
--
-- v1.9.4: per-line color + variant tracking (Option A2 from the
-- 2026-11-11 design discussion).
--
-- Adds two nullable columns to two tables:
--   - AdHocPurchase.color + AdHocPurchase.variant
--   - ExecutionLogLine.color + ExecutionLogLine.variant
--
-- `color` captures the primary visual axis (rose color, vase color, ribbon
-- color, etc.). `variant` captures the secondary axis (rose variety name
-- like "toffee", eucalyptus species like "gunnii", vase size like "tall",
-- ribbon width like "1 inch"). Both are free-text with autocomplete offered
-- from the material's `colors` field in the UI.
--
-- Existing records are unaffected (new columns are nullable, default null).
-- No data backfill needed — the colors field on Material is informational
-- only and doesn't propagate to historical ad-hoc/execution records.
--
-- These power per-color waste reporting ("pink roses wasted at 70% this
-- month") and per-color demand analysis ("pink dominates February orders").

-- ─── AdHocPurchase ──────────────────────────────────────────────────────────

ALTER TABLE "AdHocPurchase" ADD COLUMN "color" TEXT;
ALTER TABLE "AdHocPurchase" ADD COLUMN "variant" TEXT;

CREATE INDEX IF NOT EXISTS "AdHocPurchase_color_idx" ON "AdHocPurchase"("color");

-- ─── ExecutionLogLine ───────────────────────────────────────────────────────

ALTER TABLE "ExecutionLogLine" ADD COLUMN "color" TEXT;
ALTER TABLE "ExecutionLogLine" ADD COLUMN "variant" TEXT;

CREATE INDEX IF NOT EXISTS "ExecutionLogLine_color_idx" ON "ExecutionLogLine"("color");
