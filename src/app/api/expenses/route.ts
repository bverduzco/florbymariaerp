import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { generateSequentialNumber } from "@/lib/sequential-number"

export const dynamic = "force-dynamic"

/**
 * POST /api/expenses
 * Body: { category, description, amount, vendorPayee?, paymentMethod?, notes? }
 * Creates a new expense record.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body?.category || !body?.description || !body?.amount) {
    return NextResponse.json(
      { error: "Missing required fields: category, description, amount" },
      { status: 400 }
    )
  }

  const expenseNumber = await generateSequentialNumber(db, "expense", "expenseNumber", "EXP-", 4)

  try {
    const expense = await db.expense.create({
      data: {
        expenseNumber,
        date: new Date(),
        category: body.category,
        description: body.description,
        amount: Number(body.amount),
        vendorPayee: body.vendorPayee ?? null,
        paymentMethod: body.paymentMethod ?? null,
        notes: body.notes ?? null,
      },
    })
    return NextResponse.json({ expense }, { status: 201 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
