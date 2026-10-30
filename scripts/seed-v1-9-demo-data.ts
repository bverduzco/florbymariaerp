// scripts/seed-v1-9-demo-data.ts
//
// Seeds demo business data for the 4 new UI screens (Calendar, Quotes, Payments, Products):
//   - Sample customers (CUST-001 = Example Customer, CUST-002 = Bride to be quoted)
//   - Blocked dates for Nov 2026 (Sundays + Nov 26 personal + Mexican holidays)
//   - Capacity days for Nov 2026 (90 days starting Oct 29, with weekly rhythm defaults)
//   - Sample quotes (QTE-0001 accepted wedding, QTE-0002 sent birthday, QTE-0003 declined)
//   - Sample quote lines
//   - Sample payments (in + out, with linked orders/events/POs)
//
// Idempotent — uses upsert keyed on business identifiers (CUST-001, QTE-0001, etc.).
//
// Run:
//   npx tsx scripts/seed-v1-9-demo-data.ts

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

// ─── Sample customers ─────────────────────────────────────────────────────
const CUSTOMERS = [
  {
    name: "EXAMPLE - Cliente Ejemplo",
    phone: "81 1234 5678",
    email: "cliente.ejemplo@example.com",
    address: "Av. Roble 123, Valle del Campestre, San Pedro Garza García",
    notes: "Example customer for the Peachy order/event. Delete or overwrite.",
  },
  {
    name: "María González (Bride)",
    phone: "81 2345 6789",
    email: "maria.gonzalez@example.com",
    notes: "Bride — wedding Dec 12, 2026. Quote QTE-0001 accepted.",
  },
  {
    name: "Juan Pérez",
    phone: "81 3456 7890",
    email: "juan.perez@example.com",
    notes: "Birthday bouquet — quote sent, awaiting response.",
  },
]

// ─── Blocked dates (Nov 2026) ─────────────────────────────────────────────
const BLOCKED_DATES: Array<{ date: string; reason: string; notes: string; blockedBy: string }> = [
  // Sundays in Nov 2026
  { date: "2026-11-01", reason: "sunday", notes: "Sunday — day off", blockedBy: "system" },
  { date: "2026-11-08", reason: "sunday", notes: "Sunday — day off", blockedBy: "system" },
  { date: "2026-11-15", reason: "sunday", notes: "Sunday — day off", blockedBy: "system" },
  { date: "2026-11-22", reason: "sunday", notes: "Sunday — day off", blockedBy: "system" },
  { date: "2026-11-26", reason: "personal", notes: "User-specified block", blockedBy: "Maria" },
  { date: "2026-11-29", reason: "sunday", notes: "Sunday — day off", blockedBy: "system" },
  // Mexican holidays near end of year
  { date: "2026-12-25", reason: "holiday", notes: "Navidad (Christmas Day)", blockedBy: "system" },
  { date: "2027-01-01", reason: "holiday", notes: "Año Nuevo (New Year's Day)", blockedBy: "system" },
]

// ─── Capacity days for Nov 2026 (4 weeks) ────────────────────────────────
const CAPACITY_DAYS: Array<{
  date: string; dayOfWeek: string; isWorkingDay: boolean; isProcurementDay: boolean;
  minutesAvailable: number; minutesUsed: number; coolerSlotsUsed: number; notes: string | null;
}> = []

// Generate Nov 2026 (Mon-Sun weeks)
const NOV_2026_DATES = [
  // Week 1: Nov 2-8
  ["2026-11-02", "Monday", true, false, 240, 0, 0, null],
  ["2026-11-03", "Tuesday", true, true, 360, 60, 1, "PROC — PO-3007 received"],
  ["2026-11-04", "Wednesday", true, false, 240, 0, 0, null],
  ["2026-11-05", "Thursday", true, false, 240, 240, 2, "ASSEM ⚠️ — EVT-2001 bridal bouquet"],
  ["2026-11-06", "Friday", true, false, 240, 120, 2, "DELIVER — Peachy to Cliente Ejemplo"],
  ["2026-11-07", "Saturday", true, false, 240, 0, 0, null],
  ["2026-11-08", "Sunday", false, false, 0, 0, 0, "Blocked"],
  // Week 2: Nov 9-15
  ["2026-11-09", "Monday", true, false, 240, 0, 0, null],
  ["2026-11-10", "Tuesday", true, true, 360, 90, 1, "PROC — small order"],
  ["2026-11-11", "Wednesday", true, false, 240, 0, 0, null],
  ["2026-11-12", "Thursday", true, false, 240, 60, 1, "ASSEM"],
  ["2026-11-13", "Friday", true, false, 240, 0, 1, "DELIVER"],
  ["2026-11-14", "Saturday", true, false, 240, 0, 0, "EVENT LOCK — EVT-2001"],
  ["2026-11-15", "Sunday", false, false, 0, 0, 0, "Blocked — EVT-2003 teardown"],
  // Week 3: Nov 16-22
  ["2026-11-16", "Monday", true, false, 240, 0, 0, null],
  ["2026-11-17", "Tuesday", true, true, 360, 0, 0, null],
  ["2026-11-18", "Wednesday", true, false, 240, 0, 0, null],
  ["2026-11-19", "Thursday", true, false, 240, 0, 0, null],
  ["2026-11-20", "Friday", true, false, 240, 0, 0, null],
  ["2026-11-21", "Saturday", true, false, 240, 0, 0, null],
  ["2026-11-22", "Sunday", false, false, 0, 0, 0, "Blocked"],
  // Week 4: Nov 23-29
  ["2026-11-23", "Monday", true, false, 240, 0, 0, null],
  ["2026-11-24", "Tuesday", true, true, 360, 0, 0, null],
  ["2026-11-25", "Wednesday", true, false, 240, 0, 0, "⚠ Near blocked (Nov 26)"],
  ["2026-11-26", "Thursday", false, false, 0, 0, 0, "Blocked — personal"],
  ["2026-11-27", "Friday", true, false, 240, 0, 0, "⚠ Near blocked"],
  ["2026-11-28", "Saturday", true, false, 240, 0, 0, null],
  ["2026-11-29", "Sunday", false, false, 0, 0, 0, "Blocked"],
]

