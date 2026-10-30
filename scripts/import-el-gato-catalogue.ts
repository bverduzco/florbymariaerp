import ExcelJS from "exceljs"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

interface CatalogueRow {
  name: string
  pricePerStem: number
  type: "flower" | "foliage"
  className: string | null
}

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
let disconnectDb: (() => Promise<void>) | undefined

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

function readCatalogueRows(workbook: ExcelJS.Workbook): CatalogueRow[] {
  const sheet = workbook.worksheets[0]
  if (!sheet) {
    throw new Error("The workbook has no worksheets.")
  }

  const headerRow = sheet.getRow(4)
  const headers = headerRow.values as (string | number | undefined)[]
  const normalizedHeaders = headers.map((value) =>
    typeof value === "string" ? value.trim().toLowerCase() : "",
  )
  const nameColumn = normalizedHeaders.indexOf("item")
  const priceColumn = normalizedHeaders.indexOf("price")
  const typeColumn = normalizedHeaders.indexOf("type")
  const classColumn = normalizedHeaders.indexOf("class")

  if ([nameColumn, priceColumn, typeColumn, classColumn].some((column) => column < 0)) {
    throw new Error("Expected item, price, type, and class columns in row 4.")
  }

  const rows: CatalogueRow[] = []
  for (let rowNumber = 5; rowNumber <= sheet.rowCount; rowNumber++) {
    const row = sheet.getRow(rowNumber)
    const nameValue = row.getCell(nameColumn).value
    if (typeof nameValue !== "string" || !nameValue.trim()) continue

    const priceValue = row.getCell(priceColumn).value
    const pricePerStem =
      typeof priceValue === "number"
        ? priceValue
        : typeof priceValue === "string"
          ? Number(priceValue.replace(/[$,\s]/g, ""))
          : Number.NaN
    if (!Number.isFinite(pricePerStem) || pricePerStem < 0) {
      throw new Error(`Invalid per-stem price at row ${rowNumber}.`)
    }

    const typeValue = row.getCell(typeColumn).value
    if (typeValue !== "flower" && typeValue !== "foliage") {
      throw new Error(`Invalid material type at row ${rowNumber}.`)
    }

    const classValue = row.getCell(classColumn).value
    rows.push({
      name: nameValue.trim(),
      pricePerStem,
      type: typeValue,
      className: typeof classValue === "string" && classValue.trim() ? classValue.trim() : null,
    })
  }

  if (rows.length === 0) {
    throw new Error("No priced materials were found in the workbook.")
  }

  const names = new Set<string>()
  for (const row of rows) {
    if (names.has(row.name)) {
      throw new Error(`Duplicate material name in workbook: ${row.name}`)
    }
    names.add(row.name)
  }

  return rows
}

async function main() {
  loadEnvSync()
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be set in the environment, .env, or .env.local.")
  }

  const workbookPath = process.argv[2]
  if (!workbookPath) {
    throw new Error(
      'Provide the El Gato workbook path, for example: npm run db:import:el-gato -- "C:\\path\\to\\catalogue.xlsx"',
    )
  }

  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(workbookPath)
  const catalogueRows = readCatalogueRows(workbook)
  const { db } = await import("../src/lib/db")
  disconnectDb = async () => db.$disconnect()
  const existingMaterials = await db.customMaterial.findMany({
    where: { source: "El Gato" },
  })
  const existingByName = new Map(existingMaterials.map((material) => [material.name, material]))
  let created = 0
  let updated = 0

  for (const row of catalogueRows) {
    const existing = existingByName.get(row.name)
    if (existing) {
      await db.customMaterial.update({
        where: { id: existing.id },
        data: {
          pricePerStem: row.pricePerStem,
          type: row.type,
          class: row.className,
          erpSku: null,
          erpName: null,
          matchScore: null,
          matchConfidence: null,
        },
      })
      updated++
    } else {
      await db.customMaterial.create({
        data: {
          name: row.name,
          pricePerStem: row.pricePerStem,
          type: row.type,
          class: row.className,
          source: "El Gato",
        },
      })
      created++
    }
  }

  const total = await db.customMaterial.count({ where: { source: "El Gato" } })
  console.log(`El Gato catalogue imported: ${created} created, ${updated} updated, ${total} total.`)
}

main()
  .catch((error: unknown) => {
    console.error("El Gato catalogue import failed:", error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(async () => {
    await disconnectDb?.()
  })
