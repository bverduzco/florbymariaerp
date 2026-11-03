import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import ExcelJS from "exceljs"

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

function loadEnvSync() {
  const inheritedKeys = new Set(Object.keys(process.env))
  for (const fileName of [".env", ".env.local"]) {
    const envPath = path.join(projectRoot, fileName)
    if (!existsSync(envPath)) continue

    for (const line of readFileSync(envPath, "utf-8").split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#")) continue
      const separator = trimmed.indexOf("=")
      if (separator < 0) continue
      const key = trimmed.slice(0, separator).trim()
      const value = trimmed.slice(separator + 1).trim().replace(/^["']|["']$/g, "")
      if (!inheritedKeys.has(key)) process.env[key] = value
    }
  }
}

loadEnvSync()

if (!process.env.DATABASE_URL || !/^(libsql|https?):\/\//.test(process.env.DATABASE_URL)) {
  throw new Error("Set DATABASE_URL to the Turso/libSQL URL in .env.local or the process environment.")
}

type CellValue = unknown
type WorkbookRow = {
  number: number
  value: (column: number) => CellValue
}

function unwrap(value: CellValue): CellValue {
  if (value instanceof Date) return value
  if (value && typeof value === "object") {
    const cell = value as { result?: CellValue; text?: string; richText?: { text: string }[] }
    if ("result" in cell) return cell.result
    if (typeof cell.text === "string") return cell.text
    if (Array.isArray(cell.richText)) return cell.richText.map((part) => part.text).join("")
  }
  return value
}

function stringValue(value: CellValue): string | undefined {
  const unwrapped = unwrap(value)
  if (unwrapped === null || unwrapped === undefined) return undefined
  const result = String(unwrapped).trim()
  return result || undefined
}

function numberValue(value: CellValue): number | undefined {
  const unwrapped = unwrap(value)
  if (unwrapped === null || unwrapped === undefined || unwrapped === "") return undefined
  const result =
    typeof unwrapped === "number"
      ? unwrapped
      : Number(String(unwrapped).replace(/[,$\sA-Za-z]/g, ""))
  return Number.isFinite(result) ? result : undefined
}

function dateValue(value: CellValue): Date | undefined {
  const unwrapped = unwrap(value)
  if (unwrapped instanceof Date && !Number.isNaN(unwrapped.getTime())) return unwrapped
  if (typeof unwrapped === "number") {
    const date = new Date(Date.UTC(1899, 11, 30) + unwrapped * 86400000)
    return Number.isNaN(date.getTime()) ? undefined : date
  }
  if (typeof unwrapped === "string" && unwrapped.trim()) {
    const date = new Date(unwrapped)
    return Number.isNaN(date.getTime()) ? undefined : date
  }
  return undefined
}

function sameDate(left: Date, right: Date): boolean {
  return left.toISOString().slice(0, 10) === right.toISOString().slice(0, 10)
}

function nonEmpty(row: WorkbookRow): boolean {
  for (let column = 1; column <= 30; column++) {
    if (stringValue(row.value(column))) return true
  }
  return false
}

function rowOf(row: ExcelJS.Row): WorkbookRow {
  return { number: row.number, value: (column) => row.getCell(column).value }
}

function sourceKey(sheet: string, row: WorkbookRow): string {
  return `${sheet}:${row.number}`
}

async function run() {
  const workbookPath = path.join(projectRoot, "data", "ERP Zai v1.2.xlsx")
  if (!existsSync(workbookPath)) throw new Error(`Workbook not found: ${workbookPath}`)

  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(workbookPath)
  const { db } = await import("../src/lib/db")

  const tableRows = (sheetName: string, headerRow = 4): WorkbookRow[] => {
    const sheet = workbook.getWorksheet(sheetName)
    if (!sheet) throw new Error(`Workbook is missing the "${sheetName}" sheet.`)
    const rows: WorkbookRow[] = []
    for (let index = headerRow + 1; index <= sheet.rowCount; index++) {
      const row = rowOf(sheet.getRow(index))
      if (nonEmpty(row)) rows.push(row)
    }
    return rows
  }

  const suppliers = new Map<string, string>()
  for (const row of tableRows("Suppliers")) {
    const name = stringValue(row.value(1))
    if (!name) continue
    const existing = await db.supplier.findUnique({ where: { name } })
    const data = {
      contactPerson: stringValue(row.value(2)) ?? null,
      phone: stringValue(row.value(3)) ?? null,
      email: stringValue(row.value(4)) ?? null,
      leadTimeDays: numberValue(row.value(5)) ?? null,
      paymentTerms: stringValue(row.value(6)) ?? null,
      notes: stringValue(row.value(7)) ?? null,
    }
    const supplier = existing
      ? await db.supplier.update({
          where: { id: existing.id },
          data: {
            contactPerson: existing.contactPerson ?? data.contactPerson,
            phone: existing.phone ?? data.phone,
            email: existing.email ?? data.email,
            leadTimeDays: existing.leadTimeDays ?? data.leadTimeDays,
            paymentTerms: existing.paymentTerms ?? data.paymentTerms,
            notes: existing.notes ?? data.notes,
          },
        })
      : await db.supplier.create({ data: { name, ...data } })
    suppliers.set(name.toLowerCase(), supplier.id)
  }

  const materials = new Map<string, string>()
  for (const row of tableRows("Materials")) {
    const sku = stringValue(row.value(1))
    const name = stringValue(row.value(2))
    const category = stringValue(row.value(3))
    const unit = stringValue(row.value(4))
    if (!sku || !name || !category || !unit) continue

    const supplierName = stringValue(row.value(6))
    const values = {
      unitCost: numberValue(row.value(5)),
      supplier: supplierName,
      currentStockPacks: numberValue(row.value(7)),
      reorderLevelPacks: numberValue(row.value(8)),
      reorderQtyPacks: numberValue(row.value(9)),
      stockValue: numberValue(row.value(10)),
      status: stringValue(row.value(11)),
      packPrice: numberValue(row.value(12)),
      unitsPerPack: numberValue(row.value(13)),
      colors: stringValue(row.value(14)),
      photoUrl: stringValue(row.value(15)),
      notes: stringValue(row.value(16)),
      materialType: stringValue(row.value(17)),
      preferredSupplier: stringValue(row.value(18)),
    }
    const existing = await db.material.findUnique({ where: { sku } })
    const supplierId = supplierName ? suppliers.get(supplierName.toLowerCase()) : undefined
    const material = existing
      ? await db.material.update({
          where: { id: existing.id },
          data: {
            unitCost: existing.unitCost ?? values.unitCost,
            supplier: existing.supplier ?? values.supplier,
            currentStockPacks: existing.currentStockPacks ?? values.currentStockPacks,
            reorderLevelPacks: existing.reorderLevelPacks ?? values.reorderLevelPacks,
            reorderQtyPacks: existing.reorderQtyPacks ?? values.reorderQtyPacks,
            stockValue: existing.stockValue ?? values.stockValue,
            status: existing.status ?? values.status,
            packPrice: existing.packPrice ?? values.packPrice,
            unitsPerPack: existing.unitsPerPack ?? values.unitsPerPack,
            colors: existing.colors ?? values.colors,
            photoUrl: existing.photoUrl ?? values.photoUrl,
            notes: existing.notes ?? values.notes,
            materialType: existing.materialType ?? values.materialType,
            preferredSupplier: existing.preferredSupplier ?? values.preferredSupplier,
            supplierId: existing.supplierId ?? supplierId,
          },
        })
      : await db.material.create({
          data: {
            sku,
            name,
            category,
            unit,
            ...values,
            supplierId,
          },
        })
    materials.set(sku, material.id)
  }

  const products = new Map<string, string>()
  const productNames = new Map<string, string>()
  for (const row of tableRows("Products")) {
    const sku = stringValue(row.value(1))
    const name = stringValue(row.value(2))
    const category = stringValue(row.value(3))
    if (!sku || !name || !category) continue
    const values = {
      size: stringValue(row.value(4)),
      flowersCost: numberValue(row.value(5)) ?? 0,
      otherMaterialsCost: numberValue(row.value(6)) ?? 0,
      laborMinutes: numberValue(row.value(7)),
      laborCost: numberValue(row.value(8)),
      overheadPerUnit: numberValue(row.value(9)),
      flowersMultiplierCost: numberValue(row.value(11)),
      materialsMultiplierCost: numberValue(row.value(12)),
      laborDesignSurcharge: numberValue(row.value(13)),
      totalCost: numberValue(row.value(10)) ?? 0,
      suggestedPriceBeforeIva: numberValue(row.value(14)) ?? 0,
      suggestedPriceWithIva: numberValue(row.value(15)) ?? 0,
      suggestedPrice4xBeforeIva: numberValue(row.value(16)),
      suggestedPrice4xWithIva: numberValue(row.value(17)),
      actualPriceBeforeIva: numberValue(row.value(18)) ?? 0,
      actualPriceWithIva: numberValue(row.value(19)) ?? 0,
      marginAmount: numberValue(row.value(20)),
      marginPct: numberValue(row.value(21)) ?? 0,
      linesToReview: Math.trunc(numberValue(row.value(22)) ?? 0),
      description: stringValue(row.value(23)),
    }
    const existing = await db.product.findUnique({ where: { sku } })
    const product = existing
      ? await db.product.update({
          where: { id: existing.id },
          data: {
            laborMinutes: existing.laborMinutes ?? values.laborMinutes,
            laborCost: existing.laborCost ?? values.laborCost,
            overheadPerUnit: existing.overheadPerUnit ?? values.overheadPerUnit,
            flowersMultiplierCost: existing.flowersMultiplierCost ?? values.flowersMultiplierCost,
            materialsMultiplierCost: existing.materialsMultiplierCost ?? values.materialsMultiplierCost,
            laborDesignSurcharge: existing.laborDesignSurcharge ?? values.laborDesignSurcharge,
            suggestedPrice4xBeforeIva: existing.suggestedPrice4xBeforeIva ?? values.suggestedPrice4xBeforeIva,
            suggestedPrice4xWithIva: existing.suggestedPrice4xWithIva ?? values.suggestedPrice4xWithIva,
            marginAmount: existing.marginAmount ?? values.marginAmount,
          },
        })
      : await db.product.create({ data: { sku, name, category, ...values } })
    products.set(sku, product.id)
    productNames.set(sku, name)
  }

  for (const row of tableRows("Recipes")) {
    const productSku = stringValue(row.value(1))
    const componentSku = stringValue(row.value(2))
    const componentName = stringValue(row.value(3))
    const qty = numberValue(row.value(4))
    const unit = stringValue(row.value(5))
    if (!productSku || !componentSku || !componentName || qty === undefined || !unit) continue
    const key = sourceKey("Recipes", row)
    const existingByKey = await db.recipeLine.findUnique({ where: { sourceRowKey: key } })
    if (existingByKey) continue
    const productId = products.get(productSku)
    const materialId = materials.get(componentSku)
    if (!productId || !materialId) continue
    const matchingLine = await db.recipeLine.findFirst({
      where: { productSku, componentSku, sourceRowKey: null },
      orderBy: { createdAt: "asc" },
    })
    const metadata = {
      version: stringValue(row.value(12)) ?? null,
      effectiveFrom: dateValue(row.value(13)) ?? null,
      sourceRowKey: key,
    }
    if (matchingLine) {
      await db.recipeLine.update({ where: { id: matchingLine.id }, data: metadata })
    } else {
      await db.recipeLine.create({
        data: {
          productId,
          productSku,
          materialId,
          componentSku,
          componentName,
          qty,
          unit,
          unitCost: numberValue(row.value(6)) ?? 0,
          lineCost: numberValue(row.value(7)) ?? 0,
          category: stringValue(row.value(8)) ?? "other",
          color: stringValue(row.value(9)) ?? null,
          check: stringValue(row.value(10)) ?? null,
          notes: stringValue(row.value(11)) ?? null,
          ...metadata,
        },
      })
    }
  }

  const customers = new Map<string, string>()
  for (const row of tableRows("Customers")) {
    const externalId = stringValue(row.value(1))
    const name = stringValue(row.value(2))
    if (!externalId || !name) continue
    const phone = stringValue(row.value(3)) ?? null
    const email = stringValue(row.value(4)) ?? null
    const address = stringValue(row.value(5)) ?? null
    const notes = stringValue(row.value(6)) ?? null
    const existingByExternalId = await db.customer.findUnique({ where: { externalId } })
    const existing =
      existingByExternalId ??
      (await db.customer.findFirst({ where: { name, phone } }))
    const values = {
      externalId,
      phone,
      email,
      address,
      notes,
      recordedOrderCount: numberValue(row.value(7)),
      recordedOrderRevenue: numberValue(row.value(8)),
      lastOrderAt: dateValue(row.value(9)),
      recordedEventCount: numberValue(row.value(10)),
      recordedEventRevenue: numberValue(row.value(11)),
      lifetimeValue: numberValue(row.value(12)),
    }
    const customer = existing
      ? await db.customer.update({
          where: { id: existing.id },
          data: {
            externalId: existing.externalId ?? externalId,
            phone: existing.phone ?? phone,
            email: existing.email ?? email,
            address: existing.address ?? address,
            notes: existing.notes ?? notes,
            recordedOrderCount: existing.recordedOrderCount ?? values.recordedOrderCount,
            recordedOrderRevenue: existing.recordedOrderRevenue ?? values.recordedOrderRevenue,
            lastOrderAt: existing.lastOrderAt ?? values.lastOrderAt,
            recordedEventCount: existing.recordedEventCount ?? values.recordedEventCount,
            recordedEventRevenue: existing.recordedEventRevenue ?? values.recordedEventRevenue,
            lifetimeValue: existing.lifetimeValue ?? values.lifetimeValue,
          },
        })
      : await db.customer.create({ data: { name, ...values } })
    customers.set(externalId, customer.id)
  }

  const eventRows = tableRows("Events")
  for (const row of eventRows) {
    const sourceEventId = stringValue(row.value(1))
    const name = stringValue(row.value(2))
    if (!sourceEventId || !name) continue
    const customerId = customers.get(stringValue(row.value(3)) ?? "")
    const eventDate = dateValue(row.value(5))
    const values = {
      name,
      customerId: customerId ?? null,
      eventDate: eventDate ?? null,
      clientName: stringValue(row.value(4)) ?? null,
      guests: numberValue(row.value(6)),
      estimatedTotalPrice: numberValue(row.value(7)),
      estimatedTotalCost: numberValue(row.value(8)),
      estimatedProfit: numberValue(row.value(9)),
      depositPaid: numberValue(row.value(10)),
      balanceDue: numberValue(row.value(11)),
      sourceStatus: stringValue(row.value(12)) ?? null,
      deliveryFee: numberValue(row.value(13)),
    }
    const existing = await db.event.findUnique({ where: { sourceEventId } })
    if (existing) continue
    const existingByNumber = await db.event.findUnique({ where: { eventNumber: sourceEventId } })
    if (existingByNumber) {
      if (
        existingByNumber.sourceEventId ||
        existingByNumber.name !== name ||
        (existingByNumber.customerId && customerId && existingByNumber.customerId !== customerId)
      ) {
        throw new Error(`Event ID ${sourceEventId} conflicts with an existing event; workbook import stopped before merging it.`)
      }
      await db.event.update({
        where: { id: existingByNumber.id },
        data: {
          sourceEventId,
          estimatedTotalPrice: existingByNumber.estimatedTotalPrice ?? values.estimatedTotalPrice,
          estimatedTotalCost: existingByNumber.estimatedTotalCost ?? values.estimatedTotalCost,
          estimatedProfit: existingByNumber.estimatedProfit ?? values.estimatedProfit,
          clientName: existingByNumber.clientName ?? values.clientName,
          depositPaid: existingByNumber.depositPaid ?? values.depositPaid,
          balanceDue: existingByNumber.balanceDue ?? values.balanceDue,
          sourceStatus: existingByNumber.sourceStatus ?? values.sourceStatus,
          deliveryFee: existingByNumber.deliveryFee ?? values.deliveryFee,
        },
      })
    } else {
      await db.event.create({
        data: {
          eventNumber: sourceEventId,
          sourceEventId,
          name,
          customerId: values.customerId,
          eventDate: values.eventDate,
          guests: values.guests,
          clientName: values.clientName,
          estimatedTotalPrice: values.estimatedTotalPrice,
          estimatedTotalCost: values.estimatedTotalCost,
          estimatedProfit: values.estimatedProfit,
          depositPaid: values.depositPaid,
          balanceDue: values.balanceDue,
          sourceStatus: values.sourceStatus,
          deliveryFee: values.deliveryFee,
        },
      })
    }
  }

  const eventIds = new Map<string, string>()
  for (const event of await db.event.findMany({ select: { id: true, eventNumber: true, sourceEventId: true } })) {
    eventIds.set(event.eventNumber, event.id)
    if (event.sourceEventId) eventIds.set(event.sourceEventId, event.id)
  }
  for (const row of tableRows("Event Line Items")) {
    const eventId = stringValue(row.value(1))
    const productSku = stringValue(row.value(2))
    const productName = stringValue(row.value(3))
    const qty = numberValue(row.value(4))
    const unitPrice = numberValue(row.value(5))
    if (!eventId || !productSku || !productName || qty === undefined || unitPrice === undefined) continue
    const key = sourceKey("Event Line Items", row)
    if (await db.eventLineItem.findUnique({ where: { sourceRowKey: key } })) continue
    const linkedEventId = eventIds.get(eventId)
    if (!linkedEventId) continue
    await db.eventLineItem.create({
      data: {
        eventId: linkedEventId,
        productSku,
        productName,
        qty: Math.trunc(qty),
        unitPrice,
        lineTotal: numberValue(row.value(6)) ?? null,
        lineCost: numberValue(row.value(7)) ?? null,
        legacyLineKey: stringValue(row.value(8)) ?? null,
        sourceRowKey: key,
      },
    })
  }

  for (const row of tableRows("Orders")) {
    const sourceOrderId = stringValue(row.value(1))
    const customerExternalId = stringValue(row.value(3))
    const productSku = stringValue(row.value(5))
    const qty = numberValue(row.value(6))
    const unitPrice = numberValue(row.value(7))
    if (!sourceOrderId || !customerExternalId || !productSku || qty === undefined || unitPrice === undefined) continue
    let customerId = customers.get(customerExternalId)
    if (!customerId) {
      const customer = await db.customer.findFirst({ where: { externalId: customerExternalId } })
      customerId = customer?.id
    }
    if (!customerId) throw new Error(`Order ${sourceOrderId} refers to missing customer ${customerExternalId}.`)
    const sourceStatus = stringValue(row.value(11))
    const deliveryDate = dateValue(row.value(12))
    const deliveryFee = numberValue(row.value(13))
    const orderDate = dateValue(row.value(2))
    const existingBySourceId = await db.order.findUnique({ where: { sourceOrderId } })
    const existingByNumber = await db.order.findUnique({ where: { orderNumber: sourceOrderId } })
    let order = existingBySourceId
    if (!order && existingByNumber) {
      if (
        (existingByNumber.sourceOrderId && existingByNumber.sourceOrderId !== sourceOrderId) ||
        existingByNumber.customerId !== customerId ||
        (orderDate && !sameDate(orderDate, existingByNumber.createdAt))
      ) {
        throw new Error(`Order ID ${sourceOrderId} conflicts with an existing order; workbook import stopped before merging it.`)
      }
      order = existingByNumber
    }
    if (!order) {
      order = await db.order.create({
        data: {
          orderNumber: sourceOrderId,
          sourceOrderId,
          customerId,
          status: "fulfilled",
          sourceStatus: sourceStatus ?? null,
          deliveryDate: deliveryDate ?? null,
          deliveryFee: deliveryFee ?? 100,
          createdAt: orderDate,
        },
      })
    } else {
      await db.order.update({
        where: { id: order.id },
        data: {
          sourceOrderId: order.sourceOrderId ?? sourceOrderId,
          sourceStatus: order.sourceStatus ?? sourceStatus,
        },
      })
    }
    const key = sourceKey("Orders", row)
    if (await db.orderLineItem.findUnique({ where: { sourceRowKey: key } })) continue
    const lineKey = stringValue(row.value(14))
    const existingLine = await db.orderLineItem.findFirst({
      where: { orderId: order.id, productSku, qty: Math.trunc(qty), unitPrice, sourceRowKey: null },
    })
    if (existingLine) {
      await db.orderLineItem.update({
        where: { id: existingLine.id },
        data: {
          sourceRowKey: key,
          legacyLineKey: lineKey ?? null,
          lineCost: existingLine.lineCost ?? numberValue(row.value(9)),
          profit: existingLine.profit ?? numberValue(row.value(10)),
          lineTotal: existingLine.lineTotal ?? numberValue(row.value(8)),
        },
      })
    } else {
      await db.orderLineItem.create({
        data: {
          orderId: order.id,
          productSku,
          productName: productNames.get(productSku) ?? productSku,
          qty: Math.trunc(qty),
          unitPrice,
          lineTotal: numberValue(row.value(8)) ?? null,
          lineCost: numberValue(row.value(9)) ?? null,
          profit: numberValue(row.value(10)) ?? null,
          legacyLineKey: lineKey ?? null,
          sourceRowKey: key,
        },
      })
    }
  }

  const purchaseOrders = new Map<string, string>()
  const purchaseOrderRows = tableRows("Purchase Orders")
  const purchaseOrderTotals = new Map<string, number>()
  for (const row of purchaseOrderRows) {
    const poNumber = stringValue(row.value(1))
    const lineTotal = numberValue(row.value(8))
    if (poNumber && lineTotal !== undefined) {
      purchaseOrderTotals.set(poNumber, (purchaseOrderTotals.get(poNumber) ?? 0) + lineTotal)
    }
  }
  for (const row of purchaseOrderRows) {
    const poNumber = stringValue(row.value(1))
    const supplier = stringValue(row.value(3))
    if (!poNumber || !supplier) continue
    const values = {
      supplier,
      orderDate: dateValue(row.value(2)),
      expectedDeliveryDate: dateValue(row.value(9)),
      sourceStatus: stringValue(row.value(10)) ?? null,
    }
    const existing = await db.purchaseOrder.findUnique({ where: { poNumber } })
    if (existing && existing.supplier.trim().toLowerCase() !== supplier.trim().toLowerCase()) {
      throw new Error(`Purchase order ${poNumber} has a different supplier in the database; workbook import stopped before merging it.`)
    }
    const po = existing
      ? await db.purchaseOrder.update({
          where: { id: existing.id },
          data: {
            orderDate: existing.orderDate ?? values.orderDate,
            expectedDeliveryDate: existing.expectedDeliveryDate ?? values.expectedDeliveryDate,
            sourceStatus: existing.sourceStatus ?? values.sourceStatus,
            totalCost: existing.totalCost || purchaseOrderTotals.get(poNumber) || 0,
          },
        })
      : await db.purchaseOrder.create({
          data: { poNumber, ...values, totalCost: purchaseOrderTotals.get(poNumber) ?? 0, status: "draft" },
        })
    purchaseOrders.set(poNumber, po.id)
  }
  for (const row of purchaseOrderRows) {
    const poNumber = stringValue(row.value(1))
    const materialSku = stringValue(row.value(4))
    const materialName = stringValue(row.value(5))
    const qtyPacks = numberValue(row.value(6))
    const costPerPack = numberValue(row.value(7))
    const lineTotal = numberValue(row.value(8))
    if (!poNumber || !materialSku || !materialName || qtyPacks === undefined || costPerPack === undefined || lineTotal === undefined) continue
    const poId = purchaseOrders.get(poNumber)
    if (!poId) continue
    const key = sourceKey("Purchase Orders", row)
    if (await db.purchaseOrderLine.findUnique({ where: { sourceRowKey: key } })) continue
    const existingLine = await db.purchaseOrderLine.findFirst({
      where: { poId, materialSku, qtyPacks: Math.trunc(qtyPacks), costPerPack, lineTotal, sourceRowKey: null },
    })
    if (existingLine) {
      await db.purchaseOrderLine.update({
        where: { id: existingLine.id },
        data: {
          sourceRowKey: key,
          legacyLineKey: key,
        },
      })
    } else {
      await db.purchaseOrderLine.create({
        data: {
          poId,
          materialSku,
          materialName,
          qtyPacks: Math.trunc(qtyPacks),
          costPerPack,
          lineTotal,
          legacyLineKey: key,
          sourceRowKey: key,
        },
      })
    }
  }

  for (const row of tableRows("Stock Movements")) {
    const materialSku = stringValue(row.value(2))
    const packs = numberValue(row.value(3))
    if (!materialSku || packs === undefined) continue
    const key = sourceKey("Stock Movements", row)
    if (await db.stockMovement.findUnique({ where: { sourceRowKey: key } })) continue
    await db.stockMovement.create({
      data: {
        materialId: materials.get(materialSku) ?? null,
        materialSku,
        movedAt: dateValue(row.value(1)) ?? null,
        packs,
        reason: stringValue(row.value(4)) ?? "other",
        reference: stringValue(row.value(5)) ?? null,
        notes: stringValue(row.value(6)) ?? null,
        sourceRowKey: key,
      },
    })
  }

  for (const row of tableRows("Supplier Prices")) {
    const materialSku = stringValue(row.value(2))
    const supplierName = stringValue(row.value(3))
    if (!materialSku || !supplierName) continue
    const key = sourceKey("Supplier Prices", row)
    if (await db.supplierPrice.findUnique({ where: { sourceRowKey: key } })) continue
    const latestValue = unwrap(row.value(6))
    await db.supplierPrice.create({
      data: {
        materialId: materials.get(materialSku) ?? null,
        materialSku,
        supplierId: suppliers.get(supplierName.toLowerCase()) ?? null,
        supplierName,
        recordedAt: dateValue(row.value(1)) ?? null,
        packPrice: numberValue(row.value(4)) ?? null,
        unitsPerPack: numberValue(row.value(5)) ?? null,
        isLatest:
          latestValue === true ||
          ["true", "yes", "1"].includes(stringValue(latestValue)?.toLowerCase() ?? ""),
        notes: stringValue(row.value(7)) ?? null,
        sourceRowKey: key,
      },
    })
  }

  for (const row of tableRows("Tools & Equipment")) {
    const sku = stringValue(row.value(1))
    const name = stringValue(row.value(2))
    if (!sku || !name) continue
    const values = {
      name,
      category: stringValue(row.value(3)) ?? null,
      quantity: numberValue(row.value(4)) ?? 0,
      condition: stringValue(row.value(5)) ?? null,
      location: stringValue(row.value(6)) ?? null,
      purchasedAt: dateValue(row.value(7)) ?? null,
      purchasedFrom: stringValue(row.value(8)) ?? null,
      purchaseCost: numberValue(row.value(9)) ?? null,
      lastServicedAt: dateValue(row.value(10)) ?? null,
      notes: stringValue(row.value(11)) ?? null,
    }
    await db.toolsEquipment.upsert({ where: { sku }, create: { sku, ...values }, update: {} })
  }

  for (const row of tableRows("Menu")) {
    const item = stringValue(row.value(1))
    if (!item) continue
    await db.menuItem.upsert({
      where: { item },
      create: {
        item,
        category: stringValue(row.value(2)) ?? null,
        description: stringValue(row.value(3)) ?? null,
        priceBeforeIva: numberValue(row.value(4)) ?? null,
        priceWithIva: numberValue(row.value(5)) ?? null,
      },
      update: {},
    })
  }

  const assumptions = workbook.getWorksheet("Assumptions")
  if (!assumptions) throw new Error('Workbook is missing the "Assumptions" sheet.')
  let section = "General"
  for (let index = 1; index <= assumptions.rowCount; index++) {
    const row = rowOf(assumptions.getRow(index))
    const label = stringValue(row.value(1))
    if (!label || index <= 3) continue
    const value = stringValue(row.value(2))
    const notes = stringValue(row.value(3))
    if (!value && !notes) {
      section = label
      continue
    }
    const key = `Assumptions:${label}`
    const settingValue = value ?? (index >= 24 ? label : null)
    if ([4, 10, 17, 23].includes(index)) {
      section = label
      continue
    }
    await db.workbookSetting.upsert({
      where: { key },
      create: { key, section, value: settingValue, notes: notes ?? null },
      update: {},
    })
  }

  for (const row of tableRows("Version History", 5)) {
    const version = stringValue(row.value(1))
    if (!version) continue
    const key = sourceKey("Version History", row)
    await db.workbookVersionHistory.upsert({
      where: { sourceRowKey: key },
      create: {
        sourceRowKey: key,
        version,
        recordedAt: dateValue(row.value(2)) ?? null,
        author: stringValue(row.value(3)) ?? null,
        summary: stringValue(row.value(4)) ?? null,
        fileName: stringValue(row.value(5)) ?? null,
      },
      update: {},
    })
  }

  for (const row of tableRows("Recipe Versions")) {
    const productSku = stringValue(row.value(1))
    const version = stringValue(row.value(2))
    if (!productSku || !version) continue
    const key = sourceKey("Recipe Versions", row)
    await db.recipeVersion.upsert({
      where: { sourceRowKey: key },
      create: {
        sourceRowKey: key,
        productSku,
        version,
        effectiveFrom: dateValue(row.value(3)) ?? null,
        status: stringValue(row.value(4)) ?? null,
        notes: stringValue(row.value(5)) ?? null,
      },
      update: {},
    })
  }

  const counts = await Promise.all([
    db.supplier.count(),
    db.material.count(),
    db.product.count(),
    db.recipeLine.count(),
    db.customer.count(),
    db.order.count(),
    db.event.count(),
    db.eventLineItem.count(),
    db.purchaseOrder.count(),
    db.purchaseOrderLine.count(),
    db.stockMovement.count(),
    db.supplierPrice.count(),
    db.toolsEquipment.count(),
    db.menuItem.count(),
    db.workbookSetting.count(),
    db.workbookVersionHistory.count(),
    db.recipeVersion.count(),
  ])
  const labels = [
    "Suppliers",
    "Materials",
    "Products",
    "Recipe lines",
    "Customers",
    "Orders",
    "Events",
    "Event line items",
    "Purchase orders",
    "Purchase order lines",
    "Stock movements",
    "Supplier prices",
    "Tools and equipment",
    "Menu items",
    "Workbook settings",
    "Workbook versions",
    "Recipe versions",
  ]
  console.log("ERP workbook import complete (existing operational values were preserved).")
  labels.forEach((label, index) => console.log(`  ${label}: ${counts[index]}`))
  await db.$disconnect()
}

run().catch((error: unknown) => {
  console.error("ERP workbook import failed:", error)
  process.exitCode = 1
})
