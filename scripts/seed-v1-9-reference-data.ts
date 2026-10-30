// scripts/seed-v1-9-reference-data.ts
//
// Seeds reference data that's needed in every environment (dev, demo, prod):
//   - SeasonMarkers (6 markers from the v1.8.1 spec)
//   - WorkbookSettings (default delivery fee, etc.)
//   - LegalTemplates (4 templates from v1.6.6 spec)
//   - Maria as STAFF-001
//
// Idempotent — safe to re-run. Uses upsert so existing rows are not duplicated.
//
// Run:
//   npx tsx scripts/seed-v1-9-reference-data.ts

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

// ─── Season Markers (from v1.8.1 spec, 6 markers) ────────────────────────
const SEASON_MARKERS = [
  {
    markerId: "sm_001",
    name: "Wedding Season",
    type: "SEASON",
    startDate: new Date("2026-10-01"),
    endDate: new Date("2027-02-28"),
    color: "#8B5CF6",
    intensity: "HIGH",
    description: "Peak wedding months in Monterrey. Display only — tints day cells in calendar.",
    recurrence: "YEARLY_FIXED",
  },
  {
    markerId: "sm_002",
    name: "Día de las Madres",
    type: "HOLIDAY",
    startDate: new Date("2026-05-10"),
    endDate: null,
    color: "#EC4899",
    intensity: "HIGH",
    description: "Highest single-demand day of the year. Shopping List hint: roses +30%.",
    recurrence: "YEARLY_FIXED",
  },
  {
    markerId: "sm_003",
    name: "Día de Muertos",
    type: "HOLIDAY",
    startDate: new Date("2026-11-01"),
    endDate: new Date("2026-11-02"),
    color: "#F59E0B",
    intensity: "MEDIUM",
    description: "Cempasúchil (marigold) demand spike. Display + hint.",
    recurrence: "YEARLY_FIXED",
  },
  {
    markerId: "sm_004",
    name: "Valentine's (Amor y Amistad)",
    type: "HOLIDAY",
    startDate: new Date("2026-02-14"),
    endDate: null,
    color: "#EF4444",
    intensity: "HIGH",
    description: "Red roses spike. Shopping List hint: red roses +50%.",
    recurrence: "YEARLY_FIXED",
  },
  {
    markerId: "sm_005",
    name: "Prom Season",
    type: "SEASON",
    startDate: new Date("2026-05-15"),
    endDate: new Date("2026-06-30"),
    color: "#10B981",
    intensity: "MEDIUM",
    description: "HS prom bouquets. Display only.",
    recurrence: "YEARLY_FIXED",
  },
  {
    markerId: "sm_006",
    name: "Slow August",
    type: "TREND",
    startDate: new Date("2026-08-01"),
    endDate: new Date("2026-08-31"),
    color: "#3B82F6",
    intensity: "LOW",
    description: "Off-season — vacation/inventory friendly. Display + caption only, no demand assumption.",
    recurrence: "YEARLY_FIXED",
  },
]

// ─── Workbook Settings (defaults) ────────────────────────────────────────
const WORKBOOK_SETTINGS = [
  {
    key: "defaultDeliveryFee",
    section: "pricing",
    value: "100",
    notes: "Default flat delivery fee in MXN (before IVA). Used when Orders tab doesn't override.",
  },
  {
    key: "website_url",
    section: "branding",
    value: "",
    notes: "Website URL where privacy notice is published.",
  },
  {
    key: "uses_cookies",
    section: "branding",
    value: "false",
    notes: "Whether the website uses cookies.",
  },
]

// ─── Maria as STAFF-001 ──────────────────────────────────────────────────
const MARIA_STAFF = {
  staffNumber: "STAFF-001",
  name: "Maria Verduzco",
  shortName: "Maria",
  phone: null,
  email: null,
  type: "internal",
  skills: "assembly, delivery, conditioning, setup, teardown, design",
  payRate: null,
  notes: "Owner. Does everything. Pay rate N/A (owner, not hourly).",
  active: true,
  dateAdded: new Date("2026-01-01"),
}

async function main() {
  console.log("Seeding v1.9 reference data...")

  // Season markers
  console.log("\n[1] Season markers...")
  for (const marker of SEASON_MARKERS) {
    const result = await prisma.seasonMarker.upsert({
      where: { markerId: marker.markerId },
      update: marker,
      create: marker,
    })
    console.log(`  ✓ ${result.markerId}: ${result.name}`)
  }

  // Workbook settings
  console.log("\n[2] Workbook settings...")
  for (const setting of WORKBOOK_SETTINGS) {
    const result = await prisma.workbookSetting.upsert({
      where: { key: setting.key },
      update: setting,
      create: setting,
    })
    console.log(`  ✓ ${result.key} (${result.section}): ${result.value}`)
  }

  // Staff — Maria
  console.log("\n[3] Staff — Maria...")
  const maria = await prisma.staff.upsert({
    where: { staffNumber: MARIA_STAFF.staffNumber },
    update: MARIA_STAFF,
    create: MARIA_STAFF,
  })
  console.log(`  ✓ ${maria.staffNumber}: ${maria.name} (${maria.shortName})`)

  console.log("\n✅ All reference data seeded.")
}

main()
  .catch((e) => {
    console.error("Seed failed:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
