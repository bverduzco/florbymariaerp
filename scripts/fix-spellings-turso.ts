// scripts/fix-spellings-turso.ts — Reusable spelling-fix script for Turso (or local SQLite)
//
// PURPOSE:
//   Apply a small set of spelling corrections to Material and CustomMaterial
//   rows in the database. Designed to be run EXPLICITLY, never automatically.
//
// USAGE:
//   # Preview changes (no writes)
//   npx tsx scripts/fix-spellings-turso.ts --dry-run
//
//   # Apply changes (will prompt for confirmation)
//   npx tsx scripts/fix-spellings-turso.ts
//
//   # Skip confirmation prompt (for CI / scripting)
//   npx tsx scripts/fix-spellings-turso.ts --yes
//
//   # Force local SQLite (ignore DATABASE_URL pointing at Turso)
//   DATABASE_URL=file:./db/custom.db npx tsx scripts/fix-spellings-turso.ts
//
// SAFETY:
//   - Idempotent: uses `WHERE name = ?` exact match. Running twice is safe —
//     the second run reports "0 rows updated" for each fix.
//   - Explicit: never run automatically. No build hooks, no Git hooks.
//   - Bounded: only the fixes hardcoded in the FIXES array below are applied.
//     No free-text input, no fuzzy matching.
//   - Visible: prints every row that will change before applying, and prints
//     every row that changed after applying.
//
// ENV:
//   Loads from .env.local first (same convention as seed-turso.ts), then
//   falls back to process.env. DATABASE_URL must be set.
//
// EXIT CODES:
//   0 — success (or dry-run completed)
//   1 — config error (missing DATABASE_URL, etc.)
//   2 — user declined the confirmation prompt
//   3 — DB error during apply

import { readFileSync, existsSync } from "fs"
import path from "path"
import { fileURLToPath } from "url"
import * as readline from "readline"

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

// === Step 1: Parse CLI args ===
const args = process.argv.slice(2)
const DRY_RUN = args.includes("--dry-run") || args.includes("-n")
const SKIP_CONFIRM = args.includes("--yes") || args.includes("-y")

if (DRY_RUN && SKIP_CONFIRM) {
  console.error("ERROR: --dry-run and --yes are mutually exclusive")
  process.exit(1)
}

// === Step 2: Load .env.local synchronously before initializing Prisma ===
function loadEnvSync() {
  const envPath = path.join(projectRoot, ".env.local")
  if (!existsSync(envPath)) {
    console.warn(`WARN: .env.local not found at ${envPath}`)
    console.warn("Falling back to whatever process.env already has.")
    return
  }
  const content = readFileSync(envPath, "utf-8")
  for (const line of content.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eqIdx = trimmed.indexOf("=")
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const value = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "")
    // Only set if not already in process.env (don't override real env vars)
    if (!process.env[key]) {
      process.env[key] = value
    }
  }
}

loadEnvSync()

// === Step 3: Verify DATABASE_URL is set ===
if (!process.env.DATABASE_URL) {
  console.error("ERROR: DATABASE_URL is not set.")
  console.error("")
  console.error("Create a .env.local file at the repo root with:")
  console.error("  DATABASE_URL=libsql://florbymaria-xxxx.turso.io?authToken=eyJ...")
  console.error("")
  console.error("Or for local SQLite:")
  console.error("  DATABASE_URL=file:/home/z/my-project/db/custom.db")
  process.exit(1)
}

// === Step 4: Define the spelling fixes ===
//
// Each entry: { table: 'Material' | 'CustomMaterial', old: string, new: string, reason: string }
//
// IMPORTANT — DO NOT push fixes through this script without first verifying
// they're needed. The list below is intentionally small and specific.
// To add a new fix:
//   1. Verify the current value in the DB (run a SELECT first)
//   2. Add an entry below
//   3. Run `npx tsx scripts/fix-spellings-turso.ts --dry-run` to preview
//   4. Run without --dry-run to apply
//
// CONVENTIONS:
//   - ERP Material table uses ALL CAPS (e.g. "TULIPÁN", "GIPSOFILIA")
//   - CustomMaterial (El Gato) uses Title Case (e.g. "Clavel Blanco")
//   - SKUs are NEVER modified — they are identifiers, not display names

