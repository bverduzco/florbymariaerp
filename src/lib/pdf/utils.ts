// src/lib/pdf/utils.ts — shared helpers for PDF generation
//
// Used by both the Recibo and Shopping List generators.
// Keeps GMT-6 (Mexico City) timestamp logic in one place so we never drift
// between the two PDFs.

// Mexico City is permanently UTC-6 (no DST since 2022).
// We hard-code the offset rather than using Intl.DateTimeFormat with timezone
// "America/Mexico_City" because:
//   1. It's simpler and faster
//   2. Mexico abolished DST in 2022, so the offset is stable
//   3. We avoid any Node.js Intl timezone database issues on Vercel's
//      serverless functions

export const GMT_MINUS_6_OFFSET = -6 // hours

// ───────────────────────────────────────────────────────────────────────────
// Page size — Letter is the standard in Mexico (and the US).
// A4 = 595 × 842 pt. Letter = 612 × 792 pt.
// All PDF generators (recibo, shopping-list, quote) use these constants so
// the page size + background band width stay in sync.
// ───────────────────────────────────────────────────────────────────────────
export const PAGE_SIZE = "LETTER" as const
export const PAGE_WIDTH_PT = 612 // Letter width in points (used for background canvas rects)
export const HEADER_BAND_HEIGHT_PT = 22 // height of the rose top band

export const MESES_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
] as const

/**
 * Format a Date in GMT-6 as "23 de octubre de 2026".
 * Used for the Recibo's "Fecha de emisión" and "Fecha de entrega".
 */
export function formatSpanishLong(date: Date | string | null | undefined): string {
  if (!date) return "—"
  const d = typeof date === "string" ? new Date(date) : date
  if (isNaN(d.getTime())) return "—"
  // Convert to GMT-6
  const gmtMinus6 = new Date(d.getTime() + GMT_MINUS_6_OFFSET * 60 * 60 * 1000)
  return `${gmtMinus6.getUTCDate()} de ${MESES_ES[gmtMinus6.getUTCMonth()]} de ${gmtMinus6.getUTCFullYear()}`
}

/**
 * Format a Date in GMT-6 as "23/10/2026".
 * Used for shorter date displays.
 */
export function formatSpanishShort(date: Date | string | null | undefined): string {
  if (!date) return "—"
  const d = typeof date === "string" ? new Date(date) : date
  if (isNaN(d.getTime())) return "—"
  const gmtMinus6 = new Date(d.getTime() + GMT_MINUS_6_OFFSET * 60 * 60 * 1000)
  const dd = String(gmtMinus6.getUTCDate()).padStart(2, "0")
  const mm = String(gmtMinus6.getUTCMonth() + 1).padStart(2, "0")
  return `${dd}/${mm}/${gmtMinus6.getUTCFullYear()}`
}

/**
 * Format the current time in GMT-6 as "23/10/2026 14:35".
 * Used for the Shopping List "Generated" footer and subtitle.
 */
export function nowGmtMinus6Label(): string {
  const now = new Date(Date.now() + GMT_MINUS_6_OFFSET * 60 * 60 * 1000)
  const dd = String(now.getUTCDate()).padStart(2, "0")
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0")
  const yyyy = now.getUTCFullYear()
  const hh = String(now.getUTCHours()).padStart(2, "0")
  const min = String(now.getUTCMinutes()).padStart(2, "0")
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`
}

/**
 * Format the current time in GMT-6 as "2026-10-23 14.35" — safe for filenames
 * (colon replaced with dot since Windows forbids colons in file names).
 */
export function nowGmtMinus6FileStamp(): string {
  const now = new Date(Date.now() + GMT_MINUS_6_OFFSET * 60 * 60 * 1000)
  const yyyy = now.getUTCFullYear()
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0")
  const dd = String(now.getUTCDate()).padStart(2, "0")
  const hh = String(now.getUTCHours()).padStart(2, "0")
  const min = String(now.getUTCMinutes()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd} ${hh}.${min}`
}

/**
 * Compute the date range label for a week.
 * Input: ISO date string for Monday (yyyy-mm-dd).
 * Output: "Week of 26/10/2026 – 01/11/2026"
 */
export function weekRangeLabel(weekStartDate: string | null | undefined): string {
  if (!weekStartDate) {
    // Fall back to the current GMT-6 week (Mon–Sun)
    const now = new Date(Date.now() + GMT_MINUS_6_OFFSET * 60 * 60 * 1000)
    const dayOfWeek = now.getUTCDay() // 0 = Sunday, 1 = Monday, ...
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    const monday = new Date(now.getTime() + mondayOffset * 24 * 60 * 60 * 1000)
    const sunday = new Date(monday.getTime() + 6 * 24 * 60 * 60 * 1000)
    return `Week of ${formatSpanishShort(monday)} – ${formatSpanishShort(sunday)} (current)`
  }
  try {
    const start = new Date(weekStartDate + "T00:00:00Z")
    if (isNaN(start.getTime())) return `Week of ${weekStartDate}`
    const end = new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000)
    return `Week of ${formatSpanishShort(start)} – ${formatSpanishShort(end)}`
  } catch {
    return `Week of ${weekStartDate}`
  }
}