// ─── Sample quotes ────────────────────────────────────────────────────────
const QUOTES = [
  {
    quoteNumber: "QTE-0001",
    quoteDate: new Date("2026-10-18"),
    customerName: "María González (Bride)",
    eventType: "wedding",
    eventDate: new Date("2026-12-12"),
    status: "accepted",
    validUntil: new Date("2026-11-02"),
    subtotal: 3550.00,
    iva: 568.00,
    total: 4118.00,
    depositRequired: 2059.00,
    linkedOrderId: "ORD-1001",
    lostReason: null,
    leadSource: "referral",
    notes: "Sample — bride wanted peachy bouquet + small bouquet. Quote accepted, deposit paid.",
  },
  {
    quoteNumber: "QTE-0002",
    quoteDate: new Date("2026-10-25"),
    customerName: "Juan Pérez",
    eventType: "birthday",
    eventDate: new Date("2026-11-15"),
    status: "sent",
    validUntil: new Date("2026-11-09"),
    subtotal: 1750.00,
    iva: 280.00,
    total: 2030.00,
    depositRequired: 1015.00,
    linkedOrderId: null,
    lostReason: null,
    leadSource: "instagram",
    notes: "Sample — birthday centerpiece × 5. Sent via WhatsApp.",
  },
  {
    quoteNumber: "QTE-0003",
    quoteDate: new Date("2026-10-20"),
    customerName: "Corp Logo SA de CV",
    eventType: "corporate",
    eventDate: new Date("2026-11-30"),
    status: "declined",
    validUntil: new Date("2026-11-04"),
    subtotal: 3600.00,
    iva: 576.00,
    total: 4176.00,
    depositRequired: 2088.00,
    linkedOrderId: null,
    lostReason: "too_expensive",
    leadSource: "walk_in",
    notes: "Sample — corporate event. Customer said budget was too tight, went with cheaper florist.",
  },
  {
    quoteNumber: "QTE-0004",
    quoteDate: new Date("2026-10-28"),
    customerName: "Ana López (Quinceañera Mom)",
    eventType: "quinceanera",
    eventDate: new Date("2027-02-20"),
    status: "negotiating",
    validUntil: new Date("2026-11-12"),
    subtotal: 12500.00,
    iva: 2000.00,
    total: 14500.00,
    depositRequired: 4350.00,
    linkedOrderId: null,
    lostReason: null,
    leadSource: "referral",
    notes: "Quince años — centerpiece × 20 + bridal-style bouquet + church flowers. Negotiating on count.",
  },
]

