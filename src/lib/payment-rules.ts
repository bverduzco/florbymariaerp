/**
 * Payment rules for quotes — single source of truth.
 *
 * Used by:
 *   - POST /api/quotes (compute deposit at creation)
 *   - POST /api/quote-lines (recompute deposit after adding a line)
 *   - New Quote dialog (live preview)
 *   - Catalogue → Add to Quote → New mode (live preview)
 *   - Quote detail page (display the rule applied)
 *   - Future: customer-facing PDF quote
 *
 * Rules (per Maria's spec):
 *   - No event (everyday order)       → 100% upfront (COD)
 *   - Event > 6 months away           → 30% deposit
 *   - Event ≤ 6 months, > 2 weeks     → 50% deposit
 *   - Event ≤ 2 weeks away            → DECLINE (warn + override allowed in UI)
 *   - quoteMode=event but no eventDate → 50% default + warning
 */

// ───────────────────────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────────────────────
export type QuoteMode = "event" | "no_event"

export type PaymentRuleValue =
  | "no_event_cod"
  | "event_30pct"
  | "event_50pct"
  | "event_declined_too_close"
  | "event_default_50pct"

export type PaymentRule = {
  /** Stable identifier stored on Quote.paymentRule (e.g. "event_50pct") */
  rule: PaymentRuleValue
  /** Deposit fraction of the total: 0.3, 0.5, or 1.0 */
  depositPct: number
  /** Customer-facing label, e.g. "50% deposit (event ≤ 6 months)" */
  label: string
  /** Short label for the deposit cell in the UI, e.g. "Deposit (50%)" */
  shortLabel: string
  /** True when the event is <2 weeks away — UI shows override checkbox */
  decline: boolean
  /** Optional soft warning (e.g. "No event date — using 50% as default") */
  warning?: string
}

// ───────────────────────────────────────────────────────────────────────────
// Thresholds (in days)
// ───────────────────────────────────────────────────────────────────────────
export const SIX_MONTHS_DAYS = 183 // ~6 months
export const TWO_WEEKS_DAYS = 14

// ───────────────────────────────────────────────────────────────────────────
// Main helper
// ───────────────────────────────────────────────────────────────────────────
/**
 * Compute the payment rule for a quote based on its mode + event date.
 *
 * @param quoteMode "event" | "no_event"
 * @param eventDate ISO string | Date | null | undefined
 * @param now       Optional reference date (defaults to now); injected for tests
 */
