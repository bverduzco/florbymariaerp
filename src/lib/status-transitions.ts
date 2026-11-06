// src/lib/status-transitions.ts — canonical status pipelines + validators.
//
// Centralizes the business rules for which status transitions are allowed
// for Orders and Events. Both the dedicated /status endpoints and the
// general PATCH endpoints call these validators so the rules can't drift.
//
// Design:
//   - Orders follow a linear pipeline: draft → quote_sent → ... → fulfilled.
//     Cancellation is allowed from any non-terminal state.
//     Going backwards (e.g. fulfilled → draft) is NOT allowed.
//   - Events follow a simpler pipeline: quote → confirmed → in_progress → completed.
//     Cancellation is allowed from any non-terminal state.
//   - Terminal states (fulfilled, cancelled, completed) are locked — once
//     an order/event reaches them, it can't be moved back without an
//     explicit admin override (future: ?force=true).

// ───────────────────────────────────────────────────────────────────────────
// Order status pipeline
// ───────────────────────────────────────────────────────────────────────────

export const ORDER_PIPELINE = [
  "draft",
  "quote_sent",
  "awaiting_payment",
  "payment_confirmed",
  "procuring",
  "producing",
  "delivered",
  "fulfilled",
] as const

export const ORDER_TERMINAL_STATES = ["fulfilled", "cancelled"] as const

export const ORDER_VALID_STATUSES = [...ORDER_PIPELINE, "cancelled"] as const

export type OrderStatus = (typeof ORDER_VALID_STATUSES)[number]

/**
 * Check if an order status transition is valid.
 *
 * Rules:
 *   1. Same status → OK (no-op, e.g. refreshing the page)
 *   2. → "cancelled" → OK from any non-terminal state
 *   3. Forward in the pipeline (e.g. draft → quote_sent) → OK
 *   4. Backward (e.g. fulfilled → draft) → NOT allowed
 *   5. From a terminal state (fulfilled, cancelled) → NOT allowed (except same-status no-op)
 *   6. Skipping steps forward (e.g. draft → delivered) → OK
 *      (Maria might mark an order as delivered without going through every
 *       intermediate step — common for quick everyday orders)
 *
 * @returns { valid: boolean, reason?: string }
 */
export function isValidOrderTransition(
  from: string,
  to: string,
): { valid: boolean; reason?: string } {
  // Rule 1: same status is always a no-op
  if (from === to) return { valid: true }

  // Rule 5: can't transition FROM a terminal state
  if (ORDER_TERMINAL_STATES.includes(from as typeof ORDER_TERMINAL_STATES[number])) {
    return {
      valid: false,
      reason: `Cannot change status from terminal state "${from}". Once an order is ${from}, it's locked.`,
    }
  }

  // Rule 2: cancellation from any non-terminal state
  if (to === "cancelled") return { valid: true }

  // Rule 3+6: forward in pipeline (including skips) is OK
  const fromIdx = ORDER_PIPELINE.indexOf(from as typeof ORDER_PIPELINE[number])
  const toIdx = ORDER_PIPELINE.indexOf(to as typeof ORDER_PIPELINE[number])

  if (fromIdx === -1) {
    return {
      valid: false,
      reason: `Current status "${from}" is not in the canonical pipeline. Valid: ${ORDER_VALID_STATUSES.join(", ")}`,
    }
  }

  if (toIdx === -1) {
    return {
      valid: false,
      reason: `Target status "${to}" is not valid. Valid: ${ORDER_VALID_STATUSES.join(", ")}`,
    }
  }

  // Forward (or same — but same is already handled above)
  if (toIdx > fromIdx) return { valid: true }

  // Rule 4: backward transition
  return {
    valid: false,
    reason: `Cannot move backward from "${from}" to "${to}". The pipeline only goes forward. To revert, cancel the order and create a new one.`,
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Event status pipeline
// ───────────────────────────────────────────────────────────────────────────

export const EVENT_PIPELINE = [
  "quote",
  "confirmed",
  "in_progress",
  "completed",
] as const

export const EVENT_TERMINAL_STATES = ["completed", "cancelled"] as const

export const EVENT_VALID_STATUSES = [...EVENT_PIPELINE, "cancelled"] as const

export type EventStatus = (typeof EVENT_VALID_STATUSES)[number]

/**
 * Check if an event status transition is valid.
 *
 * Same rules as orders but with the event pipeline:
 *   quote → confirmed → in_progress → completed
 *   + cancellation from any non-terminal state
 */
export function isValidEventTransition(
  from: string,
  to: string,
): { valid: boolean; reason?: string } {
  // Same status → no-op
  if (from === to) return { valid: true }

  // Can't transition FROM a terminal state
  if (EVENT_TERMINAL_STATES.includes(from as typeof EVENT_TERMINAL_STATES[number])) {
    return {
      valid: false,
      reason: `Cannot change status from terminal state "${from}". Once an event is ${from}, it's locked.`,
    }
  }

  // Cancellation from any non-terminal state
  if (to === "cancelled") return { valid: true }

  // Forward in pipeline (including skips)
  const fromIdx = EVENT_PIPELINE.indexOf(from as typeof EVENT_PIPELINE[number])
  const toIdx = EVENT_PIPELINE.indexOf(to as typeof EVENT_PIPELINE[number])

  if (fromIdx === -1) {
    return {
      valid: false,
      reason: `Current status "${from}" is not in the canonical pipeline. Valid: ${EVENT_VALID_STATUSES.join(", ")}`,
    }
  }

  if (toIdx === -1) {
    return {
      valid: false,
      reason: `Target status "${to}" is not valid. Valid: ${EVENT_VALID_STATUSES.join(", ")}`,
    }
  }

  if (toIdx > fromIdx) return { valid: true }

  // Backward
  return {
    valid: false,
    reason: `Cannot move backward from "${from}" to "${to}". The pipeline only goes forward. To revert, cancel the event and create a new one.`,
  }
}
