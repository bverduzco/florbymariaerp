import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/loans/[id]
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params
  const loan = await db.loanRecord.findUnique({ where: { id } })
  if (!loan) {
    return NextResponse.json({ error: "Loan not found" }, { status: 404 })
  }
  return NextResponse.json({ loan })
}

/**
 * PATCH /api/loans/[id]
 * Body: { dateReturned?, datePromised?, notes? }
 * Used to mark a loan as returned (set dateReturned) or update the promised date.
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  const { id } = await params
  const body = await request.json().catch(() => null)

  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const existing = await db.loanRecord.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: "Loan not found" }, { status: 404 })
  }

  const data: Record<string, unknown> = {}
  if (body.dateReturned !== undefined) {
    data.dateReturned = body.dateReturned ? new Date(body.dateReturned) : null
  }
  if (body.datePromised !== undefined) {
    data.datePromised = body.datePromised ? new Date(body.datePromised) : null
  }
  if (typeof body.notes === "string") {
    data.notes = body.notes
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 })
  }

  try {
    const loan = await db.loanRecord.update({ where: { id }, data })
    return NextResponse.json({ loan })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

/**
 * DELETE /api/loans/[id]
 */
export async function DELETE(_request: Request, { params }: RouteParams) {
  const { id } = await params
  try {
    await db.loanRecord.delete({ where: { id } })
    return NextResponse.json({ success: true, id })
  } catch {
    return NextResponse.json({ error: "Loan not found" }, { status: 404 })
  }
}
