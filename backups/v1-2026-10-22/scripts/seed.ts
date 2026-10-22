/**
 * Seed the floristry database from src/data/seed.json.
 * Idempotent: clears all tables before re-inserting.
 *
 * Run:  bun run scripts/seed.ts
 */
import { db } from "../src/lib/db"
import seedData from "../src/data/seed.json"

type SeedSupplier = {
  name: string
  contactPerson: string
  phone: string
  email: string
  leadTimeDays: number | null
  paymentTerms: string
  notes: string
}

type SeedMaterial = {
  sku: string
  name: string
  category: string
  unit: string
  unitCost: number | null
  supplier: string
  currentStockPacks: number | null
  reorderLevelPacks: number | null
  reorderQtyPacks: number | null
  packPrice: number | null
  unitsPerPack: number | null
  colors: string
  notes: string
}

type SeedRecipeLine = {
  productSku: string
  componentSku: string
  componentName: string
  qty: number
  unit: string
  unitCost: number
  lineCost: number
  category: string
  color: string
  check: string
  notes: string
}

type SeedProduct = {
  sku: string
  name: string
  category: string
  size: string
  flowersCost: number
  otherMaterialsCost: number
  totalCost: number
  suggestedPriceBeforeIva: number
  suggestedPriceWithIva: number
  actualPriceBeforeIva: number
  actualPriceWithIva: number
  marginPct: number
  linesToReview: number
  description: string
}

type Seed = {
  suppliers: SeedSupplier[]
  materials: SeedMaterial[]
  recipes: SeedRecipeLine[]
  products: SeedProduct[]
}

async function main() {
  const data = seedData as Seed

  console.log("Clearing existing data…")
  await db.recipeLine.deleteMany()
  await db.product.deleteMany()
  await db.material.deleteMany()
  await db.supplier.deleteMany()

  // 1. Suppliers
  console.log(`Inserting ${data.suppliers.length} suppliers…`)
  const supplierIdByName: Record<string, string> = {}
  for (const s of data.suppliers) {
    const created = await db.supplier.create({
      data: {
        name: s.name,
        contactPerson: s.contactPerson || null,
        phone: s.phone || null,
        email: s.email || null,
        leadTimeDays: s.leadTimeDays ?? null,
        paymentTerms: s.paymentTerms || null,
        notes: s.notes || null,
      },
    })
    supplierIdByName[s.name] = created.id
  }

  // 2. Materials
  console.log(`Inserting ${data.materials.length} materials…`)
  const materialIdBySku: Record<string, string> = {}
  for (const m of data.materials) {
    const supplierId = m.supplier ? supplierIdByName[m.supplier] : null
    const created = await db.material.create({
      data: {
        sku: m.sku,
        name: m.name,
        category: m.category,
        unit: m.unit,
        unitCost: m.unitCost ?? null,
        supplier: m.supplier || null,
        supplierId: supplierId ?? null,
        currentStockPacks: m.currentStockPacks ?? null,
        reorderLevelPacks: m.reorderLevelPacks ?? null,
        reorderQtyPacks: m.reorderQtyPacks ?? null,
        packPrice: m.packPrice ?? null,
        unitsPerPack: m.unitsPerPack ?? null,
        colors: m.colors || null,
        notes: m.notes || null,
      },
    })
    materialIdBySku[m.sku] = created.id
  }

  // 3. Products
  console.log(`Inserting ${data.products.length} products…`)
  const productIdBySku: Record<string, string> = {}
  for (const p of data.products) {
    const created = await db.product.create({
      data: {
        sku: p.sku,
        name: p.name,
        category: p.category,
        size: p.size || null,
        flowersCost: p.flowersCost,
        otherMaterialsCost: p.otherMaterialsCost,
        totalCost: p.totalCost,
        suggestedPriceBeforeIva: p.suggestedPriceBeforeIva,
        suggestedPriceWithIva: p.suggestedPriceWithIva,
        actualPriceBeforeIva: p.actualPriceBeforeIva,
        actualPriceWithIva: p.actualPriceWithIva,
        marginPct: p.marginPct,
        linesToReview: p.linesToReview,
        description: p.description || null,
      },
    })
    productIdBySku[p.sku] = created.id
  }

  // 4. Recipe lines
  console.log(`Inserting ${data.recipes.length} recipe lines…`)
  for (const r of data.recipes) {
    const productId = productIdBySku[r.productSku]
    const materialId = materialIdBySku[r.componentSku]
    if (!productId) {
      console.warn(`  ! Skipping recipe line: product ${r.productSku} not found`)
      continue
    }
    if (!materialId) {
      console.warn(`  ! Skipping recipe line: material ${r.componentSku} not found`)
      continue
    }
    await db.recipeLine.create({
      data: {
        productSku: r.productSku,
        productId,
        componentSku: r.componentSku,
        materialId,
        componentName: r.componentName,
        qty: r.qty,
        unit: r.unit,
        unitCost: r.unitCost,
        lineCost: r.lineCost,
        category: r.category,
        color: r.color || null,
        check: r.check || null,
        notes: r.notes || null,
      },
    })
  }

  console.log("\nSeed complete.")
  console.log(`  Suppliers:  ${data.suppliers.length}`)
  console.log(`  Materials:  ${data.materials.length}`)
  console.log(`  Products:   ${data.products.length}`)
  console.log(`  Recipes:    ${data.recipes.length} lines`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
