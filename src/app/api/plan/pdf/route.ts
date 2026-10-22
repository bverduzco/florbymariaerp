import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { promises as fs } from "fs"
import path from "path"
import os from "os"
import { execFile } from "child_process"
import { promisify } from "util"

const execFileAsync = promisify(execFile)

export const dynamic = "force-dynamic"
export const maxDuration = 60

/**
 * POST /api/plan/pdf
 * Body: same as /api/plan (items array + weekStartDate)
 *
 * Generates the plan response (same as /api/plan), then renders it as a PDF
 * using the shopping list PDF generator. Returns the file path + auto-download.
 */
export async function POST(request: Request) {
  let body: {
    items: { productSku: string; qty: number; deliveryDate?: string | null; customerName?: string | null }[]
    weekStartDate?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  if (!body?.items || !Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: "Items array is required" }, { status: 400 })
  }

  // Validate + normalize items
  const items = body.items
    .filter((i) => i && typeof i.productSku === "string" && typeof i.qty === "number" && i.qty > 0)
    .map((i) => ({
      productSku: i.productSku,
      qty: Math.floor(i.qty),
      deliveryDate: typeof i.deliveryDate === "string" ? i.deliveryDate : null,
      customerName: typeof i.customerName === "string" ? i.customerName : null,
    }))

  if (items.length === 0) {
    return NextResponse.json({ error: "No valid items in plan" }, { status: 400 })
  }

  // Fetch products + recipe lines
  const productSkus = items.map((i) => i.productSku)
  const products = await db.product.findMany({
    where: { sku: { in: productSkus } },
    include: { recipeLines: { include: { material: true } } },
  })
  const productBySku = new Map(products.map((p) => [p.sku, p]))

  // Aggregate shopping list (same logic as /api/plan)
  const shoppingByMaterialSku = new Map<string, any>()
  let totalRevenue = 0
  let totalCost = 0
  let totalBouquets = 0

  for (const item of items) {
    const product = productBySku.get(item.productSku)

    if (!product && item.productSku.startsWith("PRD-CUSTOM-")) {
      const customRecipe = await db.customRecipe.findUnique({
        where: { erpProductSku: item.productSku },
        include: { lines: { include: { customMaterial: true } } },
      })
      if (!customRecipe) { totalBouquets += item.qty; continue }
      totalRevenue += customRecipe.actualPrice * item.qty
      totalBouquets += item.qty

      for (const crl of customRecipe.lines) {
        const erpSku = crl.customMaterial?.erpSku
        if (!erpSku) continue
        const m = await db.material.findUnique({ where: { sku: erpSku } })
        if (!m) continue

        const neededQty = crl.qty * item.qty
        const existing = shoppingByMaterialSku.get(m.sku)
        const productName = `Custom: ${customRecipe.name}`

        if (existing) {
          existing.totalQty += neededQty
          existing.totalCost += neededQty * (m.unitCost ?? 0)
          existing.usedBy.push({ productSku: item.productSku, productName, qty: item.qty, deliveryDate: item.deliveryDate ?? null, customerName: item.customerName ?? null })
        } else {
          const packPrice = m.packPrice
          const unitsPerPack = m.unitsPerPack
          const isPack = m.unit === "pack"
          let packsToBuy = null, packQtyRounded = null, totalPackCost = null, warning = null
          if (isPack) { packsToBuy = neededQty; packQtyRounded = Math.ceil(neededQty); totalPackCost = packQtyRounded * (packPrice ?? 0) }
          else if (unitsPerPack && unitsPerPack > 0) { packsToBuy = neededQty / unitsPerPack; packQtyRounded = Math.ceil(packsToBuy); totalPackCost = packQtyRounded * (packPrice ?? 0) }
          else { warning = "Pack size unknown — confirm with supplier before ordering" }

          shoppingByMaterialSku.set(m.sku, {
            materialSku: m.sku, materialName: m.name, category: m.category, supplier: m.supplier ?? "",
            unit: m.unit, totalQty: neededQty, unitCost: m.unitCost ?? 0, totalCost: neededQty * (m.unitCost ?? 0),
            packPrice: packPrice ?? null, unitsPerPack: unitsPerPack ?? null, packsToBuy, packQtyRounded, totalPackCost,
            usedBy: [{ productSku: item.productSku, productName, qty: item.qty, deliveryDate: item.deliveryDate ?? null, customerName: item.customerName ?? null }],
            warning,
          })
        }
      }
      continue
    }

    if (!product) continue

    totalRevenue += product.actualPriceBeforeIva * item.qty
    totalCost += product.totalCost * item.qty
    totalBouquets += item.qty

    for (const line of product.recipeLines) {
      const m = line.material
      if (!m) continue
      const neededQty = line.qty * item.qty
      const existing = shoppingByMaterialSku.get(m.sku)
      const productName = `${product.name}${product.size ? ` (${product.size})` : ""}`

      if (existing) {
        existing.totalQty += neededQty
        existing.totalCost += neededQty * (m.unitCost ?? 0)
        existing.usedBy.push({ productSku: product.sku, productName, qty: item.qty, deliveryDate: item.deliveryDate ?? null, customerName: item.customerName ?? null })
      } else {
        const packPrice = m.packPrice
        const unitsPerPack = m.unitsPerPack
        const isPack = m.unit === "pack"
        let packsToBuy = null, packQtyRounded = null, totalPackCost = null, warning = null
        if (isPack) { packsToBuy = neededQty; packQtyRounded = Math.ceil(neededQty); totalPackCost = packQtyRounded * (packPrice ?? 0) }
        else if (unitsPerPack && unitsPerPack > 0) { packsToBuy = neededQty / unitsPerPack; packQtyRounded = Math.ceil(packsToBuy); totalPackCost = packQtyRounded * (packPrice ?? 0) }
        else { warning = "Pack size unknown — confirm with supplier before ordering" }

        shoppingByMaterialSku.set(m.sku, {
          materialSku: m.sku, materialName: m.name, category: m.category, supplier: m.supplier ?? "",
          unit: m.unit, totalQty: neededQty, unitCost: m.unitCost ?? 0, totalCost: neededQty * (m.unitCost ?? 0),
          packPrice: packPrice ?? null, unitsPerPack: unitsPerPack ?? null, packsToBuy, packQtyRounded, totalPackCost,
          usedBy: [{ productSku: product.sku, productName, qty: item.qty, deliveryDate: item.deliveryDate ?? null, customerName: item.customerName ?? null }],
          warning,
        })
      }
    }
  }

  const shoppingList = Array.from(shoppingByMaterialSku.values()).sort((a, b) => {
    if (a.supplier !== b.supplier) return a.supplier.localeCompare(b.supplier)
    if (a.category !== b.category) return a.category.localeCompare(b.category)
    return a.materialName.localeCompare(b.materialName)
  })

  const bySupplier: Record<string, { lines: any[]; totalPackCost: number; lineCount: number }> = {}
  for (const line of shoppingList) {
    const supplier = line.supplier || "Unknown"
    if (!bySupplier[supplier]) bySupplier[supplier] = { lines: [], totalPackCost: 0, lineCount: 0 }
    bySupplier[supplier].lines.push(line)
    bySupplier[supplier].lineCount += 1
    bySupplier[supplier].totalPackCost += line.totalPackCost ?? 0
  }

  const payload = {
    weekStartDate: body.weekStartDate ?? null,
    planSummary: {
      totalBouquets, totalRevenue, totalCost,
      estimatedProfit: totalRevenue - totalCost,
      marginPct: totalRevenue > 0 ? ((totalRevenue - totalCost) / totalRevenue) * 100 : 0,
      distinctMaterials: shoppingList.length,
      distinctSuppliers: Object.keys(bySupplier).length,
    },
    shoppingList,
    bySupplier,
  }

  // Write payload to temp JSON + generate PDF via Python
  const tmpDir = os.tmpdir()
  const tmpJsonPath = path.join(tmpDir, `flor-shoplist-${Date.now()}.json`)
  const fileName = `Shopping List ${new Date().toISOString().split("T")[0]}.pdf`
  const outputPath = path.join("/home/z/my-project/download", fileName)

  await fs.mkdir(path.dirname(outputPath), { recursive: true })
  await fs.writeFile(tmpJsonPath, JSON.stringify(payload, null, 2))

  const scriptPath = path.join(process.cwd(), "scripts", "generate_shopping_list_pdf.py")

  try {
    const { stdout, stderr } = await execFileAsync("python3", [scriptPath, tmpJsonPath, outputPath])
    console.log("Shopping list PDF stdout:", stdout)
    if (stderr) console.log("Shopping list PDF stderr:", stderr)
    await fs.unlink(tmpJsonPath).catch(() => {})

    return NextResponse.json({
      success: true,
      fileName,
      downloadPath: outputPath,
      materialCount: shoppingList.length,
      supplierCount: Object.keys(bySupplier).length,
    })
  } catch (err) {
    await fs.unlink(tmpJsonPath).catch(() => {})
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: "Failed to generate PDF", detail: msg }, { status: 500 })
  }
}
