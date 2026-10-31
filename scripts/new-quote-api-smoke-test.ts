/**
 * End-to-end smoke test for the v1.9 New Quote API.
 *
 * Tests:
 *   A) New-quote-via-Quotes-tab flow: full payload with line items, lead source
 *      with detail, no event. Verifies totals math + line persistence.
 *   B) Legacy backward-compat path: only {customerName, subtotal, ...} — no
 *      lineItems, no leadSourceDetail. Verifies old callers still work.
 *   C) eventId validation: passing a non-existent eventId returns 404.
 *   D) Empty body validation: returns 400.
 *
 * Cleans up after itself: deletes all quotes created during the test.
 */
import { db } from "../src/lib/db"

const TEST_QUOTE_NUMBERS: string[] = []
const TEST_MARKER = "smoke-test-v1.9-new-quote"

async function cleanup() {
  if (TEST_QUOTE_NUMBERS.length === 0) return
  console.log(`\nCleanup: deleting ${TEST_QUOTE_NUMBERS.length} test quote(s)...`)
  // Delete lines first (cascade should handle it, but be explicit)
  await db.quoteLine.deleteMany({
    where: { quote: { quoteNumber: { in: TEST_QUOTE_NUMBERS } } },
  })
  await db.quote.deleteMany({
    where: { quoteNumber: { in: TEST_QUOTE_NUMBERS } },
  })
  console.log("  ✓ Cleaned up")
}

