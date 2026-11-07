import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { logChange } from "@/lib/audit"

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

    // Tier 2 audit: log which fields were changed
    const changedFields = Object.keys(data)
    await logChange({
      entityType: "Customer",
      entityId: id,
      action: "update",
      fieldName: changedFields.join(", "),
      newValue: updated.name,
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
 *
 * Class 8 fix: checks for dependent records before deleting.
 * Schema uses onDelete: Restrict on Order.customerId, so Prisma will
 * throw a FK constraint error if the customer has orders. But we catch
 * it early with a friendly 422 instead of letting Prisma throw.
 *
 * Also checks for Quotes, Events, CustomerNotes that reference the customer.
 * Pass ?force=true to delete anyway (clears links first, then deletes).
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  const { id } = await params
  const url = new URL(request.url)
  const force = url.searchParams.get("force") === "true"

  const existing = await db.customer.findUnique({ where: { id }, select: { id: true, name: true } })
  if (!existing) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 })
  }

  // Check for dependent records
  const [orderCount, quoteCount, eventCount, noteCount] = await Promise.all([
    db.order.count({ where: { customerId: id } }),
    db.quote.count({ where: { customerId: id } }),
    db.event.count({ where: { customerId: id } }),
    db.customerNote.count({ where: { customerId: id } }),
  ])

  const dependents: string[] = []
  if (orderCount > 0) dependents.push(`${orderCount} Order(s)`)
  if (quoteCount > 0) dependents.push(`${quoteCount} Quote(s)`)
  if (eventCount > 0) dependents.push(`${eventCount} Event(s)`)
  if (noteCount > 0) dependents.push(`${noteCount} CustomerNote(s)`)

  if (dependents.length > 0 && !force) {
    return NextResponse.json(
      {
        error: `Cannot delete customer "${existing.name}": ${dependents.join(", ")} reference it.`,
        dependents,
        hint: "Pass ?force=true to null out links and delete anyway. Orders have onDelete: Restrict — they cannot be force-cleared.",
      },
      { status: 422 }
    )
  }

  try {
    // If force, clear links (except Orders — those have Restrict and will block)
    if (force) {
      await db.quote.updateMany({ where: { customerId: id }, data: { customerId: null } })
      await db.event.updateMany({ where: { customerId: id }, data: { customerId: null } })
      await db.customerNote.deleteMany({ where: { customerId: id } })
    }

    await db.customer.delete({ where: { id } })
    return NextResponse.json({ success: true, id })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes("Record to delete does not exist")) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 })
    }
    // FK constraint from Order.customerId (onDelete: Restrict)
    if (msg.includes("FOREIGN KEY constraint failed")) {
      return NextResponse.json(
        {
          error: `Cannot delete customer "${existing.name}": they still have Orders. Orders must be deleted or re-assigned first (Order.customerId has onDelete: Restrict).`,
        },
        { status: 422 }
      )
    }
    return NextResponse.json({ error: "Failed to delete customer", detail: msg }, { status: 500 })
  }
}
