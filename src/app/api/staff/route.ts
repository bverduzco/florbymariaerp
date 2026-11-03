import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { generateSequentialNumber } from "@/lib/sequential-number"

export const dynamic = "force-dynamic"

/**
 * POST /api/staff
 * Body: { name, shortName?, phone?, email?, type, skills?, payRate?, notes? }
 * Creates a new staff member.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body?.name || !body?.type) {
    return NextResponse.json(
      { error: "Missing required fields: name, type" },
      { status: 400 }
    )
  }

  const staffNumber = await generateSequentialNumber(db, "staff", "staffNumber", "STAFF-", 3)

  try {
    const staff = await db.staff.create({
      data: {
        staffNumber,
        name: body.name,
        shortName: body.shortName ?? null,
        phone: body.phone ?? null,
        email: body.email ?? null,
        type: body.type,
        skills: body.skills ?? null,
        payRate: body.payRate ? Number(body.payRate) : null,
        notes: body.notes ?? null,
        active: true,
        dateAdded: new Date(),
      },
    })
    return NextResponse.json({ staff }, { status: 201 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
