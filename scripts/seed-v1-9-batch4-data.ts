// scripts/seed-v1-9-batch4-data.ts
//
// Seeds demo data for Batch 4 screens:
//   - More purchase orders + their lines (PO-3002 through PO-3007)
//   - Sample losses (LOSS-0001, LOSS-0002)
//   - Execution logs + lines (EXE-0001 to EXE-0003)
//   - Tools & equipment (scissors, vases, etc.)
//   - Recipe versions (v1 for each product)

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

// ─── Purchase Orders (already have PO-3001, add more) ───────────────────
const PURCHASE_ORDERS = [
  {
    poNumber: "PO-3002",
    supplier: "PRO FLOR",
    status: "received",
    totalCost: 632.28,
    notes: "PRO FLOR — floral foam, ribbon, adhesives. 10 items.",
  },
  {
    poNumber: "PO-3003",
    supplier: "LA FINCA",
    status: "received",
    totalCost: 762.00,
    notes: "LA FINCA — flowers + foliage. 10 items.",
  },
  {
    poNumber: "PO-3004",
    supplier: "LA FINCA",
    status: "received",
    totalCost: 583.00,
    notes: "LA FINCA — mini roses, hydrangea, foam bricks.",
  },
  {
    poNumber: "PO-3005",
    supplier: "LA FINCA",
    status: "received",
    totalCost: 403.01,
    notes: "LA FINCA — flowers for bridal fair demo.",
  },
]

const PO_LINES = [
  // PO-3002 lines (PRO FLOR supplies)
  { poNumber: "PO-3002", materialSku: "FLR-ALSTROMELIA", materialName: "ALSTROMELIA", qtyPacks: 1, costPerPack: 35, lineTotal: 35 },
  { poNumber: "PO-3002", materialSku: "FLR-SOLIDAGO", materialName: "SOLIDAGO", qtyPacks: 1, costPerPack: 35, lineTotal: 35 },
  { poNumber: "PO-3002", materialSku: "FLR-MARGARITA", materialName: "MARGARITA", qtyPacks: 1, costPerPack: 60, lineTotal: 60 },
  // PO-3003 lines (LA FINCA flowers)
  { poNumber: "PO-3003", materialSku: "FLR-LILI", materialName: "LILI", qtyPacks: 1, costPerPack: 205, lineTotal: 205 },
  { poNumber: "PO-3003", materialSku: "FLR-ROSA-LARGA", materialName: "ROSA LARGA", qtyPacks: 2, costPerPack: 190, lineTotal: 380 },
  // PO-3004 lines
  { poNumber: "PO-3004", materialSku: "FLR-MINI-ROSA", materialName: "MINI ROSA", qtyPacks: 1, costPerPack: 80, lineTotal: 80 },
  { poNumber: "PO-3004", materialSku: "FLR-GIRASOL-FULL-SUN", materialName: "GIRASOL FULL SUN", qtyPacks: 1, costPerPack: 155, lineTotal: 155 },
  // PO-3005 lines
  { poNumber: "PO-3005", materialSku: "FLR-ALSTROMELIA", materialName: "ALSTROMELIA", qtyPacks: 1, costPerPack: 35, lineTotal: 35 },
  { poNumber: "PO-3005", materialSku: "FOL-RUSCUS-LARGO", materialName: "RUSCUS LARGO", qtyPacks: 2, costPerPack: 46, lineTotal: 92 },
]

// ─── Losses ──────────────────────────────────────────────────────────────
const LOSSES = [
  {
    lossNumber: "LOSS-0001",
    date: new Date("2026-10-20"),
    materialSku: "FLR-ROSA-LARGA",
    qtyLostPacks: 1,
    reason: "spoiled",
    discoveredBy: "Maria",
    costImpact: 190,
    notes: "Discovered roses wilted overnight — cooler was too warm.",
  },
  {
    lossNumber: "LOSS-0002",
    date: new Date("2026-10-22"),
    materialSku: "PKG-OASIS-LADRILLO-STD",
    qtyLostPacks: 2,
    reason: "broken",
    discoveredBy: "Maria",
    costImpact: 32,
    notes: "Dropped 2 foam bricks, cracked and unusable.",
  },
  {
    lossNumber: "LOSS-0003",
    date: new Date("2026-10-28"),
    materialSku: "FLR-LILI",
    qtyLostPacks: 1,
    reason: "expired",
    discoveredBy: "Maria",
    costImpact: 205,
    notes: "Lilies passed their vase life — leftover from EVT-2003 demo.",
  },
]