const QUOTE_LINES = [
  { quoteNumber: "QTE-0001", lineNumber: 1, description: "Peachy Bouquet (Large)", productSku: "PRD-PEACHY-L", qty: 1, unitPrice: 1700.00, lineTotal: 1700.00, notes: "Bridal bouquet" },
  { quoteNumber: "QTE-0001", lineNumber: 2, description: "Peachy Bouquet (Small)", productSku: "PRD-PEACHY-S", qty: 2, unitPrice: 925.00, lineTotal: 1850.00, notes: "Bridesmaid bouquets" },
  { quoteNumber: "QTE-0002", lineNumber: 1, description: "Centro de mesa (custom)", productSku: null, qty: 5, unitPrice: 350.00, lineTotal: 1750.00, notes: "Custom centerpiece — roses + eucalipto" },
  { quoteNumber: "QTE-0003", lineNumber: 1, description: "Arreglo corporativo grande", productSku: null, qty: 3, unitPrice: 1200.00, lineTotal: 3600.00, notes: "Corporate arrangement — seasonal flowers" },
  { quoteNumber: "QTE-0004", lineNumber: 1, description: "Centro de mesa mediano", productSku: null, qty: 20, unitPrice: 450.00, lineTotal: 9000.00, notes: "Quince años centerpieces" },
  { quoteNumber: "QTE-0004", lineNumber: 2, description: "Ramo de quinceañera (estilo novia)", productSku: "PRD-PEACHY-L", qty: 1, unitPrice: 2500.00, lineTotal: 2500.00, notes: "Quinceañera bouquet" },
  { quoteNumber: "QTE-0004", lineNumber: 3, description: "Flor de iglesia (arcos)", productSku: null, qty: 2, unitPrice: 1500.00, lineTotal: 3000.00, notes: "Church floral arrangements" },
]

// ─── Sample payments ─────────────────────────────────────────────────────
const PAYMENTS = [
  {
    paymentNumber: "PAY-0001",
    date: new Date("2026-10-21"),
    direction: "inbound",
    type: "order_full",
    linkedId: "ORD-1001",
    linkedName: "Cliente Ejemplo",
    amount: 3550.00,
    method: "spei",
    reference: "SPEI-20261021-001",
    status: "confirmed",
    recordedBy: "Maria",
    notes: "Full payment for ORD-1001 (2 items). Paid before procurement.",
  },
  {
    paymentNumber: "PAY-0002",
    date: new Date("2026-10-19"),
    direction: "outbound",
    type: "po",
    linkedId: "PO-3007",
    linkedName: "LA FINCA",
    amount: 478.00,
    method: "transfer",
    reference: "TRF-20261019",
    status: "confirmed",
    recordedBy: "Maria",
    notes: "COD payment for PO-3007 (6 items received from LA FINCA).",
  },
  {
    paymentNumber: "PAY-0003",
    date: new Date("2026-10-12"),
    direction: "outbound",
    type: "po",
    linkedId: "PO-3006",
    linkedName: "LA FINCA",
    amount: 715.00,
    method: "transfer",
    reference: "TRF-20261012",
    status: "confirmed",
    recordedBy: "Maria",
    notes: "COD payment for PO-3006 (7 items received from LA FINCA).",
  },
  {
    paymentNumber: "PAY-0004",
    date: new Date("2026-10-05"),
    direction: "outbound",
    type: "po",
    linkedId: "PO-3005",
    linkedName: "LA FINCA",
    amount: 486.00,
    method: "transfer",
    reference: "TRF-20261005",
    status: "confirmed",
    recordedBy: "Maria",
    notes: "COD payment for PO-3005 (6 items received from LA FINCA).",
  },
  {
    paymentNumber: "PAY-0005",
    date: new Date("2026-10-18"),
    direction: "inbound",
    type: "event_deposit",
    linkedId: "EVT-2001",
    linkedName: "Cliente Ejemplo",
    amount: 2059.00,
    method: "spei",
    reference: "SPEI-20261018-DEP",
    status: "confirmed",
    recordedBy: "Maria",
    notes: "50% deposit for wedding EVT-2001 (Dec 12). Balance due Nov 28.",
  },
  {
    paymentNumber: "PAY-0006",
    date: "2026-11-14" as any, // future-dated sample
    direction: "inbound",
    type: "event_final",
    linkedId: "EVT-2001",
    linkedName: "Cliente Ejemplo",
    amount: 2059.00,
    method: null,
    reference: null,
    status: "pending",
    recordedBy: "Maria",
    notes: "50% balance for EVT-2001. Due Nov 28 (14 days before event).",
  },
]

