// src/app/api/orders/draft/route.ts — v1.8
//
// Streams the Draft Excel directly to the browser. No disk writes.
//
// Replaces the v1.7 version which:
//   1. Wrote payload JSON to /tmp/xxx.json
//   2. Called python3 scripts/generate_draft.py
//   3. Saved .xlsx to /home/z/my-project/download/...
//   4. Returned JSON { fileName, downloadPath, generatedAt, ... }
//   5. Client fetched /download/.../[filename]
//
// v1.8:
//   1. Build Excel buffer in-process via exceljs
//   2. Return Response with Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
//   3. Browser downloads immediately — no disk, no second round-trip

import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { generateDraftExcel, type DraftPayload } from "@/lib/pdf/draft"
import { nowGmtMinus6FileStamp } from "@/lib/pdf/utils"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function POST(request: Request) {
  // The v1.7 route accepts an empty body — let's keep that for compatibility.
  // (No body parsing needed.)

  // Fetch all orders with line items and customer data
  const orders = await db.order.findMany({
    include: { customer: true, lineItems: true },
    orderBy: { createdAt: "desc" },
  })

  const customers = await db.customer.findMany({
    orderBy: { createdAt: "desc" },
  })

  // Build the payload
  const draftOrders = orders.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    status: o.status,
    customerName: o.customer?.name ?? null,
    customerPhone: o.customer?.phone ?? null,
    deliveryDate: o.deliveryDate?.toISOString().split("T")[0] ?? null,
    deliveryAddress: o.deliveryAddress ?? null,
    deliveryNotes: o.deliveryNotes ?? null,
    internalNotes: o.internalNotes ?? null,
    cardMessage: o.cardMessage ?? null,
    paymentStatus: o.paymentStatus,
    paymentMethod: o.paymentMethod ?? null,
    paymentOptionsSentAt: o.paymentOptionsSentAt?.toISOString() ?? null,
    paymentConfirmedAt: o.paymentConfirmedAt?.toISOString() ?? null,
    createdAt: o.createdAt.toISOString(),
    total: o.lineItems.reduce((s, li) => s + li.unitPrice * li.qty, 0),
  }))

  const draftCustomers = customers.map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone ?? "",
    email: c.email ?? "",
    address: c.address ?? "",
    notes: c.notes ?? "",
    createdAt: c.createdAt.toISOString(),
  }))

  const draftLineItems = orders.flatMap((o) =>
    (o.lineItems ?? []).map((li) => ({
      orderId: o.id,
      orderNumber: o.orderNumber,
      productName: li.productName,
      productSize: li.productSize ?? null,
      qty: li.qty,
      unitPrice: li.unitPrice,
      lineTotal: li.unitPrice * li.qty,
    })),
  )

  const payload: DraftPayload = {
    orders: draftOrders,
    customers: draftCustomers,
    lineItems: draftLineItems,
  }

  // Generate Excel in-process
  const excelBuffer = await generateDraftExcel(payload)

  // Stream the Excel back as the HTTP response
  const fileName = `ERP Draft (${nowGmtMinus6FileStamp()}).xlsx`

  return new Response(excelBuffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
      "Content-Length": String(excelBuffer.length),
      "Cache-Control": "no-store",
    },
  })
}
