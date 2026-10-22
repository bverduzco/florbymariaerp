import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/customers/[id]
 * Returns the customer + their order history (from the plan store of the prototype app).
 *
 * NOTE: order history is currently derived from localStorage on the client side.
 * For server-side order history, we'd need an Order model. For now, this endpoint
 * returns just the customer record; the client can cross-reference plan items
 * by customerName to compute "order history" for display.
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params
  const customer = await db.customer.findUnique({ where: { id } })
  if (!customer) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 })
  }
  return NextResponse.json({
    customer: {
      id: customer.id,
      name: customer.name,
      phone: customer.phone ?? "",
      email: customer.email ?? "",
      address: customer.address ?? "",
      notes: customer.notes ?? "",
      createdAt: customer.createdAt.toISOString(),
      updatedAt: customer.updatedAt.toISOString(),
    },
  })
}

/**
 * PATCH /api/customers/[id]
 * Body: { name?, phone?, email?, address?, notes? }
 * Updates the customer. Only non-null fields are updated.
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  const { id } = await params
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

  // Build update payload with only provided fields
  const data: Record<string, string | null> = {}
  if (typeof body.name === "string") data.name = body.name.trim()
  if (typeof body.phone === "string") data.phone = body.phone.trim() || null
  if (typeof body.email === "string") data.email = body.email.trim() || null
  if (typeof body.address === "string") data.address = body.address.trim() || null
  if (typeof body.notes === "string") data.notes = body.notes.trim() || null

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 })
  }

  try {
    const updated = await db.customer.update({
      where: { id },
      data,
    })
    return NextResponse.json({
      customer: {
        id: updated.id,
        name: updated.name,
        phone: updated.phone ?? "",
        email: updated.email ?? "",
        address: updated.address ?? "",
        notes: updated.notes ?? "",
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes("Unique constraint")) {
      return NextResponse.json(
        { error: "Another customer with this name and phone already exists" },
        { status: 409 },
      )
    }
    if (msg.includes("Record to update not found")) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 })
    }
    return NextResponse.json({ error: "Failed to update customer", detail: msg }, { status: 500 })
  }
}

/**
 * DELETE /api/customers/[id]
 * Permanently deletes the customer.
 */
export async function DELETE(_request: Request, { params }: RouteParams) {
  const { id } = await params
  try {
    await db.customer.delete({ where: { id } })
    return NextResponse.json({ success: true, id })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes("Record to delete does not exist")) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 })
    }
    return NextResponse.json({ error: "Failed to delete customer", detail: msg }, { status: 500 })
  }
}
