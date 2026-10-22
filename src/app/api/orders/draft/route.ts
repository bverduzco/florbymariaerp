import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { serializeOrder } from "../route"
import { promises as fs } from "fs"
import path from "path"
import os from "os"

export const dynamic = "force-dynamic"
export const maxDuration = 60

/**
 * POST /api/orders/draft
 * Generates a draft Excel workbook containing:
 *   - All orders (Orders tab)
 *   - All customers (Customers tab)
 *   - All line items (Order Line Items tab)
 *   - All stock movements needed for confirmed orders (Stock Movements tab — appended)
 *
 * Returns: { downloadUrl: "/download/...", fileName: "..." }
 *
 * The output is a CSV-bundled .xlsx file generated via openpyxl (Python subprocess).
 * For simplicity in v1.5, we generate a single .xlsx that the user can review,
 * edit, and then promote to be the official ERP version.
 */

interface DraftLineItem {
  orderNumber: string
  customerName: string
  productSku: string
  productName: string
  productSize: string | null
  qty: number
  unitPrice: number
  lineTotal: number
  deliveryDate: string | null
  status: string
}

export async function POST(request: Request) {
  let body: { since?: string }
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  // Pull all orders with line items + customers
  const orders = await db.order.findMany({
    orderBy: [{ createdAt: "asc" }],
    include: { customer: true, lineItems: true },
  })

  const customers = await db.customer.findMany({
    orderBy: [{ createdAt: "asc" }],
  })

  // Build draft line items
  const draftLineItems: DraftLineItem[] = []
  for (const o of orders) {
    for (const li of o.lineItems) {
      draftLineItems.push({
        orderNumber: o.orderNumber,
        customerName: o.customer.name,
        productSku: li.productSku,
        productName: li.productName,
        productSize: li.productSize,
        qty: li.qty,
        unitPrice: li.unitPrice,
        lineTotal: li.unitPrice * li.qty,
        deliveryDate: o.deliveryDate?.toISOString().split("T")[0] ?? "",
        status: o.status,
      })
    }
  }

  // Generate the .xlsx via a Python script (uses openpyxl)
  // We pass the data via a temp JSON file
  const tmpDir = os.tmpdir()
  const tmpJsonPath = path.join(tmpDir, `flor-draft-${Date.now()}.json`)
  const outputPath = path.join(
    "/home/z/my-project/download",
    `ERP Draft ${new Date().toISOString().split("T")[0]}.xlsx`,
  )

  await fs.mkdir(path.dirname(outputPath), { recursive: true })

  const payload = {
    orders: orders.map((o) => serializeOrder(o)),
    customers: customers.map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone ?? "",
      email: c.email ?? "",
      address: c.address ?? "",
      notes: c.notes ?? "",
      createdAt: c.createdAt.toISOString(),
    })),
    draftLineItems,
    generatedAt: new Date().toISOString(),
  }

  await fs.writeFile(tmpJsonPath, JSON.stringify(payload, null, 2))

  // Run the Python generator
  const scriptPath = path.join(process.cwd(), "scripts", "generate_draft.py")
  const { execFile } = await import("child_process")
  const execFileAsync = (cmd: string, args: string[]) =>
    new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
      execFile(cmd, args, { maxBuffer: 1024 * 1024 * 50 }, (err, stdout, stderr) => {
        if (err) reject(err)
        else resolve({ stdout, stderr })
      })
    })

  try {
    const { stdout, stderr } = await execFileAsync("python3", [
      scriptPath,
      tmpJsonPath,
      outputPath,
    ])
    console.log("Draft generator stdout:", stdout)
    if (stderr) console.log("Draft generator stderr:", stderr)

    // Clean up temp JSON
    await fs.unlink(tmpJsonPath).catch(() => {})

    return NextResponse.json({
      success: true,
      fileName: path.basename(outputPath),
      downloadPath: outputPath,
      orderCount: orders.length,
      customerCount: customers.length,
      lineItemCount: draftLineItems.length,
      generatedAt: payload.generatedAt,
    })
  } catch (err) {
    await fs.unlink(tmpJsonPath).catch(() => {})
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      { error: "Failed to generate draft Excel", detail: msg },
      { status: 500 },
    )
  }
}
