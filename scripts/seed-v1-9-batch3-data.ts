// scripts/seed-v1-9-batch3-data.ts
//
// Seeds demo data for Batch 3 screens:
//   - More events (EVT-2002 corporate, EVT-2003 bridal fair unpaid, EVT-2004 quinceañera)
//   - Operating expenses (gas, parking, software, market runs)
//   - 1 more staff member (sample assistant, currently inactive)
//
// Idempotent — uses upsert keyed on business identifiers.

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

// ─── More events ─────────────────────────────────────────────────────────
const EVENTS = [
  {
    eventNumber: "EVT-2002",
    name: "Boda María y Carlos",
    eventDate: new Date("2026-12-12"),
    guests: 120,
    status: "confirmed",
    notes: "Wedding — bridal bouquet + 4 bridesmaid bouquets + 15 centerpieces + church flowers. Deposit paid, balance due Nov 28.",
  },
  {
    eventNumber: "EVT-2003",
    name: "Bridal Fair Demo (Expo Novias MTY)",
    eventDate: new Date("2026-11-15"),
    guests: 0,
    status: "completed",
    notes: "Unpaid event — bridal fair demo. Booth flowers + 3 sample bouquets. Marketing/portfolio. No customer.",
  },
  {
    eventNumber: "EVT-2004",
    name: "Quinceañera Ana López",
    eventDate: new Date("2027-02-20"),
    guests: 200,
    status: "quote",
    notes: "Quince años — 20 centerpieces + quinceañera bouquet + church flowers. Quote sent, awaiting deposit.",
  },
  {
    eventNumber: "EVT-2005",
    name: "Corporate Holiday Party — Tech Corp",
    eventDate: new Date("2026-12-15"),
    guests: 80,
    status: "in_progress",
    notes: "Corporate — 8 centerpieces + 2 large arrangements for entrance. Confirmed, deposit paid.",
  },
]

// ─── Expenses ────────────────────────────────────────────────────────────
const EXPENSES = [
  {
    expenseNumber: "EXP-0001",
    date: new Date("2026-10-24"),
    category: "gas",
    description: "Gas — round trip to Maxi Home García (Oct 24 procurement)",
    amount: 120,
    vendorPayee: "Pemex",
    linkedOrder: null,
    linkedEvent: null,
    paymentMethod: "card",
    notes: "ESTIMATE — ~60 km round trip, ~$2/km. Replace with actual receipt amount.",
  },
  {
    expenseNumber: "EXP-0002",
    date: new Date("2026-10-24"),
    category: "parking",
    description: "Parking at Maxi Home García (Oct 24 procurement)",
    amount: 40,
    vendorPayee: "Maxi Home García",
    linkedOrder: null,
    linkedEvent: null,
    paymentMethod: "cash",
    notes: "ESTIMATE — typical market parking. Replace with actual receipt amount.",
  },
  {
    expenseNumber: "EXP-0003",
    date: new Date("2026-10-25"),
    category: "gas",
    description: "Gas — round trip to Maxi Home García (Oct 25 procurement)",
    amount: 120,
    vendorPayee: "Pemex",
    linkedOrder: null,
    linkedEvent: null,
    paymentMethod: "card",
    notes: "ESTIMATE — ~60 km round trip, ~$2/km. Replace with actual receipt amount.",
  },
  {
    expenseNumber: "EXP-0004",
    date: new Date("2026-10-25"),
    category: "parking",
    description: "Parking at Maxi Home García (Oct 25 procurement)",
    amount: 40,
    vendorPayee: "Maxi Home García",
    linkedOrder: null,
    linkedEvent: null,
    paymentMethod: "cash",
    notes: "ESTIMATE — typical market parking. Replace with actual receipt amount.",
  },
  {
    expenseNumber: "EXP-0005",
    date: new Date("2026-10-15"),
    category: "software",
    description: "Vercel Pro subscription (monthly)",
    amount: 0,
    vendorPayee: "Vercel",
    linkedOrder: null,
    linkedEvent: null,
    paymentMethod: "card",
    notes: "Currently free hobby tier. Update amount if upgraded to Pro ($20/mo).",
  },
  {
    expenseNumber: "EXP-0006",
    date: new Date("2026-10-15"),
    category: "software",
    description: "Turso database hosting (Hobby tier)",
    amount: 0,
    vendorPayee: "Turso",
    linkedOrder: null,
    linkedEvent: null,
    paymentMethod: "card",
    notes: "Free Hobby tier — 500 DBs, 9GB each, 1B row reads/month.",
  },
  {
    expenseNumber: "EXP-0007",
    date: new Date("2026-10-20"),
    category: "market_run",
    description: "Snacks + water for bridal fair setup (EVT-2003)",
    amount: 85,
    vendorPayee: "OXXO",
    linkedOrder: null,
    linkedEvent: "EVT-2003",
    paymentMethod: "cash",
    notes: "Drinks and snacks for the booth team during Expo Novias MTY setup.",
  },
  {
    expenseNumber: "EXP-0008",
    date: new Date("2026-10-28"),
    category: "utilities",
    description: "Internet bill (October)",
    amount: 399,
    vendorPayee: "Telmex",
    linkedOrder: null,
    linkedEvent: null,
    paymentMethod: "card",
    notes: "Monthly internet — Infinitum 200 Mbps.",
  },
]