interface Fix {
  table: "Material" | "CustomMaterial"
  old: string
  new: string
  reason: string
}

const FIXES: Fix[] = [
  // === ERP Material table (ALL CAPS convention) ===
  {
    table: "Material",
    old: "TULIPAN",
    new: "TULIPÁN",
    reason: "Missing Spanish accent on 'Tulipán'",
  },
  {
    table: "Material",
    old: "TULIPAN DOBLE PETALO",
    new: "TULIPÁN DOBLE PÉTALO",
    reason: "Missing Spanish accents on 'Tulipán' and 'Pétalo'",
  },

  // === CustomMaterial table (El Gato, Title Case convention) ===
  // IMPORTANT: longer strings MUST come before shorter ones when they share a prefix,
  // so "Baby Bread (gypsophila) Amarillo" is matched before "Baby Bread (gypsophila)".
  {
    table: "CustomMaterial",
    old: "Baby Bread (gypsophila) Amarillo",
    new: "Baby Breath (gypsophila) Amarillo",
    reason: "Typo: 'Bread' should be 'Breath' (Baby's Breath = Gypsophila)",
  },
  {
    table: "CustomMaterial",
    old: "Baby Bread (gypsophila)",
    new: "Baby Breath (gypsophila)",
    reason: "Typo: 'Bread' should be 'Breath' (Baby's Breath = Gypsophila)",
  },
  {
    table: "CustomMaterial",
    old: "Tulipan Amarillo",
    new: "Tulipán Amarillo",
    reason: "Missing accent on 'Tulipán'",
  },
  {
    table: "CustomMaterial",
    old: "Tulipan Naranja",
    new: "Tulipán Naranja",
    reason: "Missing accent on 'Tulipán'",
  },
  {
    table: "CustomMaterial",
    old: "Tulipan rosa",
    new: "Tulipán Rosa",
    reason: "Missing accent + inconsistent capitalization (color should be Title Case)",
  },
  // 'Tulipán Rojo' is already correct — no fix needed
]

// === Step 5: Main logic ===

async function prompt(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      const a = answer.trim().toLowerCase()
      resolve(a === "y" || a === "yes")
    })
  })
}

