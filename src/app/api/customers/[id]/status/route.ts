import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

/**
 * PATCH /api/customers/[id]/status
 * Body: { status: string }
 * Updates a customer's lifecycle status.
 * Valid: lead | prospect | customer | inactive
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json().catch(() => null)

  if (!body?.status) {
    return NextResponse.json({ error: "Missing field: status" }, { status: 400 })
  }

  const valid = ["lead", "prospect", "customer", "inactive"]
  if (!valid.includes(body.status)) {
    return NextResponse.json(
      { error: `Invalid status. Valid: ${valid.join(", ")}` },
      { status: 400 }
    )
  }

  try {
    const customer = await db.customer.update({
      where: { id },
      data: { status: body.status },
    })
    return NextResponse.json({ customer })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
