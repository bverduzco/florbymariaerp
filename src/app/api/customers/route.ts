import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { logChange } from "@/lib/audit"

export const dynamic = "force-dynamic"

/**
 * GET /api/customers
 * Returns all customers, ordered by name.
 */
export async function GET() {
  const customers = await db.customer.findMany({
    orderBy: [{ name: "asc" }],
  })

  const payload = customers.map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone ?? "",
    email: c.email ?? "",
    address: c.address ?? "",
    notes: c.notes ?? "",
    createdAt: c.createdAt.toISOString(),
  }))

  return NextResponse.json({ customers: payload, count: payload.length })
}

/**
 * POST /api/customers
 * Body: { name: string, phone?: string, email?: string, address?: string, notes?: string }
 * Creates a new customer. Returns the created customer.
 */
export async function POST(request: Request) {
  let body: {
    name?: string
    phone?: string
    email?: string
    address?: string
    notes?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  if (!body.name || typeof body.name !== "string" || body.name.trim().length === 0) {
    return NextResponse.json({ error: "Customer name is required" }, { status: 400 })
  }

  try {
    const created = await db.customer.create({
      data: {
        name: body.name.trim(),
        phone: body.phone?.trim() || null,
        email: body.email?.trim() || null,
        address: body.address?.trim() || null,
        notes: body.notes?.trim() || null,
      },
    })

    await logChange({
      entityType: "Customer",
      entityId: created.id,
      action: "create",
      newValue: created.name,
    })

    return NextResponse.json(
      {
        customer: {
          id: created.id,
          name: created.name,
          phone: created.phone ?? "",
          email: created.email ?? "",
          address: created.address ?? "",
          notes: created.notes ?? "",
          createdAt: created.createdAt.toISOString(),
        },
      },
      { status: 201 },
    )
  } catch (err) {
    // Handle unique constraint violation (name + phone)
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes("Unique constraint")) {
      return NextResponse.json(
        { error: "A customer with this name and phone already exists" },
        { status: 409 },
      )
    }
    return NextResponse.json({ error: "Failed to create customer", detail: msg }, { status: 500 })
  }
}
