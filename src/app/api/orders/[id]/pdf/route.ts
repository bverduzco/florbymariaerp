/**
 * GET /api/orders/[id]/pdf
 * Generates a customer-facing PDF recibo (receipt) for the order.
 *
 * Output: PDF file (downloadable) saved to /home/z/my-project/download/
 * Returns: { downloadUrl, fileName }
 *
 * The PDF includes:
 *   - Flor by Maria logo (text-based since we don't have an image asset)
 *   - Business info (name, address placeholder, phone, email)
 *   - Para: customer name + delivery address
 *   - Recibo # = order number
 *   - Fecha de emisión: order creation date
 *   - Fecha de entrega: from order
 *   - Line items table: product, qty, unit price, line total
 *   - Subtotal, IVA (16%), Envío, Descuento, Total
 *   - Mensaje de tarjeta (if any)
 *   - Instrucciones de pago (cash/SPEI/online based on method)
 *   - Footer: thank-you note (in Spanish)
 */

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

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params

  const order = await db.order.findUnique({
    where: { id },
    include: { customer: true, lineItems: true },
  })
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 })
  }

  // Build the order payload for the Python PDF generator
  const subtotal = order.lineItems.reduce((s, li) => s + li.unitPrice * li.qty, 0)
  const iva = subtotal * 0.16
  const total = subtotal + iva + order.deliveryFee - order.discount

  const payload = {
    orderNumber: order.orderNumber,
    createdAt: order.createdAt.toISOString(),
    deliveryDate: order.deliveryDate?.toISOString().split("T")[0] ?? null,
    status: order.status,
    customer: {
      name: order.customer.name,
      phone: order.customer.phone ?? "",
      email: order.customer.email ?? "",
      address: order.deliveryAddress ?? order.customer.address ?? "",
    },
    deliveryAddress: order.deliveryAddress ?? order.customer.address ?? "",
    cardMessage: order.cardMessage,
    deliveryNotes: order.deliveryNotes,
    lineItems: order.lineItems.map((li) => ({
      productName: li.productName,
      productSize: li.productSize,
      qty: li.qty,
      unitPrice: li.unitPrice,
      lineTotal: li.unitPrice * li.qty,
    })),
    subtotal,
    iva,
    deliveryFee: order.deliveryFee,
    discount: order.discount,
    total,
    paymentMethod: order.paymentMethod,
  }

  // Write payload to temp JSON
  const tmpDir = os.tmpdir()
  const tmpJsonPath = path.join(tmpDir, `flor-recibo-${order.id}-${Date.now()}.json`)
  // File name: "Recibo ORD-1001.pdf" — this is a customer-facing receipt, not
  // a fiscal invoice. The Python script also embeds "RECIBO" as the document title.
  const fileName = `Recibo ${order.orderNumber}.pdf`
  const outputPath = path.join("/home/z/my-project/download", fileName)

  await fs.mkdir(path.dirname(outputPath), { recursive: true })
  await fs.writeFile(tmpJsonPath, JSON.stringify(payload, null, 2))

  // Run the Python PDF generator
  const scriptPath = path.join(process.cwd(), "scripts", "generate_invoice_pdf.py")

  try {
    const { stdout, stderr } = await execFileAsync("python3", [
      scriptPath,
      tmpJsonPath,
      outputPath,
    ])
    console.log("Recibo PDF stdout:", stdout)
    if (stderr) console.log("Recibo PDF stderr:", stderr)

    await fs.unlink(tmpJsonPath).catch(() => {})

    return NextResponse.json({
      success: true,
      fileName,
      downloadPath: outputPath,
      orderNumber: order.orderNumber,
    })
  } catch (err) {
    await fs.unlink(tmpJsonPath).catch(() => {})
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      { error: "Failed to generate recibo PDF", detail: msg },
      { status: 500 },
    )
  }
}
