import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

/**
 * GET /api/loans
 * Returns loan records, optionally filtered.
 * Query params:
 *   ?active=true  → only unreturned loans (dateReturned IS NULL)
 *   ?active=false → only returned loans
 *   (no param)   → all loans
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const activeParam = searchParams.get("active")

  const where: Record<string, unknown> = {}
  if (activeParam === "true") {
    where.dateReturned = null
  } else if (activeParam === "false") {
    where.dateReturned = { not: null }
  }

  const loans = await db.loanRecord.findMany({
    where,
    orderBy: { dateBorrowed: "desc" },
  })

  return NextResponse.json({ loans, count: loans.length })
}

/**
 * POST /api/loans
 * Body: { itemName, description?, owner, qty?, dateBorrowed?, datePromised?, executionId?, notes? }
 * Creates a new loan record.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body?.itemName || !body?.owner) {
    return NextResponse.json(
      { error: "Missing required fields: itemName, owner" },
      { status: 400 }
    )
  }

  try {
    const loan = await db.loanRecord.create({
      data: {
        itemName: String(body.itemName).trim(),
        description: body.description?.trim() || null,
        owner: String(body.owner).trim(),
        qty: body.qty ? Number(body.qty) : 1,
        dateBorrowed: body.dateBorrowed ? new Date(body.dateBorrowed) : new Date(),
        datePromised: body.datePromised ? new Date(body.datePromised) : null,
        executionId: body.executionId || null,
        notes: body.notes?.trim() || null,
      },
    })
    return NextResponse.json({ loan }, { status: 201 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