async function main() {
  // ── Setup: get a real product + customer + event to test with ────────
  const product = await db.product.findFirst({
    where: { actualPriceBeforeIva: { gt: 0 } },
    orderBy: { name: "asc" },
    select: { id: true, sku: true, name: true, size: true, actualPriceBeforeIva: true },
  })
  if (!product) {
    console.log("No products with price > 0 — cannot test line items.")
    return
  }
  console.log(`Test setup: using product ${product.sku} (${product.name}, $${product.actualPriceBeforeIva})`)

  const event = await db.event.findFirst({
    orderBy: { eventDate: "asc" },
    select: { id: true, eventNumber: true, name: true },
  })
  if (event) {
    console.log(`Test setup: using event ${event.eventNumber} (${event.name}) for eventId validation tests`)
  }

  // ── Test A: full new-quote flow (Quotes tab path) ────────────────
  console.log("\nTest A: Full payload with line items + lead source detail (no event)")
  const payloadA = {
    customerName: "Smoke Test Customer A",
    eventId: null,
    quoteMode: "no_event",
    eventType: "everyday",
    eventDate: "2026-12-01",
    leadSource: "referral",
    leadSourceDetail: "Laura Martínez",
    notes: TEST_MARKER,
    lineItems: [
      {
        productSku: product.sku,
        productId: product.id,
        description: `${product.name} (${product.size ?? "—"})`,
        qty: 2,
        unitPrice: product.actualPriceBeforeIva,
      },
      {
        productSku: null,
        productId: null,
        description: "Custom card message",
        qty: 1,
        unitPrice: 50,
      },
    ],
  }
  // Expected math:
  //   line 1: 2 × product.actualPriceBeforeIva
  //   line 2: 1 × 50 = 50
  //   subtotal = (2 * product.actualPriceBeforeIva) + 50
  //   iva = subtotal * 0.16
  //   total = subtotal + iva
  //   deposit = total * 0.5
  const expectedSubtotalA = 2 * product.actualPriceBeforeIva + 50
  const expectedIvaA = expectedSubtotalA * 0.16
  const expectedTotalA = expectedSubtotalA + expectedIvaA
  const expectedDepositA = expectedTotalA * 0.5

  const resA = await fetch("http://localhost:3000/api/quotes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payloadA),
  })
  const dataA = await resA.json()
  if (!resA.ok) {
    console.error(`  FAIL: ${resA.status}`, dataA)
    process.exit(1)
  }
  TEST_QUOTE_NUMBERS.push(dataA.quote.quoteNumber)
  console.log(`  ✓ Created ${dataA.quote.quoteNumber}`)
  console.log(`    eventId: ${dataA.quote.eventId ?? "(null)"}  ← should be null`)
  console.log(`    eventType: ${dataA.quote.eventType}  ← should be 'everyday'`)
  console.log(`    leadSource: ${dataA.quote.leadSource}  ← should be 'referral'`)
  console.log(`    leadSourceDetail: ${dataA.quote.leadSourceDetail}  ← should be 'Laura Martínez'`)
  console.log(`    subtotal: $${dataA.quote.subtotal}  ← expected $${expectedSubtotalA}`)
  console.log(`    iva: $${dataA.quote.iva}  ← expected $${expectedIvaA}`)
  console.log(`    total: $${dataA.quote.total}  ← expected $${expectedTotalA}`)
  console.log(`    deposit: $${dataA.quote.depositRequired}  ← expected $${expectedDepositA}`)
  console.log(`    lines: ${dataA.quote.lines.length}  ← expected 2`)

  // Assert
  const passA =
    dataA.quote.eventId === null &&
    dataA.quote.eventType === "everyday" &&
    dataA.quote.leadSource === "referral" &&
    dataA.quote.leadSourceDetail === "Laura Martínez" &&
    Math.abs(dataA.quote.subtotal - expectedSubtotalA) < 0.01 &&
    Math.abs(dataA.quote.iva - expectedIvaA) < 0.01 &&
    Math.abs(dataA.quote.total - expectedTotalA) < 0.01 &&
    Math.abs(dataA.quote.depositRequired - expectedDepositA) < 0.01 &&
    dataA.quote.lines.length === 2 &&
    dataA.quote.lines[0].lineNumber === 1 &&
    dataA.quote.lines[1].lineNumber === 2
  if (!passA) {
    console.error("  FAIL: assertions did not pass")
    process.exit(1)
  }
  console.log("  ✓ All assertions passed")

  // Verify the quote appears on the /quotes page
  const quotesPageRes = await fetch("http://localhost:3000/quotes")
  const quotesPageText = await quotesPageRes.text()
  if (quotesPageText.includes(dataA.quote.quoteNumber)) {
    console.log(`  ✓ '${dataA.quote.quoteNumber}' appears on /quotes page`)
  } else {
    console.error(`  FAIL: '${dataA.quote.quoteNumber}' not visible on /quotes page`)
    process.exit(1)
  }

  // ── Test B: legacy backward-compat path ─────────────────────────
  console.log("\nTest B: Legacy path (only customerName + subtotal, no lineItems)")
  const payloadB = {
    customerName: "Smoke Test Customer B",
    eventType: "wedding",
    eventDate: "2026-12-15",
    subtotal: 5000,
    leadSource: "instagram",
  }
  const expectedSubtotalB = 5000
  const expectedIvaB = 800
  const expectedTotalB = 5800
  const expectedDepositB = 2900

  const resB = await fetch("http://localhost:3000/api/quotes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payloadB),
  })
  const dataB = await resB.json()
  if (!resB.ok) {
    console.error(`  FAIL: ${resB.status}`, dataB)
    process.exit(1)
  }
  TEST_QUOTE_NUMBERS.push(dataB.quote.quoteNumber)
  console.log(`  ✓ Created ${dataB.quote.quoteNumber}`)
  console.log(`    subtotal: $${dataB.quote.subtotal}  ← expected $${expectedSubtotalB}`)
  console.log(`    iva: $${dataB.quote.iva}  ← expected $${expectedIvaB}`)
  console.log(`    total: $${dataB.quote.total}  ← expected $${expectedTotalB}`)
  console.log(`    deposit: $${dataB.quote.depositRequired}  ← expected $${expectedDepositB}`)
  console.log(`    leadSourceDetail: ${dataB.quote.leadSourceDetail ?? "(null)"}  ← should be null`)

  const passB =
    Math.abs(dataB.quote.subtotal - expectedSubtotalB) < 0.01 &&
    Math.abs(dataB.quote.iva - expectedIvaB) < 0.01 &&
    Math.abs(dataB.quote.total - expectedTotalB) < 0.01 &&
    Math.abs(dataB.quote.depositRequired - expectedDepositB) < 0.01 &&
    dataB.quote.leadSourceDetail === null
  if (!passB) {
    console.error("  FAIL: assertions did not pass")
    process.exit(1)
  }
  console.log("  ✓ All assertions passed")

  // ── Test C: eventId validation ─────────────────────────────────
  if (event) {
    console.log("\nTest C: eventId validation (non-existent eventId → 404)")
    const payloadC = {
      customerName: "Smoke Test Customer C",
      eventId: "nonexistent-event-id",
      notes: TEST_MARKER,
    }
    const resC = await fetch("http://localhost:3000/api/quotes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payloadC),
    })
    if (resC.status !== 404) {
      const dataC = await resC.json()
      console.error(`  FAIL: expected 404, got ${resC.status}`, dataC)
      process.exit(1)
    }
    console.log("  ✓ Got 404 as expected")

    // Test C2: valid eventId
    console.log("\nTest C2: Valid eventId links successfully")
    const payloadC2 = {
      customerName: "Smoke Test Customer C2",
      eventId: event.id,
      quoteMode: "event",
      eventType: "wedding",
      notes: TEST_MARKER,
    }
    const resC2 = await fetch("http://localhost:3000/api/quotes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payloadC2),
    })
    const dataC2 = await resC2.json()
    if (!resC2.ok) {
      console.error(`  FAIL: ${resC2.status}`, dataC2)
      process.exit(1)
    }
    TEST_QUOTE_NUMBERS.push(dataC2.quote.quoteNumber)
    if (dataC2.quote.eventId !== event.id) {
      console.error(`  FAIL: eventId should be ${event.id}, got ${dataC2.quote.eventId}`)
      process.exit(1)
    }
    console.log(`  ✓ Quote ${dataC2.quote.quoteNumber} linked to event ${event.eventNumber}`)
  } else {
    console.log("\nSkipping Test C: no events in DB to test against")
  }

  // ── Test D: empty body validation ──────────────────────────────
  console.log("\nTest D: Empty body → 400 with clear error message")
  const resD = await fetch("http://localhost:3000/api/quotes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  })
  const dataD = await resD.json()
  if (resD.status !== 400) {
    console.error(`  FAIL: expected 400, got ${resD.status}`, dataD)
    process.exit(1)
  }
  if (!dataD.error?.includes("customerName")) {
    console.error(`  FAIL: error message should mention customerName, got: ${dataD.error}`)
    process.exit(1)
  }
  console.log(`  ✓ Got 400: "${dataD.error}"`)

  console.log("\n✓ All tests passed.")
}

main()
  .then(() => cleanup().then(() => process.exit(0)))
  .catch((e) => {
    console.error(e)
    cleanup().then(() => process.exit(1))
  })
