/**
 * Sanity test for computePaymentRule.
 * Verifies all 5 rule paths + edge cases.
 *
 * Run with: npx tsx scripts/payment-rules-sanity-test.ts
 */
import {
  computePaymentRule,
  computeDepositAmount,
  lookupPaymentRule,
  SIX_MONTHS_DAYS,
  TWO_WEEKS_DAYS,
} from "../src/lib/payment-rules"

const NOW = new Date("2026-11-01T12:00:00Z") // fixed reference for reproducible tests

function addDays(days: number): string {
  const d = new Date(NOW)
  d.setDate(d.getDate() + days)
  return d.toISOString()
}

let pass = 0
let fail = 0

function check(name: string, actual: unknown, expected: unknown) {
  const actualStr = JSON.stringify(actual)
  const expectedStr = JSON.stringify(expected)
  if (actualStr === expectedStr) {
    console.log(`  ✓ ${name}`)
    pass++
  } else {
    console.error(`  ✗ ${name}`)
    console.error(`    expected: ${expectedStr}`)
    console.error(`    actual:   ${actualStr}`)
    fail++
  }
}

console.log("Payment rules sanity test")
console.log(`Reference "now": ${NOW.toISOString()}`)
console.log(`Thresholds: SIX_MONTHS=${SIX_MONTHS_DAYS} days, TWO_WEEKS=${TWO_WEEKS_DAYS} days`)
console.log("")

// ── Test 1: No event → 100% COD ──────────────────────────────
console.log("Test 1: quoteMode='no_event' → 100% COD")
const r1 = computePaymentRule("no_event", null, NOW)
check("rule", r1.rule, "no_event_cod")
check("depositPct", r1.depositPct, 1.0)
check("decline", r1.decline, false)

// ── Test 2: Event mode, no date → 50% + warning ──────────────
console.log("\nTest 2: quoteMode='event', no eventDate → 50% default + warning")
const r2 = computePaymentRule("event", null, NOW)
check("rule", r2.rule, "event_default_50pct")
check("depositPct", r2.depositPct, 0.5)
check("decline", r2.decline, false)
check("hasWarning", !!r2.warning, true)

// ── Test 3: Event > 6 months away → 30% ─────────────────────
console.log(`\nTest 3: event ${SIX_MONTHS_DAYS + 30} days away (>6 months) → 30%`)
const r3 = computePaymentRule("event", addDays(SIX_MONTHS_DAYS + 30), NOW)
check("rule", r3.rule, "event_30pct")
check("depositPct", r3.depositPct, 0.3)
check("decline", r3.decline, false)

// ── Test 4: Event exactly 6 months away (boundary) → 50% ────
console.log(`\nTest 4: event exactly ${SIX_MONTHS_DAYS} days away (boundary) → 50%`)
const r4 = computePaymentRule("event", addDays(SIX_MONTHS_DAYS), NOW)
check("rule", r4.rule, "event_50pct")
check("depositPct", r4.depositPct, 0.5)

// ── Test 5: Event 3 months away → 50% ───────────────────────
console.log("\nTest 5: event 90 days away (3 months) → 50%")
const r5 = computePaymentRule("event", addDays(90), NOW)
check("rule", r5.rule, "event_50pct")
check("depositPct", r5.depositPct, 0.5)

// ── Test 6: Event exactly 2 weeks away (boundary) → still 50% (decline is < 2 weeks) ─
console.log(`\nTest 6: event exactly ${TWO_WEEKS_DAYS} days away (boundary) → still 50% (decline is strictly < 2 weeks)`)
const r6 = computePaymentRule("event", addDays(TWO_WEEKS_DAYS), NOW)
check("rule", r6.rule, "event_50pct")
check("depositPct", r6.depositPct, 0.5)
check("decline", r6.decline, false)

// ── Test 6b: Event 13 days away (just under 2 weeks) → DECLINE ─
console.log(`\nTest 6b: event ${TWO_WEEKS_DAYS - 1} days away (just under 2 weeks) → DECLINE`)
const r6b = computePaymentRule("event", addDays(TWO_WEEKS_DAYS - 1), NOW)
check("rule", r6b.rule, "event_declined_too_close")
check("decline", r6b.decline, true)
check("hasWarning", !!r6b.warning, true)

// ── Test 7: Event 5 days away → DECLINE ─────────────────────
console.log("\nTest 7: event 5 days away → DECLINE")
const r7 = computePaymentRule("event", addDays(5), NOW)
check("rule", r7.rule, "event_declined_too_close")
check("decline", r7.decline, true)

// ── Test 8: Event today → DECLINE ────────────────────────────
console.log("\nTest 8: event today (0 days) → DECLINE")
const r8 = computePaymentRule("event", addDays(0), NOW)
check("rule", r8.rule, "event_declined_too_close")
check("decline", r8.decline, true)

// ── Test 9: Event in the past → DECLINE ─────────────────────
console.log("\nTest 9: event in the past (negative days) → DECLINE")
const r9 = computePaymentRule("event", addDays(-7), NOW)
check("rule", r9.rule, "event_declined_too_close")
check("decline", r9.decline, true)

// ── Test 10: Invalid date string → 50% default + warning ───
console.log("\nTest 10: invalid eventDate string → 50% default + warning")
const r10 = computePaymentRule("event", "not-a-date", NOW)
check("rule", r10.rule, "event_default_50pct")
check("hasWarning", !!r10.warning, true)

// ── Test 11: computeDepositAmount ───────────────────────────
console.log("\nTest 11: computeDepositAmount")
const da1 = computeDepositAmount(1000, "no_event", null, NOW)
check("COD amount", da1.amount, 1000)
check("COD rule", da1.rule.rule, "no_event_cod")

const da2 = computeDepositAmount(1000, "event", addDays(SIX_MONTHS_DAYS + 30), NOW)
check("30% amount", da2.amount, 300)
check("30% rule", da2.rule.rule, "event_30pct")

const da3 = computeDepositAmount(1000, "event", addDays(90), NOW)
check("50% amount", da3.amount, 500)
check("50% rule", da3.rule.rule, "event_50pct")

// ── Test 12: lookupPaymentRule for stored values ────────────
console.log("\nTest 12: lookupPaymentRule (for displaying existing quotes)")
check(
  "no_event_cod",
  lookupPaymentRule("no_event_cod").depositPct,
  1.0
)
check("event_30pct", lookupPaymentRule("event_30pct").depositPct, 0.3)
check("event_50pct", lookupPaymentRule("event_50pct").depositPct, 0.5)
check("event_default_50pct", lookupPaymentRule("event_default_50pct").depositPct, 0.5)
check(
  "event_declined_too_close",
  lookupPaymentRule("event_declined_too_close").depositPct,
  0.5
)
check("null (legacy)", lookupPaymentRule(null).depositPct, 0.5)
check("undefined (legacy)", lookupPaymentRule(undefined).depositPct, 0.5)
check("unknown value (fallback)", lookupPaymentRule("garbage").depositPct, 0.5)

// ── Test 13: Date-as-Date object (not string) ───────────────
console.log("\nTest 13: eventDate as Date object (not string)")
const r13 = computePaymentRule("event", new Date(addDays(90)), NOW)
check("rule", r13.rule, "event_50pct")

// ── Summary ─────────────────────────────────────────────────
console.log(`\n${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