async function main() {
  const { db } = await import("../src/lib/db")

  // Mask the auth token when printing DATABASE_URL
  const maskedUrl = process.env.DATABASE_URL!.replace(
    /\?authToken=.*/,
    "?authToken=***",
  )

  console.log("=== Spelling fix script (Turso-compatible) ===")
  console.log(`DATABASE_URL: ${maskedUrl}`)
  console.log(`Mode: ${DRY_RUN ? "DRY-RUN (no writes)" : "APPLY (will write to DB)"}`)
  console.log(`Fixes defined: ${FIXES.length}`)
  console.log("")

  // === Phase 1: Preview — query each fix's affected rows ===
  console.log("=== Phase 1: Preview affected rows ===")
  interface PendingChange {
    fix: Fix
    matchingRows: Array<{ id: string; name: string; sku?: string | null }>
  }
  const pending: PendingChange[] = []

  for (const fix of FIXES) {
    let matchingRows: Array<{ id: string; name: string; sku?: string | null }> = []

    if (fix.table === "Material") {
      const rows = await db.material.findMany({
        where: { name: fix.old },
        select: { id: true, name: true, sku: true },
      })
      matchingRows = rows.map((r) => ({ id: r.id, name: r.name, sku: r.sku }))
    } else if (fix.table === "CustomMaterial") {
      const rows = await db.customMaterial.findMany({
        where: { name: fix.old },
        select: { id: true, name: true },
      })
      matchingRows = rows.map((r) => ({ id: r.id, name: r.name }))
    }

    pending.push({ fix, matchingRows })

    if (matchingRows.length === 0) {
      console.log(`  ✓ [skip] "${fix.old}" → "${fix.new}"  (no matches — already fixed)`)
    } else {
      console.log(
        `  ⚠ [will update ${matchingRows.length} row(s)] "${fix.old}" → "${fix.new}"`,
      )
      console.log(`      reason: ${fix.reason}`)
      for (const row of matchingRows) {
        const skuInfo = row.sku ? ` | sku=${row.sku}` : ""
        console.log(`      • id=${row.id}${skuInfo}`)
      }
    }
  }

  const totalChanges = pending.reduce((s, p) => s + p.matchingRows.length, 0)
  console.log("")
  console.log(`Total rows that will be updated: ${totalChanges}`)

  // === Phase 2: Dry-run exit ===
  if (DRY_RUN) {
    console.log("")
    console.log("Dry-run complete. No changes were written.")
    console.log("Re-run without --dry-run to apply these changes.")
    await db.$disconnect()
    process.exit(0)
  }

  // === Phase 3: Confirmation prompt ===
  if (totalChanges === 0) {
    console.log("")
    console.log("✓ Nothing to update — all fixes already applied. Exiting.")
    await db.$disconnect()
    process.exit(0)
  }

  if (!SKIP_CONFIRM) {
    console.log("")
    const confirmed = await prompt(
      `Apply ${totalChanges} update(s) to ${maskedUrl}? Type 'yes' to confirm: `,
    )
    if (!confirmed) {
      console.log("Declined. No changes written.")
      await db.$disconnect()
      process.exit(2)
    }
  }

  // === Phase 4: Apply changes (one transaction per fix) ===
  console.log("")
  console.log("=== Phase 2: Applying changes ===")
  let appliedCount = 0

  for (const { fix, matchingRows } of pending) {
    if (matchingRows.length === 0) continue

    try {
      let updateCount = 0
      if (fix.table === "Material") {
        const result = await db.material.updateMany({
          where: { name: fix.old },
          data: { name: fix.new },
        })
        updateCount = result.count
      } else if (fix.table === "CustomMaterial") {
        const result = await db.customMaterial.updateMany({
          where: { name: fix.old },
          data: { name: fix.new },
        })
        updateCount = result.count
      }

      console.log(
        `  ✓ Updated ${updateCount} row(s) in ${fix.table}: "${fix.old}" → "${fix.new}"`,
      )
      appliedCount += updateCount
    } catch (e) {
      console.error(
        `  ✗ FAILED to update "${fix.old}" → "${fix.new}" in ${fix.table}:`,
      )
      console.error(`    ${e instanceof Error ? e.message : String(e)}`)
      console.error("    Aborting. No further fixes will be applied.")
      await db.$disconnect()
      process.exit(3)
    }
  }

  console.log("")
  console.log(`✓ Done. Applied ${appliedCount} update(s).`)

  // === Phase 5: Verification ===
  console.log("")
  console.log("=== Verification ===")
  for (const fix of FIXES) {
    if (fix.table === "Material") {
      const stillOld = await db.material.count({ where: { name: fix.old } })
      const nowNew = await db.material.count({ where: { name: fix.new } })
      const status =
        stillOld === 0 ? "✓" : `⚠ still ${stillOld} rows with old value`
      console.log(
        `  ${status} Material: "${fix.old}"=${stillOld}, "${fix.new}"=${nowNew}`,
      )
    } else if (fix.table === "CustomMaterial") {
      const stillOld = await db.customMaterial.count({ where: { name: fix.old } })
      const nowNew = await db.customMaterial.count({ where: { name: fix.new } })
      const status =
        stillOld === 0 ? "✓" : `⚠ still ${stillOld} rows with old value`
      console.log(
        `  ${status} CustomMaterial: "${fix.old}"=${stillOld}, "${fix.new}"=${nowNew}`,
      )
    }
  }

  await db.$disconnect()
  process.exit(0)
}

main().catch((e) => {
  console.error("Script failed:")
  console.error(e)
  process.exit(3)
})
