/**
 * End-to-end smoke test for the v1.9 payment rules feature.
 *
 * Tests all 5 rule paths through the POST /api/quotes endpoint:
 *   A) quoteMode='no_event'                    → 100% COD, rule='no_event_cod'
 *   B) quoteMode='event', no eventDate         → 50% default + warning, rule='event_default_50pct'
 *   C) event > 6 months away                    → 30% deposit, rule='event_30pct'
 *   D) event ≤ 6 months, ≥ 2 weeks             → 50% deposit, rule='event_50pct'
 *   E) event < 2 weeks away, no override       → 422 decline
 *   F) event < 2 weeks away, WITH override     → 201, rule='event_declined_too_close', override logged
 *   G) Legacy backward-compat (no quoteMode)   → defaults to 'event' mode, 50% with no date
 *
 * Also verifies:
 *   - paymentRule is stored on the Quote row
 *   - quote detail page displays the rule label
 *   - POST /api/quote-lines recomputes deposit using the stored rule
 *
 * Cleans up after itself.
 */
import { db } from "../src/lib/db"

const TEST_QUOTE_NUMBERS: string[] = []
const TEST_MARKER = "smoke-test-payment-rules-v1.9"

// Fixed "now" for reproducible date math
const NOW = new Date()
function addDays(days: number): string {
  const d = new Date(NOW)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

async function cleanup() {
  if (TEST_QUOTE_NUMBERS.length === 0) return
  console.log(`\nCleanup: deleting ${TEST_QUOTE_NUMBERS.length} test quote(s)...`)
  await db.quoteLine.deleteMany({
    where: { quote: { quoteNumber: { in: TEST_QUOTE_NUMBERS } } },
  })
  await db.quote.deleteMany({
    where: { quoteNumber: { in: TEST_QUOTE_NUMBERS } },
  })
  console.log("  ✓ Cleaned up")
}

let pass = 0
let fail = 0
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a === e) {
    console.log(`  ✓ ${name}`)
    pass++
  } else {
    console.error(`  ✗ ${name}`)
    console.error(`    expected: ${e}`)
    console.error(`    actual:   ${a}`)
    fail++
  }
}

