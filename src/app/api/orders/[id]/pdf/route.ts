// src/app/api/orders/[id]/pdf/route.ts — v1.8
//
// Streams the Recibo PDF directly to the browser. No disk writes.
//
// v1.7 used to:
//   1. Write payload to /tmp/xxx.json
//   2. execFileAsync('python3', [...])
//   3. Save PDF to /home/z/my-project/download/...
//   4. Return JSON { fileName, downloadPath } to client
//   5. Client would then GET /download/.../[filename]
//
// v1.8:
//   1. Build PDF buffer in-process via pdfmake
//   2. Return Response with Content-Type: application/pdf + Content-Disposition
//   3. Browser downloads immediately — no disk, no second round-trip

import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { generateReciboPdf, type ReciboPayload } from "@/lib/pdf/recibo"
import { nowGmtMinus6FileStamp } from "@/lib/pdf/utils"

export const dynamic = "force-dynamic"
export const maxDuration = 60 // 60s — needed for Vercel Pro if generating large PDFs

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

  // Build the payload (same shape as v1.7)
  const subtotal = order.lineItems.reduce((s, li) => s + li.unitPrice * li.qty, 0)
  const iva = subtotal * 0.16
  const total = subtotal + iva + order.deliveryFee - order.discount

  const payload: ReciboPayload = {
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
    paymentMethod: order.paymentMethod as ReciboPayload["paymentMethod"],
  }

  // Generate PDF in-process — no execFile, no Python, no disk writes
  const pdfBuffer = await generateReciboPdf(payload)

  // Stream the PDF back as the HTTP response.
  // The browser will download it directly with the given filename.
  const fileName = `Recibo ${order.orderNumber}.pdf`
  return new Response(pdfBuffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
      "Content-Length": String(pdfBuffer.length),
      "Cache-Control": "no-store", // always regenerate, never cache
    },
  })
}
