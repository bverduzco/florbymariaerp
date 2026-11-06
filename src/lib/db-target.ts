// src/lib/db-target.ts — server-side database target identification.
//
// The deployed Vercel app can be connected to either the prod or demo
// Turso database (set via the DATABASE_URL env var). This module inspects
// that URL at runtime and returns a normalized "target" label that the
// UI uses to render a badge — so it's always obvious which database the
// current deployment is talking to.
//
// Why we don't infer from the URL hostname alone:
//   - The URL might be `libsql://florbymaria-prod-<org>.turso.io` (prod)
//   - or `libsql://florbymaria-demo-<org>.turso.io` (demo)
//   - We pattern-match on the hostname to detect the suffix.
//   - For local dev (file: URLs) we return "local".
//
// Future: when the runtime DB toggle (Option B in the design discussion)
// is implemented, this module will be extended to read the active target
// from a request-scoped AsyncLocalStorage instead of just the env var.

export type DbTarget = "prod" | "demo" | "sandbox" | "local" | "unknown"

export type DbTargetInfo = {
  target: DbTarget
  /** Short label for badge: "PROD", "DEMO", "LOCAL", "—" */
  label: string
  /** Full descriptive name: "Production Turso", "Demo Turso", etc. */
  description: string
  /** Hex color for the badge background. */
  color: string
  /** Hex color for the badge text. */
  textColor: string
  /** Hostname of the Turso DB (or local file name) — safe to display. */
  hostname: string
  /** True if connected to a Turso (libsql://) database. */
  isTurso: boolean
  /** True if the connection is read-write (always true for now; future
   *  read-only mode would set this to false). */
  isReadOnly: boolean
}

function parseHostname(url: string): string {
  try {
    const u = new URL(url)
    return u.hostname
  } catch {
    // file: URLs don't parse with new URL() in some envs — extract manually
    if (url.startsWith("file:")) {
      const path = url.replace(/^file:/, "")
      return path.split("/").pop() ?? url
    }
    return "(invalid URL)"
  }
}

/**
 * Identify the current database target from the runtime DATABASE_URL env var.
 *
 * Call this from server components / route handlers only — it reads
 * process.env at call time, which is server-side.
 *
 * Pattern matching rules:
 *   - URL contains "florbymaria-prod" (or just "prod") → prod
 *   - URL contains "florbymaria-demo" (or just "demo") → demo
 *   - URL is file: → local
 *   - Anything else → unknown
 *
 * If you have a custom Turso DB name (e.g. florbymaria-staging), update the
 * rules below.
 */
export function getDbTarget(): DbTargetInfo {
  const url = process.env.DATABASE_URL ?? ""

  if (url.startsWith("file:")) {
    return {
      target: "local",
      label: "LOCAL",
      description: "Local SQLite (file:)",
      color: "#6B7280",
      textColor: "#ffffff",
      hostname: parseHostname(url),
      isTurso: false,
      isReadOnly: false,
    }
  }

  if (url.startsWith("libsql://") || url.startsWith("https://") || url.startsWith("http://")) {
    const hostname = parseHostname(url)
    // Detect prod vs demo vs sandbox by hostname pattern.
    // Common forms: florbymaria-prod-<org>.turso.io, florbymaria-demo-<org>.turso.io,
    // florbymaria-sandbox-<org>.turso.io
    const isProd = hostname.includes("florbymaria-prod") || hostname.includes("-prod")
    const isDemo = hostname.includes("florbymaria-demo") || hostname.includes("-demo")
    const isSandbox = hostname.includes("florbymaria-sandbox") || hostname.includes("-sandbox")

    if (isProd) {
      return {
        target: "prod",
        label: "PROD",
        description: "Production Turso",
        color: "#BE185D", // rose — same as app accent
        textColor: "#ffffff",
        hostname,
        isTurso: true,
        isReadOnly: false,
      }
    }

    if (isDemo) {
      return {
        target: "demo",
        label: "DEMO",
        description: "Demo Turso",
        color: "#D97706", // amber — distinct from prod
        textColor: "#ffffff",
        hostname,
        isTurso: true,
        isReadOnly: false,
      }
    }

    if (isSandbox) {
      return {
        target: "sandbox",
        label: "SANDBOX",
        description: "Sandbox Turso (testing)",
        color: "#7C3AED", // violet — distinct from prod (rose) and demo (amber)
        textColor: "#ffffff",
        hostname,
        isTurso: true,
        isReadOnly: false,
      }
    }

    // Turso URL but doesn't match prod/demo/sandbox pattern
    return {
      target: "unknown",
      label: "TURSO",
      description: `Turso (${hostname})`,
      color: "#44403C",
      textColor: "#ffffff",
      hostname,
      isTurso: true,
      isReadOnly: false,
    }
  }

  // DATABASE_URL not set or unrecognized format
  return {
    target: "unknown",
    label: "—",
    description: "DATABASE_URL not set",
    color: "#991B1B",
    textColor: "#ffffff",
    hostname: "(unset)",
    isTurso: false,
    isReadOnly: false,
  }
}
