import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

/**
 * POST /api/suppliers
 * Body: { name, contactPerson?, phone?, email?, leadTimeDays?, paymentTerms?, notes? }
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body?.name) {
    return NextResponse.json({ error: "Missing required field: name" }, { status: 400 })
  }

  const existing = await db.supplier.findUnique({ where: { name: body.name.trim() } })
  if (existing) {
    return NextResponse.json({ error: `Supplier "${body.name}" already exists` }, { status: 409 })
  }

  try {
    const supplier = await db.supplier.create({
      data: {
        name: body.name.trim(),
        contactPerson: body.contactPerson?.trim() || null,
        phone: body.phone?.trim() || null,
        email: body.email?.trim() || null,
        leadTimeDays: body.leadTimeDays ? Number(body.leadTimeDays) : null,
        paymentTerms: body.paymentTerms?.trim() || null,
        notes: body.notes?.trim() || null,
      },
    })
    return NextResponse.json({ supplier }, { status: 201 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
