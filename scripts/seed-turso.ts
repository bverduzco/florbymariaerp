// scripts/seed-turso.ts — Turso-compatible seed script for v1.8
//
// v2 fix: load .env.local SYNCHRONOUSLY before importing db.
// In v1, the db module was imported at the top of the file, which caused
// Prisma to initialize with `process.env.DATABASE_URL = undefined` because
// .env.local hadn't been loaded yet.
//
// This version reads .env.local using fs.readFileSync() at the very top
// of the file (before any other imports), so process.env.DATABASE_URL is
// set BEFORE we import the db module.
//
// Run: npx tsx scripts/seed-turso.ts

import { readFileSync, existsSync } from "fs"
import path from "path"

// === Step 1: Load .env.local SYNCHRONOUSLY before any other imports ===
// This must happen before `import { db }` because that import triggers
// Prisma client initialization.
function loadEnvSync() {
  const envPath = path.join(process.cwd(), ".env.local")
  if (!existsSync(envPath)) {
    console.warn("WARN: .env.local not found at", envPath)
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

// === Step 2: NOW it's safe to import db (Prisma will read DATABASE_URL) ===
import { db } from "../src/lib/db"

// === Step 3: Verify DATABASE_URL is set ===
if (!process.env.DATABASE_URL) {
  console.error("ERROR: DATABASE_URL is not set.")
  console.error("")
  console.error("Create a .env.local file at the repo root with:")
  console.error('  DATABASE_URL=libsql://florbymaria-xxxx.turso.io?authToken=eyJ...')
  console.error("")
  console.error("Current process.env.DATABASE_URL:", process.env.DATABASE_URL)
  process.exit(1)
}

console.log("=== Turso seed script ===")
console.log("DATABASE_URL:", process.env.DATABASE_URL.replace(/\?authToken=.*/, "?authToken=***"))
console.log("")

// === Step 4: Load seed.json ===
async function main() {
  const { promises: fs } = await import("fs")

  let seedData: any
  try {
    const raw = await fs.readFile(path.join(process.cwd(), "src/data/seed.json"), "utf-8")
    seedData = JSON.parse(raw)
  } catch (e) {
    console.error("ERROR: Could not read src/data/seed.json")
    console.error(e instanceof Error ? e.message : String(e))
    process.exit(1)
  }

  // === Suppliers ===
  console.log("=== Seeding suppliers ===")
  for (const supplier of seedData.suppliers ?? []) {
    try {
      const existing = await db.supplier.findUnique({ where: { name: supplier.name } })
      if (existing) {
        console.log(`  skipped  ${supplier.name} (already exists)`)
        continue
      }
      await db.supplier.create({
        data: {
          name: supplier.name,
          contactPerson: supplier.contactPerson || null,
          phone: supplier.phone || null,
          email: supplier.email || null,
          leadTimeDays: supplier.leadTimeDays ?? null,
          paymentTerms: supplier.paymentTerms || null,
          notes: supplier.notes || null,
        },
      })
      console.log(`  created  ${supplier.name}`)
    } catch (e) {
      console.error(`  failed   ${supplier.name}:`, e instanceof Error ? e.message : e)
    }
  }

  // === Materials ===
  console.log("")
  console.log("=== Seeding materials ===")
  let matCount = 0
  for (const mat of seedData.materials ?? []) {
    try {
      const existing = await db.material.findUnique({ where: { sku: mat.sku } })
      if (existing) continue
      await db.material.create({
        data: {
          sku: mat.sku,
          name: mat.name,
          category: mat.category,
          unit: mat.unit,
          unitCost: mat.unitCost ?? null,
          supplier: mat.supplier || null,
          currentStockPacks: mat.currentStockPacks ?? null,
          reorderLevelPacks: mat.reorderLevelPacks ?? null,
          reorderQtyPacks: mat.reorderQtyPacks ?? null,
          packPrice: mat.packPrice ?? null,
          unitsPerPack: mat.unitsPerPack ?? null,
          colors: mat.colors || null,
          notes: mat.notes || null,
          substitutes: mat.substitutes || null,
        },
      })
      matCount++
    } catch (e) {
      console.error(`  failed   ${mat.sku}:`, e instanceof Error ? e.message : e)
    }
  }
  console.log(`  created ${matCount} new materials`)

  // === Products ===
  console.log("")
  console.log("=== Seeding products ===")
  let prodCount = 0
  for (const prod of seedData.products ?? []) {
    try {
      const existing = await db.product.findUnique({ where: { sku: prod.sku } })
      if (existing) continue
      await db.product.create({
        data: {
          sku: prod.sku,
          name: prod.name,
          category: prod.category,
          size: prod.size || null,
          flowersCost: prod.flowersCost ?? 0,
          otherMaterialsCost: prod.otherMaterialsCost ?? 0,
          totalCost: prod.totalCost ?? 0,
          suggestedPriceBeforeIva: prod.suggestedPriceBeforeIva ?? 0,
          suggestedPriceWithIva: prod.suggestedPriceWithIva ?? 0,
          actualPriceBeforeIva: prod.actualPriceBeforeIva ?? 0,
          actualPriceWithIva: prod.actualPriceWithIva ?? 0,
          marginPct: prod.marginPct ?? 0,
          linesToReview: prod.linesToReview ?? 0,
          description: prod.description || null,
        },
      })
      prodCount++
    } catch (e) {
      console.error(`  failed   ${prod.sku}:`, e instanceof Error ? e.message : e)
    }
  }
  console.log(`  created ${prodCount} new products`)

  // === Recipe lines ===
  console.log("")
  console.log("=== Seeding recipe lines ===")
  let recipeCount = 0
  for (const recipe of seedData.recipeLines ?? seedData.recipes ?? []) {
    try {
      const product = await db.product.findUnique({ where: { sku: recipe.productSku } })
      if (!product) continue
      const material = await db.material.findUnique({ where: { sku: recipe.componentSku || recipe.materialSku } })
      if (!material) continue
      await db.recipeLine.create({
        data: {
          productId: product.id,
          productSku: product.sku,
          materialId: material.id,
          componentSku: material.sku,
          componentName: recipe.componentName || material.name,
          qty: recipe.qty,
          unit: recipe.unit || material.unit,
          unitCost: recipe.unitCost ?? material.unitCost ?? 0,
          lineCost: (recipe.qty ?? 0) * (recipe.unitCost ?? material.unitCost ?? 0),
          category: recipe.category || material.category,
          color: recipe.color || null,
        },
      })
      recipeCount++
    } catch (e) {
      // ignore individual recipe errors
    }
  }
  console.log(`  created ${recipeCount} recipe lines`)

  // === Final counts ===
  console.log("")
  console.log("=== Final counts in Turso ===")
  const suppliers = await db.supplier.count()
  const materials = await db.material.count()
  const products = await db.product.count()
  const recipes = await db.recipeLine.count()
  console.log(`  Suppliers:   ${suppliers}`)
  console.log(`  Materials:   ${materials}`)
  console.log(`  Products:    ${products}`)
  console.log(`  Recipes:     ${recipes}`)
  console.log("")
  console.log("Seed complete!")

  await db.$disconnect()
}

main().catch((e) => {
  console.error("Seed failed:")
  console.error(e)
  process.exit(1)
})