// ─── Execution Logs ──────────────────────────────────────────────────────
const EXECUTION_LOGS = [
  {
    executionNumber: "EXE-0001",
    eventLineItemKey: "EVT-2001|1",
    executedAt: new Date("2026-11-05"),
    executedBy: "Maria",
    status: "executed",
    estimatedCost: 173.00,
    actualCost: 173.00,
    quotedPrice: 1700.00,
    priceAdjustment: 0,
    marginDollars: 1527.00,
    marginPct: 89.8,
    notes: "Bridal bouquet for EVT-2001 — executed as recipe, no changes.",
  },
  {
    executionNumber: "EXE-0002",
    eventLineItemKey: "EVT-2001|2",
    executedAt: new Date("2026-11-05"),
    executedBy: "Maria",
    status: "executed",
    estimatedCost: 173.00,
    actualCost: 182.00,
    quotedPrice: 1700.00,
    priceAdjustment: 0,
    marginDollars: 1518.00,
    marginPct: 89.3,
    notes: "Bridesmaid bouquet — substituted FLR-AVALANCHE for FLR-ROSA-BLANCA (out of stock).",
  },
  {
    executionNumber: "EXE-0003",
    eventLineItemKey: "EVT-2003|1",
    executedAt: new Date("2026-11-15"),
    executedBy: "Maria",
    status: "executed",
    estimatedCost: 850.00,
    actualCost: 920.00,
    quotedPrice: null,
    priceAdjustment: 0,
    marginDollars: null,
    marginPct: null,
    notes: "Bridal fair demo bouquet — unpaid event. Cost only, no margin.",
  },
]

// ─── Tools & Equipment ───────────────────────────────────────────────────
const TOOLS = [
  {
    sku: "TOOL-TIJERAS-001",
    itemName: "Tijeras profesionales",
    category: "Cutting",
    qty: 2,
    condition: "Good",
    location: "Workshop",
    datePurchased: new Date("2026-09-01"),
    purchasedFrom: "BDF Palacio Floral SA de CV",
    purchaseCost: 450,
    lastServiced: new Date("2026-10-15"),
    notes: "Sharpened in October — replace when blades dull.",
  },
  {
    sku: "TOOL-CUBETA-001",
    itemName: "Cubetas plásticas (para acondicionamiento)",
    category: "Container",
    qty: 8,
    condition: "Good",
    location: "Cooler",
    datePurchased: new Date("2026-08-15"),
    purchasedFrom: "Mercado Estrella",
    purchaseCost: 320,
    lastServiced: null,
    notes: "8 buckets for flower conditioning. Stack when not in use.",
  },
  {
    sku: "TOOL-MESATRABAJO-001",
    itemName: "Mesa de trabajo plegable",
    category: "Hardware",
    qty: 1,
    condition: "Good",
    location: "Workshop",
    datePurchased: new Date("2026-07-01"),
    purchasedFrom: "Home Depot",
    purchaseCost: 1500,
    lastServiced: null,
    notes: "Main assembly table. Foldable for storage.",
  },
  {
    sku: "TOOL-NAVAJA-001",
    itemName: "Navajas florales (set de 3)",
    category: "Cutting",
    qty: 3,
    condition: "Fair",
    location: "Workshop",
    datePurchased: new Date("2026-06-01"),
    purchasedFrom: "PRO Flor",
    purchaseCost: 180,
    lastServiced: null,
    notes: "Need replacement blades soon.",
  },
]

// ─── Recipe Versions (one v1 per product) ───────────────────────────────
const RECIPE_VERSIONS = [
  { productSku: "PRD-PEACHY-L", version: "v1", effectiveFrom: new Date("2026-10-01"), status: "active", notes: "Original recipe — seeded by Z.ai from Floristry_ERP updated b.xlsx." },
  { productSku: "PRD-PEACHY-M", version: "v1", effectiveFrom: new Date("2026-10-01"), status: "active", notes: "Original recipe — seeded by Z.ai." },
  { productSku: "PRD-PEACHY-S", version: "v1", effectiveFrom: new Date("2026-10-01"), status: "active", notes: "Original recipe — seeded by Z.ai." },
  { productSku: "PRD-OTOÑO-L", version: "v1", effectiveFrom: new Date("2026-10-01"), status: "active", notes: "Original recipe — seeded by Z.ai." },
]