// ─── Sample assistant staff (inactive for now) ───────────────────────────
const STAFF = [
  {
    staffNumber: "STAFF-002",
    name: "Rosa Martínez",
    shortName: "Rosa",
    phone: "81 5555 1234",
    email: null,
    type: "freelance",
    skills: "conditioning, setup, teardown",
    payRate: 100,
    notes: "Sample row — replace with real assistant when hired. $100/hr rate. Helps with event setup/teardown as needed.",
    active: false,
    dateAdded: new Date("2026-10-01"),
  },
]

async function main() {
  console.log("Seeding Batch 3 demo data...")

  // ─── Events ────────────────────────────────────────────────────────
  console.log("\n[1] Events...")
  for (const e of EVENTS) {
    // Try to find a customer by name match (loose linking)
    const customer = e.eventNumber === "EVT-2002"
      ? await prisma.customer.findFirst({ where: { name: { contains: "María" } } })
      : e.eventNumber === "EVT-2004"
      ? await prisma.customer.findFirst({ where: { name: { contains: "Ana" } } })
      : null
    const result = await prisma.event.upsert({
      where: { eventNumber: e.eventNumber },
      update: { ...e, customerId: customer?.id ?? null },
      create: { ...e, customerId: customer?.id ?? null },
    })
    console.log(`  ✓ ${result.eventNumber} (${result.status.padEnd(11)}) ${result.name} — ${result.guests || "?"} guests`)
  }

  // ─── Expenses ─────────────────────────────────────────────────────
  console.log("\n[2] Expenses...")
  for (const exp of EXPENSES) {
    const result = await prisma.expense.upsert({
      where: { expenseNumber: exp.expenseNumber },
      update: exp,
      create: exp,
    })
    console.log(`  ✓ ${result.expenseNumber} ${result.category.padEnd(13)} $${result.amount.toFixed(2)} — ${result.description.slice(0, 60)}`)
  }

  // ─── Staff ────────────────────────────────────────────────────────
  console.log("\n[3] Staff...")
  for (const s of STAFF) {
    const result = await prisma.staff.upsert({
      where: { staffNumber: s.staffNumber },
      update: s,
      create: s,
    })
    console.log(`  ✓ ${result.staffNumber}: ${result.name} (active=${result.active})`)
  }

  console.log("\n✅ Batch 3 demo data seeded.")
  console.log("\nSummary:")
  console.log(`  Events:   ${await prisma.event.count()}`)
  console.log(`  Expenses: ${await prisma.expense.count()}`)
  console.log(`  Staff:    ${await prisma.staff.count()}`)
}

main()
  .catch((e) => {
    console.error("Seed failed:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