export function computePaymentRule(
  quoteMode: QuoteMode | string | null | undefined,
  eventDate: string | Date | null | undefined,
  now: Date = new Date()
): PaymentRule {
  // ── No event → 100% COD upfront ────────────────────────────
  if (quoteMode !== "event") {
    return {
      rule: "no_event_cod",
      depositPct: 1.0,
      label: "100% upfront (everyday order, COD)",
      shortLabel: "Deposit (100% COD)",
      decline: false,
    }
  }

  // ── Event mode but no date → default to 50% + warning ──────
  if (!eventDate) {
    return {
      rule: "event_default_50pct",
      depositPct: 0.5,
      label: "50% deposit (default — no event date set)",
      shortLabel: "Deposit (50% default)",
      decline: false,
      warning:
        "No event date set — using 50% as default. Set a date to apply the correct rule.",
    }
  }

  // ── Compute days from now to event date ────────────────────
  const eventDateObj = eventDate instanceof Date ? eventDate : new Date(eventDate)
  if (Number.isNaN(eventDateObj.getTime())) {
    // Invalid date string → treat as no date
    return {
      rule: "event_default_50pct",
      depositPct: 0.5,
      label: "50% deposit (default — invalid event date)",
      shortLabel: "Deposit (50% default)",
      decline: false,
      warning: "Event date is invalid — using 50% as default.",
    }
  }

  // Use midnight-to-midnight comparison so a quote created on the event date
  // itself counts as 0 days away (not negative due to hour-level precision).
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const eventMidnight = new Date(
    eventDateObj.getFullYear(),
    eventDateObj.getMonth(),
    eventDateObj.getDate()
  )
  const msPerDay = 24 * 60 * 60 * 1000
  const daysUntil = Math.round((eventMidnight.getTime() - todayMidnight.getTime()) / msPerDay)

  // ── Event ≤ 2 weeks away → DECLINE ─────────────────────────
  if (daysUntil < TWO_WEEKS_DAYS) {
    return {
      rule: "event_declined_too_close",
      depositPct: 0.5, // would-be deposit if overridden
      label: `Event is ${daysUntil < 0 ? "in the past" : daysUntil === 0 ? "today" : `${daysUntil} day(s) away`} — must decline`,
      shortLabel: "⚠ Must decline",
      decline: true,
      warning:
        daysUntil < 0
          ? `Event date has already passed (${eventDateObj.toLocaleDateString("es-MX")}). Must decline — override only if you're certain.`
          : daysUntil === 0
            ? "Event is today. Must decline — override only if you're certain."
            : `Event is only ${daysUntil} day(s) away (less than 2 weeks). Must decline — override only if you're certain.`,
    }
  }

  // ── Event > 6 months away → 30% deposit ───────────────────
  if (daysUntil > SIX_MONTHS_DAYS) {
    return {
      rule: "event_30pct",
      depositPct: 0.3,
      label: `30% deposit (event in ${Math.round(daysUntil / 30)} months)`,
      shortLabel: "Deposit (30%)",
      decline: false,
    }
  }

  // ── Event ≤ 6 months, > 2 weeks → 50% deposit ─────────────
  return {
    rule: "event_50pct",
    depositPct: 0.5,
    label:
      daysUntil > 60
        ? `50% deposit (event in ${Math.round(daysUntil / 30)} months)`
        : `50% deposit (event in ${daysUntil} days)`,
    shortLabel: "Deposit (50%)",
    decline: false,
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Convenience: compute the deposit amount for a given total
// ───────────────────────────────────────────────────────────────────────────
export function computeDepositAmount(
  total: number,
  quoteMode: QuoteMode | string | null | undefined,
  eventDate: string | Date | null | undefined,
  now: Date = new Date()
): { amount: number; rule: PaymentRule } {
  const rule = computePaymentRule(quoteMode, eventDate, now)
  return { amount: total * rule.depositPct, rule }
}

// ───────────────────────────────────────────────────────────────────────────
// Label lookup for stored rule values (when displaying an existing quote)
// ───────────────────────────────────────────────────────────────────────────
const RULE_LABELS: Record<PaymentRuleValue, { label: string; shortLabel: string; depositPct: number }> = {
  no_event_cod: {
    label: "100% upfront (everyday order, COD)",
    shortLabel: "Deposit (100% COD)",
    depositPct: 1.0,
  },
  event_30pct: {
    label: "30% deposit (event > 6 months)",
    shortLabel: "Deposit (30%)",
    depositPct: 0.3,
  },
  event_50pct: {
    label: "50% deposit (event ≤ 6 months)",
    shortLabel: "Deposit (50%)",
    depositPct: 0.5,
  },
  event_default_50pct: {
    label: "50% deposit (default — no event date)",
    shortLabel: "Deposit (50% default)",
    depositPct: 0.5,
  },
  event_declined_too_close: {
    label: "Declined (event < 2 weeks away)",
    shortLabel: "⚠ Must decline",
    depositPct: 0.5,
  },
}

/**
 * Look up the label + depositPct for a stored `Quote.paymentRule` value.
 * Used by the quote detail page + future PDF to display the rule that was
 * applied when the quote was created (regardless of current event date).
 *
 * Falls back to a generic "50%" if the stored value is unrecognized (e.g.
 * for old quotes created before this feature, where paymentRule is null).
 */
export function lookupPaymentRule(
  paymentRule: string | null | undefined
): { label: string; shortLabel: string; depositPct: number } {
  if (!paymentRule) {
    return {
      label: "50% deposit (legacy quote — rule not recorded)",
      shortLabel: "Deposit (50%)",
      depositPct: 0.5,
    }
  }
  return RULE_LABELS[paymentRule as PaymentRuleValue] ?? {
    label: `Unknown rule: ${paymentRule}`,
    shortLabel: "Deposit (?)",
    depositPct: 0.5,
  }
}
