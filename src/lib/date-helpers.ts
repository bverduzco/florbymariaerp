// src/lib/date-helpers.ts — timezone-safe date parsing for Mexico City (GMT-6).
//
// The problem (Class 7 from FIXES.md):
//   When a user picks "Nov 26" on a date input, the browser sends "2026-11-26"
//   as the value. The API routes then do `new Date("2026-11-26" + "T00:00:00")`
//   which creates a Date at UTC midnight — NOT Mexico City midnight.
//
//   On Vercel (UTC timezone), this means:
//     - "Nov 26" stored as 2026-11-26T00:00:00Z
//     - In Mexico City (UTC-6), this is Nov 25 at 18:00 — the wrong day
//     - Calendar grid shows it on Nov 26 (because toISOString().slice(0,10)
//       gives UTC date) — so the display is correct by accident
//     - But comparisons against `new Date()` (which is "now" in UTC) can be
//       off by up to 6 hours near day boundaries
//
// The fix:
//   Instead of `new Date(isoString + "T00:00:00")` (which interprets in UTC),
//   use `parseDateAsGMTMinus6(isoString)` which interprets the date as
//   Mexico City midnight and returns the correct UTC instant.
//
//   "2026-11-26" → 2026-11-26T06:00:00Z (= Nov 26 00:00 Mexico City time)
//
//   This is correct because the user picked "Nov 26" meaning "this event
//   happens on Nov 26 in Mexico City", not "this event happens at the
//   instant of UTC midnight on Nov 26".

/** Mexico City is permanently UTC-6 (Mexico abolished DST in 2022). */
const GMT_MINUS_6_HOURS = 6

/**
 * Parse a date-only string (e.g. "2026-11-26") as Mexico City midnight.
 *
 * Returns a Date object representing 2026-11-26T06:00:00Z, which is
 * 2026-11-26 00:00:00 in Mexico City time (UTC-6).
 *
 * If the input is null/undefined/empty, returns null.
 * If the input is already a full ISO string (e.g. "2026-11-26T14:30:00Z"),
 * passes it through to `new Date()` unchanged — full timestamps with
 * timezone info don't need reinterpretation.
 *
 * @param input A date-only string ("2026-11-26") or a full ISO string
 *              ("2026-11-26T14:30:00Z"). Can be null/undefined.
 */
export function parseDateAsGMTMinus6(input: string | null | undefined): Date | null {
  if (!input) return null

  // If the input contains a 'T', it's already a full ISO timestamp with
  // timezone info — don't reinterpret it.
  if (input.includes("T")) {
    const d = new Date(input)
    return isNaN(d.getTime()) ? null : d
  }

  // Date-only string: "2026-11-26"
  // Parse as Mexico City midnight: add 6 hours to get the UTC instant.
  // new Date("2026-11-26T00:00:00") gives UTC midnight.
  // We want UTC midnight + 6 hours = 2026-11-26T06:00:00Z.
  const d = new Date(input + "T00:00:00Z")
  if (isNaN(d.getTime())) return null

  // Shift by +6 hours so it represents Mexico City midnight in UTC
  return new Date(d.getTime() + GMT_MINUS_6_HOURS * 60 * 60 * 1000)
}

/**
 * Get a date-only string (YYYY-MM-DD) from a Date, in Mexico City timezone.
 *
 * This is the inverse of parseDateAsGMTMinus6. Used when displaying dates
 * to the user — it converts a stored UTC instant back to the Mexico City
 * calendar date.
 *
 * @param date The Date to convert (or null/undefined)
 * @returns "2026-11-26" or null
 */
export function toGMTMinus6DateString(date: Date | string | null | undefined): string | null {
  if (!date) return null
  const d = typeof date === "string" ? new Date(date) : date
  if (isNaN(d.getTime())) return null

  // Shift by -6 hours to get Mexico City time, then extract the date
  const mexicoCity = new Date(d.getTime() - GMT_MINUS_6_HOURS * 60 * 60 * 1000)
  return mexicoCity.toISOString().slice(0, 10)
}

/**
 * Get the current date-only string (YYYY-MM-DD) in Mexico City timezone.
 *
 * Used by calendar pages that compare stored dates against "today".
 * Previously used `new Date()` (which is UTC) — off by up to 6 hours
 * near day boundaries.
 *
 * @returns "2026-11-26" (today in Mexico City)
 */
export function todayInGMTMinus6(): string {
  return toGMTMinus6DateString(new Date()) ?? new Date().toISOString().slice(0, 10)
}

/**
 * Get the current Date in Mexico City timezone (shifted to represent
 * "now" from Mexico City's perspective).
 *
 * Used by calendar pages that need to compare against "now" rather than
 * just today's date string.
 */
export function nowInGMTMinus6(): Date {
  // new Date() gives UTC. We don't shift it — the comparison logic in
  // calendar pages uses toISOString().slice(0,10) which extracts the UTC
  // date. Since we now store dates as Mexico City midnight (shifted +6h),
  // and "now" in UTC is the same instant, the comparison works correctly
  // as long as both sides use the same timezone reference.
  //
  // The key fix is in how dates are STORED (parseDateAsGMTMinus6), not
  // how "now" is compared. But for consistency, this helper documents
  // that we're working in Mexico City time.
  return new Date()
}