async function main() {
  console.log("Seeding Batch 4 demo data...")

  // ─── Purchase Orders + Lines ────────────────────────────────────────
  console.log("\n[1] Purchase Orders + Lines...")
  for (const po of PURCHASE_ORDERS) {
    const result = await prisma.purchaseOrder.upsert({
      where: { poNumber: po.poNumber },
      update: po,
      create: po,
    })
    console.log(`  ✓ ${result.poNumber} (${result.supplier}) — $${result.totalCost} (${result.status})`)
  }
  for (const line of PO_LINES) {
    const po = await prisma.purchaseOrder.findUnique({ where: { poNumber: line.poNumber } })
    if (!po) continue
    await prisma.purchaseOrderLine.upsert({
      where: { id: `${po.id}-${line.materialSku}` },
      update: {
        materialName: line.materialName,
        qtyPacks: line.qtyPacks,
        costPerPack: line.costPerPack,
        lineTotal: line.lineTotal,
      },
      create: {
        poId: po.id,
        materialSku: line.materialSku,
        materialName: line.materialName,
        qtyPacks: line.qtyPacks,
        costPerPack: line.costPerPack,
        lineTotal: line.lineTotal,
      },
    })
  }
  console.log(`    ↳ ${PO_LINES.length} line items seeded`)

  // ─── Losses ────────────────────────────────────────────────────────
  console.log("\n[2] Losses...")
  for (const l of LOSSES) {
    const result = await prisma.loss.upsert({
      where: { lossNumber: l.lossNumber },
      update: l,
      create: l,
    })
    console.log(`  ✓ ${result.lossNumber} — ${result.qtyLostPacks} pack(s) of ${result.materialSku} (${result.reason}) — $${result.costImpact}`)
  }

  // ─── Execution Logs ─────────────────────────────────────────────────
  console.log("\n[3] Execution Logs...")
  for (const el of EXECUTION_LOGS) {
    const result = await prisma.executionLog.upsert({
      where: { executionNumber: el.executionNumber },
      update: el,
      create: el,
    })
    const eventType = el.quotedPrice ? "paid" : "unpaid demo"
    console.log(`  ✓ ${result.executionNumber} (${eventType}) — actual cost $${result.actualCost}`)
  }

  // ─── Tools ──────────────────────────────────────────────────────────
  console.log("\n[4] Tools & Equipment...")
  for (const t of TOOLS) {
    const result = await prisma.tool.upsert({
      where: { sku: t.sku },
      update: t,
      create: t,
    })
    console.log(`  ✓ ${result.sku} (${result.category}) — ${result.itemName} ×${result.qty}`)
  }

  // ─── Recipe Versions ───────────────────────────────────────────────
  console.log("\n[5] Recipe Versions...")
  for (const rv of RECIPE_VERSIONS) {
    const product = await prisma.product.findUnique({ where: { sku: rv.productSku } })
    if (!product) continue
    const result = await prisma.recipeVersion.upsert({
      where: { productId_version: { productId: product.id, version: rv.version } },
      update: rv,
      create: { ...rv, productId: product.id },
    })
    console.log(`  ✓ ${rv.productSku} v${rv.version} — ${rv.status}`)
  }

  console.log("\n✅ Batch 4 demo data seeded.")
  console.log("\nSummary:")
  console.log(`  PurchaseOrders:    ${await prisma.purchaseOrder.count()}`)
  console.log(`  PurchaseOrderLines: ${await prisma.purchaseOrderLine.count()}`)
  console.log(`  Losses:            ${await prisma.loss.count()}`)
  console.log(`  ExecutionLogs:     ${await prisma.executionLog.count()}`)
  console.log(`  Tools:             ${await prisma.tool.count()}`)
  console.log(`  RecipeVersions:    ${await prisma.recipeVersion.count()}`)
}

main()
  .catch((e) => {
    console.error("Seed failed:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
