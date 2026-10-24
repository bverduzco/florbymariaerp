// scripts/seed-hardcoded.ts — Turso seed script with HARDCODED DATABASE_URL
//
// This is a fallback for environments where .env.local isn't being read
// correctly (e.g., MINGW64 on Windows with weird path translation).
//
// USAGE:
//   1. Edit this file: replace HARDCODED_DATABASE_URL below with your Turso URL
//   2. Add this file to .gitignore (so your token doesn't get committed)
//   3. Run: npx tsx scripts/seed-hardcoded.ts
//
// To add to .gitignore:
//   echo "scripts/seed-hardcoded.ts" >> .gitignore

// ========================================================================
// ⚠️  EDIT THIS LINE — paste your Turso URL between the backticks
// ========================================================================
const HARDCODED_DATABASE_URL = `libsql://florbymaria-XXXX.turso.io?authToken=PASTE_YOUR_TOKEN_HERE`
// ========================================================================

// Set process.env.DATABASE_URL BEFORE importing the db module.
// The db module (src/lib/db.ts) reads process.env.DATABASE_URL at import time.
process.env.DATABASE_URL = HARDCODED_DATABASE_URL

// === Now safe to import db ===
import { db } from "../src/lib/db"
import { promises as fs } from "fs"
import path from "path"

async function main() {
  console.log("=== Hardcoded Turso seed script ===")
  console.log("DATABASE_URL:", process.env.DATABASE_URL!.replace(/\?authToken=.*/, "?authToken=***"))
  console.log("")

  // Verify the URL has been replaced
  if (HARDCODED_DATABASE_URL.includes("PASTE_YOUR_TOKEN_HERE") || HARDCODED_DATABASE_URL.includes("XXXX")) {
    console.error("ERROR: You haven't edited HARDCODED_DATABASE_URL at the top of this file.")
    console.error("Open scripts/seed-hardcoded.ts and replace the placeholder with your actual Turso URL.")
    process.exit(1)
  }

  // === Load seed.json ===
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