async function main() {
  const basePayload = {
    customerName: "Payment Rules Test",
    notes: TEST_MARKER,
    subtotal: 1000, // → total = 1000 + 160 IVA = 1160
  }
  const EXPECTED_TOTAL = 1160

  // ── Test A: No event → 100% COD ──────────────────────────
  console.log("\nTest A: quoteMode='no_event' → 100% COD")
  const resA = await fetch("http://localhost:3000/api/quotes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...basePayload, quoteMode: "no_event", eventType: "everyday" }),
  })
  const dataA = await resA.json()
  check("status 201", resA.status, 201)
  check("quote.paymentRule", dataA.quote.paymentRule, "no_event_cod")
  check("quote.depositRequired", dataA.quote.depositRequired, EXPECTED_TOTAL) // 100% = full total
  check("response.paymentRule.rule", dataA.paymentRule?.rule, "no_event_cod")
  check("response.paymentRule.depositPct", dataA.paymentRule?.depositPct, 1.0)
  check("response.paymentRule.decline", dataA.paymentRule?.decline, false)
  TEST_QUOTE_NUMBERS.push(dataA.quote.quoteNumber)
  console.log(`  → Created ${dataA.quote.quoteNumber}, deposit=$${dataA.quote.depositRequired}`)

  // ── Test B: Event mode, no date → 50% + warning ──────────
  console.log("\nTest B: quoteMode='event', no eventDate → 50% default + warning")
  const resB = await fetch("http://localhost:3000/api/quotes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...basePayload, quoteMode: "event", eventType: "wedding" }),
  })
  const dataB = await resB.json()
  check("status 201", resB.status, 201)
  check("quote.paymentRule", dataB.quote.paymentRule, "event_default_50pct")
  check("quote.depositRequired", dataB.quote.depositRequired, EXPECTED_TOTAL * 0.5) // 580
  check("response.paymentRule.warning exists", !!dataB.paymentRule?.warning, true)
  TEST_QUOTE_NUMBERS.push(dataB.quote.quoteNumber)
  console.log(`  → Created ${dataB.quote.quoteNumber}, deposit=$${dataB.quote.depositRequired}`)

  // ── Test C: Event > 6 months → 30% ──────────────────────
  console.log("\nTest C: event > 6 months away → 30% deposit")
  // NOTE: using lineItems (not subtotal) so the subtotal is backed by actual
  // QuoteLine rows. This matters for Test I below — adding a line via
  // /api/quote-lines sums existing rows. If we used subtotal=1000 with no
  // lineItems, the rows would be empty and the deposit math would be wrong.
  // (This is a pre-existing API quirk, not a payment-rules bug.)
  const resC = await fetch("http://localhost:3000/api/quotes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...basePayload,
      subtotal: undefined, // override — use lineItems instead
      quoteMode: "event",
      eventType: "wedding",
      eventDate: addDays(200), // > 183 days
      lineItems: [
        { description: "Test line", qty: 1, unitPrice: 1000 },
      ],
    }),
  })
  const dataC = await resC.json()
  check("status 201", resC.status, 201)
  check("quote.paymentRule", dataC.quote.paymentRule, "event_30pct")
  check("quote.depositRequired", dataC.quote.depositRequired, EXPECTED_TOTAL * 0.3) // 348
  check("quote.lines.length", dataC.quote.lines?.length, 1)
  TEST_QUOTE_NUMBERS.push(dataC.quote.quoteNumber)
  console.log(`  → Created ${dataC.quote.quoteNumber}, deposit=$${dataC.quote.depositRequired}`)

  // ── Test D: Event ≤ 6 months, ≥ 2 weeks → 50% ───────────
  console.log("\nTest D: event 90 days away → 50% deposit")
  const resD = await fetch("http://localhost:3000/api/quotes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...basePayload,
      quoteMode: "event",
      eventType: "wedding",
      eventDate: addDays(90),
    }),
  })
  const dataD = await resD.json()
  check("status 201", resD.status, 201)
  check("quote.paymentRule", dataD.quote.paymentRule, "event_50pct")
  check("quote.depositRequired", dataD.quote.depositRequired, EXPECTED_TOTAL * 0.5) // 580
  TEST_QUOTE_NUMBERS.push(dataD.quote.quoteNumber)
  console.log(`  → Created ${dataD.quote.quoteNumber}, deposit=$${dataD.quote.depositRequired}`)

  // ── Test E: Event < 2 weeks, NO override → 422 decline ─
  console.log("\nTest E: event 5 days away, no override → 422 decline")
  const resE = await fetch("http://localhost:3000/api/quotes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...basePayload,
      quoteMode: "event",
      eventType: "wedding",
      eventDate: addDays(5),
    }),
  })
  const dataE = await resE.json()
  check("status 422", resE.status, 422)
  check("error.paymentRule", dataE.paymentRule, "event_declined_too_close")
  check("error.warning exists", !!dataE.warning, true)
  check("error.hint exists", !!dataE.hint, true)
  console.log(`  → Got 422: "${dataE.error}"`)

  // ── Test F: Event < 2 weeks, WITH override → 201 + audit log ──
  console.log("\nTest F: event 5 days away, WITH override → 201, override logged in notes")
  const resF = await fetch("http://localhost:3000/api/quotes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...basePayload,
      quoteMode: "event",
      eventType: "wedding",
      eventDate: addDays(5),
      overrideDecline: true,
    }),
  })
  const dataF = await resF.json()
  check("status 201", resF.status, 201)
  check("quote.paymentRule", dataF.quote.paymentRule, "event_declined_too_close")
  check("quote.depositRequired", dataF.quote.depositRequired, EXPECTED_TOTAL * 0.5) // 580 (would-be deposit)
  check("quote.notes contains OVERRIDE marker", dataF.quote.notes?.includes("[OVERRIDE:"), true)
  check("response.paymentRule.overridden", dataF.paymentRule?.overridden, true)
  TEST_QUOTE_NUMBERS.push(dataF.quote.quoteNumber)
  console.log(`  → Created ${dataF.quote.quoteNumber}, deposit=$${dataF.quote.depositRequired}`)
  console.log(`  → Notes: "${dataF.quote.notes}"`)

  // ── Test G: Legacy backward-compat (no quoteMode) ────────
  console.log("\nTest G: Legacy path (no quoteMode) → defaults to 'event', 50% with no date")
  const resG = await fetch("http://localhost:3000/api/quotes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      customerName: "Payment Rules Legacy Test",
      notes: TEST_MARKER,
      subtotal: 1000,
      eventType: "wedding",
      // No quoteMode, no eventDate
    }),
  })
  const dataG = await resG.json()
  check("status 201", resG.status, 201)
  check("quote.paymentRule (default)", dataG.quote.paymentRule, "event_default_50pct")
  check("quote.depositRequired", dataG.quote.depositRequired, EXPECTED_TOTAL * 0.5) // 580
  TEST_QUOTE_NUMBERS.push(dataG.quote.quoteNumber)
  console.log(`  → Created ${dataG.quote.quoteNumber}, deposit=$${dataG.quote.depositRequired}`)

  // ── Test H: Quote detail page shows the rule label ──────
  console.log("\nTest H: Quote detail page renders the payment rule label")
  const quoteId = dataA.quote.id
  const detailRes = await fetch(`http://localhost:3000/quotes/${quoteId}/`)
  const detailHtml = await detailRes.text()
  check("detail page status 200", detailRes.status, 200)
  check("renders 'Payment rule applied'", detailHtml.includes("Payment rule applied"), true)
  check("renders rule code 'no_event_cod'", detailHtml.includes("no_event_cod"), true)
  check("renders '100% upfront'", detailHtml.includes("100% upfront"), true)
  console.log(`  → Detail page for ${dataA.quote.quoteNumber} shows the rule`)

  // ── Test I: POST /api/quote-lines preserves the rule ────
  console.log("\nTest I: Adding a line via /api/quote-lines preserves the stored rule")
  // Use quote C (30% rule) — adding a line should keep deposit at 30% of new total
  const quoteCId = dataC.quote.id
  const lineRes = await fetch("http://localhost:3000/api/quote-lines", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      quoteId: quoteCId,
      description: "Test line item",
      qty: 1,
      unitPrice: 500,
    }),
  })
  const lineData = await lineRes.json()
  check("quote-lines status 201", lineRes.status, 201)
  // New total = (1000 + 500) * 1.16 = 1740. Deposit at 30% = 522.
  check("new deposit uses stored 30% rule", lineData.quoteTotals?.depositRequired, 1740 * 0.3)
  check("quoteTotals.paymentRule preserved", lineData.quoteTotals?.paymentRule, "event_30pct")
  check("quoteTotals.depositPct preserved", lineData.quoteTotals?.depositPct, 0.3)
  console.log(`  → New deposit = $${lineData.quoteTotals?.depositRequired} (30% of $1740)`)

  // ── Test J: Legacy subtotal path no longer corrupts data ───
  console.log("\nTest J: Legacy subtotal path — placeholder line + correct add via /api/quote-lines")
  // Bug: previously, creating a quote with subtotal=1000 + no lineItems would
  // store subtotal=$1000 on the Quote row but create ZERO QuoteLine rows.
  // Later adding a $500 line via /api/quote-lines would recompute subtotal =
  // sum(existing QuoteLine.lineTotal) = $500 (REPLACING $1000, not adding).
  // Fix: create one placeholder QuoteLine backing the manual subtotal.
  const resJ = await fetch("http://localhost:3000/api/quotes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...basePayload,
      quoteMode: "no_event", // 100% COD
      // No lineItems — exercises legacy subtotal path
    }),
  })
  const dataJ = await resJ.json()
  check("status 201", resJ.status, 201)
  check("quote.paymentRule (no_event)", dataJ.quote.paymentRule, "no_event_cod")
  check("quote.subtotal preserved", dataJ.quote.subtotal, 1000)
  check("quote has placeholder line", dataJ.quote.lines?.length, 1)
  check("placeholder desc", dataJ.quote.lines?.[0]?.description, "(Manual opening balance — no line items specified)")
  check("placeholder lineTotal", dataJ.quote.lines?.[0]?.lineTotal, 1000)
  check("deposit = full total (COD)", dataJ.quote.depositRequired, EXPECTED_TOTAL) // 1160

  // Now add a $500 line — should ADD to the placeholder, not replace it
  const lineResJ = await fetch("http://localhost:3000/api/quote-lines", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      quoteId: dataJ.quote.id,
      description: "Real line item",
      qty: 1,
      unitPrice: 500,
    }),
  })
  const lineDataJ = await lineResJ.json()
  check("quote-lines status 201", lineResJ.status, 201)
  check("subtotal ADDED (not replaced)", lineDataJ.quoteTotals?.subtotal, 1500)
  check("total correct", lineDataJ.quoteTotals?.total, 1740)
  check("deposit = full new total (COD)", lineDataJ.quoteTotals?.depositRequired, 1740)
  TEST_QUOTE_NUMBERS.push(dataJ.quote.quoteNumber)
  console.log(`  → Created ${dataJ.quote.quoteNumber} with placeholder + added line`)
  console.log(`  → Subtotal went 1000 → 1500 (added, not replaced) ✓`)

  // ── Summary ──────────────────────────────────────────────
  console.log(`\n${pass} passed, ${fail} failed`)
  if (fail > 0) process.exit(1)
}

main()
  .then(() => cleanup().then(() => process.exit(0)))
  .catch((e) => {
    console.error(e)
    cleanup().then(() => process.exit(1))
  })