async function main() {
  console.log("Seeding v1.9 demo data...")

  // ─── Customers ────────────────────────────────────────────────────────
  console.log("\n[1] Customers...")
  for (const c of CUSTOMERS) {
    // Use upsert keyed on (name, phone)
    const existing = await prisma.customer.findFirst({
      where: { name: c.name, phone: c.phone },
    })
    if (existing) {
      await prisma.customer.update({ where: { id: existing.id }, data: c })
      console.log(`  ↻ Updated: ${c.name}`)
    } else {
      await prisma.customer.create({ data: c })
      console.log(`  ✓ Created: ${c.name}`)
    }
  }

  // ─── Blocked dates ────────────────────────────────────────────────────
  console.log("\n[2] Blocked dates...")
  for (const bd of BLOCKED_DATES) {
    const date = new Date(bd.date)
    const result = await prisma.blockedDate.upsert({
      where: { date },
      update: { reason: bd.reason, notes: bd.notes, blockedBy: bd.blockedBy },
      create: { date, reason: bd.reason, notes: bd.notes, blockedBy: bd.blockedBy },
    })
    console.log(`  ✓ ${bd.date}: ${bd.reason} — ${bd.notes}`)
  }

  // ─── Capacity days ────────────────────────────────────────────────────
  console.log("\n[3] Capacity days...")
  for (const cd of NOV_2026_DATES) {
    const [dateStr, dayOfWeek, isWorkingDay, isProcurementDay, minutesAvailable, minutesUsed, coolerSlotsUsed, notes] = cd as [string, string, boolean, boolean, number, number, number, string | null]
    const date = new Date(dateStr)
    const utilizationPct = minutesAvailable > 0 ? minutesUsed / minutesAvailable : null
    const result = await prisma.capacityDay.upsert({
      where: { date },
      update: {
        dayOfWeek,
        isWorkingDay,
        isProcurementDay,
        minutesAvailable,
        minutesUsed,
        utilizationPct,
        coolerSlotsUsed,
        notes,
      },
      create: {
        date,
        dayOfWeek,
        isWorkingDay,
        isProcurementDay,
        minutesAvailable,
        minutesUsed,
        utilizationPct,
        coolerSlotsUsed,
        notes,
      },
    })
    console.log(`  ✓ ${dateStr}: ${dayOfWeek.padEnd(9)} ${isWorkingDay ? "WORK" : "OFF "} ${minutesUsed}/${minutesAvailable}min`)
  }

  // ─── Quotes + lines ──────────────────────────────────────────────────
  console.log("\n[4] Quotes + quote lines...")
  for (const q of QUOTES) {
    // Find customer by name to link
    const customer = await prisma.customer.findFirst({ where: { name: q.customerName } })
    const result = await prisma.quote.upsert({
      where: { quoteNumber: q.quoteNumber },
      update: { ...q, customerId: customer?.id ?? null },
      create: { ...q, customerId: customer?.id ?? null },
    })
    console.log(`  ✓ ${q.quoteNumber} (${q.status.padEnd(11)}) ${q.customerName} — $${q.total}`)
  }
  for (const ql of QUOTE_LINES) {
    // Look up product if productSku is set
    let productId: string | null = null
    if (ql.productSku) {
      const p = await prisma.product.findUnique({ where: { sku: ql.productSku } })
      productId = p?.id ?? null
    }
    // Look up the parent quote
    const quote = await prisma.quote.findUnique({ where: { quoteNumber: ql.quoteNumber } })
    if (!quote) {
      console.log(`    ⚠ Skipping line ${ql.lineNumber}: quote ${ql.quoteNumber} not found`)
      continue
    }
    // Quote line doesn't have a unique business key — use sourceRowKey
    const sourceRowKey = `ql-${ql.quoteNumber}-${ql.lineNumber}`
    await prisma.quoteLine.upsert({
      where: { sourceRowKey },
      update: {
        lineNumber: ql.lineNumber,
        productSku: ql.productSku,
        productId,
        description: ql.description,
        qty: ql.qty,
        unitPrice: ql.unitPrice,
        lineTotal: ql.lineTotal,
        notes: ql.notes,
      },
      create: {
        quoteId: quote.id,
        lineNumber: ql.lineNumber,
        productSku: ql.productSku,
        productId,
        description: ql.description,
        qty: ql.qty,
        unitPrice: ql.unitPrice,
        lineTotal: ql.lineTotal,
        notes: ql.notes,
        sourceRowKey,
      },
    })
    console.log(`    ↳ Line ${ql.lineNumber}: ${ql.description} × ${ql.qty} = $${ql.lineTotal}`)
  }

  // ─── Payments ────────────────────────────────────────────────────────
  console.log("\n[5] Payments...")
  for (const p of PAYMENTS) {
    // Convert string dates to Date for upcoming payments
    const dateObj = typeof p.date === "string" ? new Date(p.date) : p.date
    const result = await prisma.payment.upsert({
      where: { paymentNumber: p.paymentNumber },
      update: { ...p, date: dateObj },
      create: { ...p, date: dateObj },
    })
    const arrow = p.direction === "inbound" ? "→" : "←"
    console.log(`  ✓ ${p.paymentNumber} ${arrow} ${p.type.padEnd(14)} $${p.amount.toFixed(2)} (${p.status})`)
  }

  console.log("\n✅ All demo data seeded.")
  console.log("\nSummary:")
  console.log(`  Customers:     ${await prisma.customer.count()}`)
  console.log(`  Blocked dates: ${await prisma.blockedDate.count()}`)
  console.log(`  Capacity days: ${await prisma.capacityDay.count()}`)
  console.log(`  Quotes:        ${await prisma.quote.count()}`)
  console.log(`  Quote lines:   ${await prisma.quoteLine.count()}`)
  console.log(`  Payments:      ${await prisma.payment.count()}`)
}

main()
  .catch((e) => {
    console.error("Seed failed:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
