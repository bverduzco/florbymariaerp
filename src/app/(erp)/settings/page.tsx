export const dynamic = "force-dynamic"

import { db as prisma } from "@/lib/db"
import {
  EXPECTED_PRISMA_MODEL_COUNT,
  getMigrationStatuses,
  SCHEMA_CHANGE_REQUIRES_MIGRATION,
  SCHEMA_CHANGE_NO_MIGRATION,
} from "@/lib/migrations"
import { getDbTarget } from "@/lib/db-target"

async function getSettings() { return prisma.workbookSetting.findMany({ orderBy: [{ section: "asc" }, { key: "asc" }] }) }
async function getCounts() {
  const [m, p, c, o, e, q, pay, exp, sup, st, bd, cd, sm, po, l, el, t, rv] = await Promise.all([
    prisma.material.count(), prisma.product.count(), prisma.customer.count(), prisma.order.count(), prisma.event.count(), prisma.quote.count(), prisma.payment.count(), prisma.expense.count(), prisma.supplier.count(), prisma.staff.count(), prisma.blockedDate.count(), prisma.capacityDay.count(), prisma.seasonMarker.count(), prisma.purchaseOrder.count(), prisma.loss.count(), prisma.executionLog.count(), prisma.tool.count(), prisma.recipeVersion.count(),
  ])
  return { m, p, c, o, e, q, pay, exp, sup, st, bd, cd, sm, po, l, el, t, rv }
}

// Default values for settings (matching wireframe)
const DEFAULTS: Record<string, { value: string; label: string; placeholder: string }> = {
  businessName: { value: "Flor by Maria", label: "Business name", placeholder: "Flor by Maria" },
  address: { value: "", label: "Address", placeholder: "Street, colonia, C.P., municipio, estado" },
  phone: { value: "", label: "Phone / WhatsApp", placeholder: "81 1234 5678" },
  email: { value: "", label: "Email", placeholder: "hola@florbymaria.com" },
  flowersMultiplier: { value: "2.5", label: "Flowers multiplier", placeholder: "2.5" },
  otherMaterialsMultiplier: { value: "2.0", label: "Other materials multiplier", placeholder: "2.0" },
  laborSurcharge: { value: "40", label: "Labor & design surcharge (%)", placeholder: "40" },
  iva: { value: "16", label: "IVA (%)", placeholder: "16" },
  banco: { value: "", label: "BANCO", placeholder: "e.g. BBVA, Santander" },
  clabe: { value: "", label: "CLABE", placeholder: "18 digits" },
  titular: { value: "", label: "TITULAR", placeholder: "Account holder name" },
  minLeadHours: { value: "48", label: "Min lead time (hours)", placeholder: "48" },
  rushFeePct: { value: "20", label: "Rush fee (%)", placeholder: "20" },
  quoteValidityDays: { value: "15", label: "Quote validity (days)", placeholder: "15" },
  designChangeCutoff: { value: "30", label: "Design change cutoff (days before event)", placeholder: "30" },
  rentalDepositRefund: { value: "7", label: "Rental deposit refund (days)", placeholder: "7" },
  privacyResponseDays: { value: "20", label: "Privacy response (business days)", placeholder: "20" },
}

// ─── Build / deploy info ────────────────────────────────────────────────
//
// Vercel auto-injects these env vars at build time. They're not in .env
// or .env.local — Vercel provides them automatically. When running locally
// (npm run dev), they're undefined, which we handle gracefully.

function getBuildInfo() {
  const vercelEnv = process.env.VERCEL_ENV ?? "development"
  const commitSha = process.env.VERCEL_GIT_COMMIT_SHA ?? null
  const commitMessage = process.env.VERCEL_GIT_COMMIT_MESSAGE ?? null
  const commitAuthor = process.env.VERCEL_GIT_COMMIT_AUTHOR_NAME ?? null
  const commitDate = process.env.VERCEL_GIT_COMMIT_COMMITTER_DATE ?? null
  const deploymentUrl = process.env.VERCEL_URL ?? null
  const region = process.env.VERCEL_REGION ?? null
  const nextBuildId = process.env.NEXT_PUBLIC_BUILD_ID
    ?? (process.env.NEXT_BUILD_ID as string | undefined)
    ?? null

  return {
    vercelEnv,
    commitSha,
    commitMessage,
    commitAuthor,
    commitDate,
    deploymentUrl,
    region,
    nextBuildId,
  }
}

function getDatabaseInfo() {
  // Delegates to the shared db-target module so the Settings page and the
  // TopBar badge always agree on what database the deployment is using.
  const target = getDbTarget()
  return {
    dbType: target.description,
    dbHost: target.hostname,
    isTurso: target.isTurso,
    isLocalFile: target.target === "local",
    target: target.target,
    label: target.label,
    color: target.color,
    textColor: target.textColor,
  }
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—"
  try {
    const d = new Date(iso)
    return d.toLocaleString("es-MX", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return iso
  }
}

export default async function SettingsPage() {
  const [settings, counts, migrationInfo] = await Promise.all([
    getSettings(),
    getCounts(),
    getMigrationStatuses(prisma),
  ])
  const settingsMap = new Map(settings.map((s) => [s.key, s.value]))
  const build = getBuildInfo()
  const dbInfo = getDatabaseInfo()

  function val(key: string): string {
    return settingsMap.get(key) ?? DEFAULTS[key]?.value ?? ""
  }

  // Compute migration status summary
  // Only count non-informational migrations toward pending — informational
  // migrations have no SQL to run and are always "applied" for display.
  const realMigrations = migrationInfo.statuses.filter((s) => !s.informational)
  const appliedCount = realMigrations.filter((s) => s.applied).length
  const pendingCount = realMigrations.length - appliedCount
  const lastApplied = migrationInfo.statuses
    .filter((s) => s.applied && s.appliedAt)
    .map((s) => s.appliedAt!)
    .sort()
    .pop() ?? null

  // Schema drift detection: does the live DB have as many tables as the
  // Prisma schema declares models? On Turso there's also the
  // __turso_migrations tracker table, so the expected live count is
  // EXPECTED_PRISMA_MODEL_COUNT + 1.
  const expectedLiveTables = EXPECTED_PRISMA_MODEL_COUNT + (migrationInfo.trackerExists ? 1 : 0)
  const tableCountMatches = migrationInfo.liveTableCount === expectedLiveTables
  const tableCountDrift = migrationInfo.liveTableCount - expectedLiveTables

  return (
    <div>
      <div className="fmd-screen-header">
        <div><h1>Settings</h1><div className="fmd-subtitle">Business configuration · pricing rules · banking info</div></div>
      </div>

      {/* Two-column: Business Details + Pricing Rules */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "16px", marginBottom: "16px" }}>
        {/* Business Details */}
        <div className="fmd-box" style={{ marginBottom: 0 }}>
          <div className="fmd-box-label">Business Details</div>
          <SettingField label="Business name" value={val("businessName")} placeholder="Flor by Maria" />
          <SettingField label="Address" value={val("address")} placeholder="Street, colonia, C.P., municipio, estado" />
          <SettingField label="Phone / WhatsApp" value={val("phone")} placeholder="81 1234 5678" />
          <SettingField label="Email" value={val("email")} placeholder="hola@florbymaria.com" />
        </div>

        {/* Pricing Rules */}
        <div className="fmd-box" style={{ marginBottom: 0 }}>
          <div className="fmd-box-label">Pricing Rules</div>
          <SettingField label="Flowers multiplier" value={val("flowersMultiplier")} placeholder="2.5" suffix="×" />
          <SettingField label="Other materials multiplier" value={val("otherMaterialsMultiplier")} placeholder="2.0" suffix="×" />
          <SettingField label="Labor & design surcharge" value={val("laborSurcharge")} placeholder="40" suffix="%" />
          <SettingField label="IVA" value={val("iva")} placeholder="16" suffix="%" />
          <div className="fmd-note blue" style={{ marginTop: "8px" }}>
            Price = (flowers × {val("flowersMultiplier") || "2.5"} + other × {val("otherMaterialsMultiplier") || "2.0"}) × (1 + {(val("laborSurcharge") || "40")}% labor) × (1 + {(val("iva") || "16")}% IVA)
          </div>
        </div>
      </div>

      {/* Banking Info */}
      <div className="fmd-box">
        <div className="fmd-box-label">Banking Info (for SPEI payments)</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "8px" }}>
          <SettingField label="BANCO" value={val("banco")} placeholder="e.g. BBVA, Santander" />
          <SettingField label="CLABE" value={val("clabe")} placeholder="18 digits" />
          <SettingField label="TITULAR" value={val("titular")} placeholder="Account holder name" />
        </div>
        <div className="fmd-note" style={{ marginTop: "8px" }}>
          ⚠️ These feed into LT-003 (Service Terms) via [BANCO], [CLABE], [TITULAR] placeholders. Without these, the legal templates show blanks.
        </div>
      </div>

      {/* Configurable Defaults */}
      <div className="fmd-box">
        <div className="fmd-box-label">Configurable Defaults</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "8px" }}>
          <SettingField label="Min lead time" value={val("minLeadHours")} placeholder="48" suffix=" hrs" />
          <SettingField label="Rush fee" value={val("rushFeePct")} placeholder="20" suffix="%" />
          <SettingField label="Quote validity" value={val("quoteValidityDays")} placeholder="15" suffix=" days" />
          <SettingField label="Design change cutoff" value={val("designChangeCutoff")} placeholder="30" suffix=" days" />
          <SettingField label="Rental deposit refund" value={val("rentalDepositRefund")} placeholder="7" suffix=" days" />
          <SettingField label="Privacy response" value={val("privacyResponseDays")} placeholder="20" suffix=" days" />
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* System Information (replaces the old hardcoded block)              */}
      {/* ════════════════════════════════════════════════════════════════ */}
      <div className="fmd-box">
        <div className="fmd-box-label">System Information</div>

        {/* Build + Database at-a-glance */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "12px", marginBottom: "16px" }}>
          <InfoCell
            label="Environment"
            value={build.vercelEnv === "production" ? "Production" : build.vercelEnv === "preview" ? "Preview" : "Local dev"}
            color={build.vercelEnv === "production" ? "#047857" : build.vercelEnv === "preview" ? "#D97706" : "#6B7280"}
          />
          <InfoCell
            label="Database target"
            value={dbInfo.label}
            sub={dbInfo.dbType}
            color={dbInfo.color}
          />
          <InfoCell
            label="DB tables"
            value={String(migrationInfo.liveTableCount)}
            sub={`Schema declares ${EXPECTED_PRISMA_MODEL_COUNT} models`}
            color={tableCountMatches ? "#047857" : "#991B1B"}
          />
          <InfoCell
            label="Cloudinary cloud"
            value={process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "(unset)"}
          />
        </div>

        {/* Latest commit / deploy details */}
        <div style={{ background: "#FAFAF9", border: "1px solid #D6D3D1", borderRadius: "6px", padding: "12px", marginBottom: "12px" }}>
          <div style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.5px", color: "#78716C", marginBottom: "6px" }}>
            Latest deployment
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "8px", fontSize: "12px" }}>
            <KV label="Commit" value={build.commitSha ? build.commitSha.slice(0, 7) : "—"} mono />
            <KV label="Author" value={build.commitAuthor ?? "—"} />
            <KV label="Committed" value={fmtDate(build.commitDate)} />
            <KV label="Region" value={build.region ?? "—"} />
            <KV label="Build ID" value={build.nextBuildId ? build.nextBuildId.slice(0, 8) : "—"} mono />
            <KV label="URL" value={build.deploymentUrl ?? "(local)"} mono />
          </div>
          {build.commitMessage && (
            <div style={{ marginTop: "8px", paddingTop: "8px", borderTop: "1px solid #E7E5E4", fontSize: "12px", color: "#44403C" }}>
              <span style={{ color: "#78716C", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Commit message:</span>
              <br />
              <span style={{ fontStyle: "italic" }}>&ldquo;{build.commitMessage.split("\n")[0]}&rdquo;</span>
            </div>
          )}
        </div>

        {/* ─── Database connection documentation ───────────────────────── */}
        <div style={{ background: "#fff", border: `2px solid ${dbInfo.color}`, borderRadius: "6px", padding: "12px", marginBottom: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
            <span
              style={{
                background: dbInfo.color,
                color: dbInfo.textColor,
                padding: "2px 8px",
                borderRadius: "4px",
                fontSize: "10px",
                fontWeight: 700,
                letterSpacing: "0.05em",
              }}
            >
              {dbInfo.label}
            </span>
            <span style={{ fontSize: "11px", color: "#78716C" }}>
              All reads and writes from this deployment go to:
            </span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "8px", fontSize: "12px" }}>
            <KV label="DB type" value={dbInfo.dbType} />
            <KV label="Hostname / file" value={dbInfo.dbHost} mono />
            <KV label="Toggle status" value="Read-only badge (toggle is on the Wishlist ↓)" />
          </div>
          <div style={{ marginTop: "8px", paddingTop: "8px", borderTop: "1px solid #E7E5E4", fontSize: "11px", color: "#44403C", lineHeight: 1.6 }}>
            <strong>What this means:</strong> every customer, quote, order, payment, or material edit you make on this
            deployment is written to <code style={{ background: "#FAFAF9", padding: "1px 4px", borderRadius: "3px" }}>{dbInfo.dbHost}</code>.
            The DB badge in the top bar reflects this same target — if it says <span style={{ fontWeight: 700, color: dbInfo.color }}>{dbInfo.label}</span>,
            you&apos;re talking to {dbInfo.dbType}.
          </div>

          {/* Architecture explainer */}
          <div style={{ marginTop: "10px", paddingTop: "10px", borderTop: "1px solid #E7E5E4", fontSize: "11px", color: "#44403C", lineHeight: 1.6 }}>
            <div style={{ fontWeight: 700, marginBottom: "4px" }}>How the DB wiring works:</div>
            <ol style={{ paddingLeft: "20px", margin: 0, lineHeight: 1.7 }}>
              <li>
                Vercel&apos;s <code style={{ background: "#FAFAF9", padding: "1px 4px", borderRadius: "3px" }}>DATABASE_URL</code> env var
                points to one Turso database (currently <code style={{ background: "#FAFAF9", padding: "1px 4px", borderRadius: "3px" }}>{dbInfo.dbHost}</code>).
              </li>
              <li>
                <code style={{ background: "#FAFAF9", padding: "1px 4px", borderRadius: "3px" }}>src/lib/db.ts</code> reads that env var
                at startup, picks the right Prisma adapter (libsql for Turso, better-sqlite3 for local files), and caches a single
                PrismaClient in <code style={{ background: "#FAFAF9", padding: "1px 4px", borderRadius: "3px" }}>globalThis.prisma</code>.
              </li>
              <li>
                Every server component and route handler imports that same cached client. There&apos;s currently no per-request DB switching —
                the cached client is reused for the lifetime of the serverless function instance.
              </li>
              <li>
                The DB badge reads <code style={{ background: "#FAFAF9", padding: "1px 4px", borderRadius: "3px" }}>process.env.DATABASE_URL</code> on
                the server, pattern-matches the hostname for <code style={{ background: "#FAFAF9", padding: "1px 4px", borderRadius: "3px" }}>-prod</code> /
                <code style={{ background: "#FAFAF9", padding: "1px 4px", borderRadius: "3px" }}> -demo</code> / file: to derive the
                <code style={{ background: "#FAFAF9", padding: "1px 4px", borderRadius: "3px" }}> PROD</code> /
                <code style={{ background: "#FAFAF9", padding: "1px 4px", borderRadius: "3px" }}> DEMO</code> /
                <code style={{ background: "#FAFAF9", padding: "1px 4px", borderRadius: "3px" }}> LOCAL</code> label.
              </li>
            </ol>
          </div>

          {/* Two DBs explainer */}
          <div className="fmd-note blue" style={{ marginTop: "10px", marginBottom: 0 }}>
            <strong>Two Turso databases exist:</strong>{" "}
            <code style={{ background: "#fff", padding: "1px 4px", borderRadius: "3px" }}>florbymaria-prod</code> (real business data)
            {" "}and{" "}
            <code style={{ background: "#fff", padding: "1px 4px", borderRadius: "3px" }}>florbymaria-demo</code> (clean slate for testing).
            {" "}Currently this deployment is connected to{" "}
            <strong>{dbInfo.target === "prod" ? "prod" : dbInfo.target === "demo" ? "demo" : dbInfo.dbType}</strong>.
            {" "}To switch deployments between them, change the{" "}
            <code style={{ background: "#fff", padding: "1px 4px", borderRadius: "3px" }}>DATABASE_URL</code> env var in the Vercel dashboard.
            {" "}A runtime toggle (no Vercel dashboard visit required) is on the Wishlist below.
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* Migration tracker                                                  */}
      {/* ════════════════════════════════════════════════════════════════ */}
      <div className="fmd-box">
        <div className="fmd-box-label" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>Schema Migration Tracker</span>
          {pendingCount > 0 ? (
            <span className="fmd-status expired" style={{ background: "#FEE2E2", color: "#991B1B" }}>
              {pendingCount} pending
            </span>
          ) : migrationInfo.trackerExists ? (
            <span className="fmd-status accepted" style={{ background: "#D1FAE5", color: "#065F46" }}>
              All {appliedCount} applied
            </span>
          ) : (
            <span className="fmd-status" style={{ background: "#F3F4F6", color: "#6B7280" }}>
              No tracker table
            </span>
          )}
        </div>

        {/* Summary KPIs */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "8px", marginBottom: "12px" }}>
          <InfoCell label="Known migrations" value={String(migrationInfo.statuses.length)} color="#44403C" />
          <InfoCell label="Applied" value={String(appliedCount)} color="#047857" />
          <InfoCell label="Pending" value={String(pendingCount)} color={pendingCount > 0 ? "#991B1B" : "#6B7280"} />
          <InfoCell label="Last applied" value={lastApplied ? fmtDate(lastApplied) : "—"} color="#44403C" small />
        </div>

        {/* Status banner if pending */}
        {pendingCount > 0 && migrationInfo.trackerExists && (
          <div className="fmd-note" style={{ background: "#FEE2E2", borderColor: "#FCA5A5", color: "#991B1B", marginBottom: "12px" }}>
            ⚠️ <strong>{pendingCount} migration(s) not yet applied to this database.</strong> Pages
            that touch the affected tables/columns will return HTTP 500. Visit{" "}
            <code style={{ background: "#fff", padding: "1px 4px", borderRadius: "3px" }}>
              /api/admin/migrate
            </code>{" "}
            while logged in to apply them now.
          </div>
        )}

        {/* No-tracker notice (local dev or fresh DB).
            Shows whenever the tracker table doesn't exist, regardless of
            pending count — without the tracker, "pending" status is
            unreliable (the schema may already be up to date locally). */}
        {!migrationInfo.trackerExists && (
          <div className="fmd-note blue" style={{ marginBottom: "12px" }}>
            ℹ️ No <code style={{ background: "#fff", padding: "1px 4px", borderRadius: "3px" }}>__turso_migrations</code> tracker
            table in this database. {dbInfo.isLocalFile
              ? "This is normal for local dev — the migration script only runs against Turso. The schema may already be correct locally (use the table count above to verify)."
              : "Visit /api/admin/migrate to set up the tracker and apply any pending migrations."
            }
          </div>
        )}

        {/* Table count drift notice */}
        {!tableCountMatches && migrationInfo.trackerExists && (
          <div className="fmd-note" style={{ background: "#FEF3C7", borderColor: "#FDE68A", color: "#92400E", marginBottom: "12px" }}>
            ⚠️ <strong>Schema drift detected.</strong> Live database has{" "}
            {migrationInfo.liveTableCount} tables, but Prisma schema declares{" "}
            {EXPECTED_PRISMA_MODEL_COUNT} models (expected{" "}
            {expectedLiveTables} live tables including the tracker).
            {tableCountDrift > 0 ? ` ${tableCountDrift} extra table(s) in DB (orphaned?).` : ` ${Math.abs(tableCountDrift)} table(s) missing from DB.`}
            {" "}Add a migration entry to <code style={{ background: "#fff", padding: "1px 4px", borderRadius: "3px" }}>src/lib/migrations.ts</code> if a model was added recently.
          </div>
        )}

        {/* Migration list */}
        <div style={{ overflowX: "auto" }}>
          <table className="fmd-table">
            <thead>
              <tr>
                <th>Migration</th>
                <th>Added</th>
                <th>Status</th>
                <th>Applied at</th>
              </tr>
            </thead>
            <tbody>
              {migrationInfo.statuses.map((m) => (
                <tr key={m.name}>
                  <td style={{ fontFamily: "monospace", fontSize: "11px", color: "#44403C" }}>
                    {m.name}
                    <div style={{ fontSize: "10px", color: "#78716C", marginTop: "2px", maxWidth: "480px" }}>
                      {m.description}
                    </div>
                  </td>
                  <td style={{ fontSize: "11px", color: "#78716C" }}>{m.addedAt}</td>
                  <td>
                    {m.informational ? (
                      <span className="fmd-status" style={{ background: "#F3F4F6", color: "#6B7280" }} title="No SQL statements — listed for historical context only">
                        ℹ informational
                      </span>
                    ) : m.applied ? (
                      <span className="fmd-status accepted">✓ applied</span>
                    ) : (
                      <span className="fmd-status expired">pending</span>
                    )}
                  </td>
                  <td style={{ fontSize: "11px", color: "#78716C" }}>
                    {m.appliedAt ? fmtDate(m.appliedAt) : (m.informational ? "—" : "—")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Apply migrations button / link — only show on Turso (production).
            On local dev, the migrator endpoint returns an error because
            DATABASE_URL is a file: URL. */}
        {dbInfo.isTurso && (
          <div style={{ marginTop: "12px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <a
              href="/api/admin/migrate"
              style={{
                display: "inline-block",
                padding: "8px 14px",
                fontSize: "12px",
                fontWeight: 600,
                background: pendingCount > 0 ? "#BE185D" : "#44403C",
                color: "#fff",
                borderRadius: "6px",
                textDecoration: "none",
              }}
            >
              {pendingCount > 0 ? "Apply pending migrations →" : "Re-run migration check →"}
            </a>
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* When to update Turso                                              */}
      {/* ════════════════════════════════════════════════════════════════ */}
      <div className="fmd-box" style={{ borderColor: "#BFDBFE" }}>
        <div className="fmd-box-label" style={{ color: "#1E40AF" }}>
          When do I need to update Turso?
        </div>

        <div style={{ fontSize: "12px", color: "#44403C", lineHeight: 1.6, marginBottom: "12px" }}>
          Turso is the production database. The Prisma schema in{" "}
          <code style={{ background: "#fff", padding: "1px 4px", borderRadius: "3px" }}>prisma/schema.prisma</code>{" "}
          describes what the database <em>should</em> look like, but it doesn't
          change the actual database on its own. When you change the schema,
          you have to apply a migration to Turso — otherwise pages that touch
          the new fields/tables will return HTTP 500.
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "12px" }}>
          {/* REQUIRES migration */}
          <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "6px", padding: "10px" }}>
            <div style={{ fontSize: "11px", fontWeight: 700, color: "#991B1B", marginBottom: "6px" }}>
              ✗ REQUIRES a Turso migration
            </div>
            <ul style={{ fontSize: "11px", color: "#44403C", paddingLeft: "16px", margin: 0, lineHeight: 1.6 }}>
              {SCHEMA_CHANGE_REQUIRES_MIGRATION.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>

          {/* DOES NOT require migration */}
          <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: "6px", padding: "10px" }}>
            <div style={{ fontSize: "11px", fontWeight: 700, color: "#065F46", marginBottom: "6px" }}>
              ✓ Does NOT require a migration
            </div>
            <ul style={{ fontSize: "11px", color: "#44403C", paddingLeft: "16px", margin: 0, lineHeight: 1.6 }}>
              {SCHEMA_CHANGE_NO_MIGRATION.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* Step-by-step workflow */}
        <div style={{ marginTop: "12px", background: "#fff", border: "1px solid #D6D3D1", borderRadius: "6px", padding: "10px", fontSize: "11px", color: "#44403C" }}>
          <div style={{ fontWeight: 700, marginBottom: "6px" }}>How to apply a migration (3 steps):</div>
          <ol style={{ paddingLeft: "20px", margin: 0, lineHeight: 1.7 }}>
            <li>
              Add the SQL file at{" "}
              <code style={{ background: "#FAFAF9", padding: "1px 4px", borderRadius: "3px" }}>
                prisma/turso-migrations/&lt;name&gt;.sql
              </code>
            </li>
            <li>
              Add a matching entry to the <code style={{ background: "#FAFAF9", padding: "1px 4px", borderRadius: "3px" }}>MIGRATIONS</code> array in{" "}
              <code style={{ background: "#FAFAF9", padding: "1px 4px", borderRadius: "3px" }}>src/lib/migrations.ts</code>{" "}
              (with the SQL statements inlined — Vercel serverless doesn't bundle arbitrary files).
              Bump <code style={{ background: "#FAFAF9", padding: "1px 4px", borderRadius: "3px" }}>EXPECTED_PRISMA_MODEL_COUNT</code> if you added a model.
            </li>
            <li>
              Commit + push to <code style={{ background: "#FAFAF9", padding: "1px 4px", borderRadius: "3px" }}>main</code>.
              After Vercel redeploys, visit{" "}
              <code style={{ background: "#FAFAF9", padding: "1px 4px", borderRadius: "3px" }}>/api/admin/migrate</code>{" "}
              while logged in. The endpoint is idempotent — safe to re-run.
            </li>
          </ol>
        </div>

        <div className="fmd-note blue" style={{ marginTop: "12px" }}>
          💡 <strong>Quick check:</strong> if a page returns HTTP 500 after a
          schema change, look at the migration tracker above — a pending
          migration is almost always the cause.
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* Wishlist — features under consideration                          */}
      {/* ════════════════════════════════════════════════════════════════ */}
      <div className="fmd-box" style={{ borderColor: "#FDE68A", background: "#FFFBEB" }}>
        <div className="fmd-box-label" style={{ color: "#92400E" }}>
          🌟 Wishlist — features under consideration
        </div>
        <div style={{ fontSize: "11px", color: "#78716C", marginBottom: "12px", lineHeight: 1.5 }}>
          These are improvements we&apos;ve discussed but haven&apos;t built yet.
          Items marked <span className="fmd-status accepted" style={{ background: "#D1FAE5", color: "#065F46" }}>next up</span>{" "}
          are the most likely to be picked up in the next iteration.
        </div>

        {/* Wishlist items */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {/* ─── Runtime DB toggle (HIGH PRIORITY) ─── */}
          <WishlistItem
            priority="next up"
            title="Runtime DB toggle (PROD ⇄ DEMO without leaving the page)"
            description={
              <>
                Make the DB badge in the top bar clickable. Clicking it opens a dropdown with{" "}
                <strong>Production</strong> and <strong>Demo</strong> options. Selecting one switches
                the active database for the current session (via a cookie), and the page re-fetches
                all data from the new DB instantly. No Vercel dashboard visit required.
              </>
            }
            why={
              <>
                Currently, switching between prod and demo requires changing the{" "}
                <code style={{ background: "#fff", padding: "1px 4px", borderRadius: "3px" }}>DATABASE_URL</code>{" "}
                env var in Vercel and waiting for a redeploy (~2 min). The toggle would make it
                instant — useful for testing features against a clean demo DB without polluting
                prod, or for previewing prod data from a demo session.
              </>
            }
            implementation={
              <>
                <strong>Implementation sketch (Option B from the design discussion):</strong>
                <ol style={{ paddingLeft: "20px", margin: "4px 0 0 0", lineHeight: 1.7 }}>
                  <li>Add <code style={{ background: "#fff", padding: "1px 4px", borderRadius: "3px" }}>DATABASE_URL_DEMO</code> env var on Vercel.</li>
                  <li>Cookie <code style={{ background: "#fff", padding: "1px 4px", borderRadius: "3px" }}>fmd_db_target</code> = <code style={{ background: "#fff", padding: "1px 4px", borderRadius: "3px" }}>prod</code> | <code style={{ background: "#fff", padding: "1px 4px", borderRadius: "3px" }}>demo</code> (HttpOnly, 30-day).</li>
                  <li>Middleware reads cookie → sets <code style={{ background: "#fff", padding: "1px 4px", borderRadius: "3px" }}>x-fmd-db-target</code> header (strips any client-sent value).</li>
                  <li><code style={{ background: "#fff", padding: "1px 4px", borderRadius: "3px" }}>src/lib/db.ts</code> keeps a <code style={{ background: "#fff", padding: "1px 4px", borderRadius: "3px" }}>Map&lt;target, PrismaClient&gt;</code> and picks based on the header.</li>
                  <li>Update ~27 page files: <code style={{ background: "#fff", padding: "1px 4px", borderRadius: "3px" }}>import {"{"} db {"}"} from "@/lib/db"</code> → <code style={{ background: "#fff", padding: "1px 4px", borderRadius: "3px" }}>import {"{"} getDb {"}"} from "@/lib/db"</code>, <code style={{ background: "#fff", padding: "1px 4px", borderRadius: "3px" }}>prisma.X</code> → <code style={{ background: "#fff", padding: "1px 4px", borderRadius: "3px" }}>getDb().X</code>.</li>
                  <li>Convert TopBar to client component, add dropdown, POST to <code style={{ background: "#fff", padding: "1px 4px", borderRadius: "3px" }}>/api/admin/db-switch</code> on click, then <code style={{ background: "#fff", padding: "1px 4px", borderRadius: "3px" }}>router.refresh()</code>.</li>
                  <li>Also apply the latest migration to the demo DB (currently only has the 40-table base schema).</li>
                </ol>
              </>
            }
            risks={
              <>
                Two Prisma clients held in memory per serverless instance (~10MB extra RAM).
                Writes in flight when the toggle is clicked still land in the old DB until the
                next request — minor, but worth noting in the dropdown UI.
              </>
            }
            effort="~2 hours (mostly mechanical refactor across 27 page files)"
          />

          {/* ─── Soft-delete for audit trail + legal compliance ─── */}
          <WishlistItem
            priority="next up"
            title="Soft-delete (preserve audit trail + comply with LFPDPPP)"
            description={
              <>
                Stop hard-deleting records. Replace <code style={{ background: "#fff", padding: "1px 4px", borderRadius: "3px" }}>prisma.quote.delete()</code>{" "}
                with a soft-delete pattern: add a <code style={{ background: "#fff", padding: "1px 4px", borderRadius: "3px" }}>deletedAt: DateTime?</code> column
                to the 5 entities with downstream references (Quote, Order, Customer, Event, Material), set
                <code style={{ background: "#fff", padding: "1px 4px", borderRadius: "3px" }}> deletedAt = now()</code> on delete-click, and filter
                <code style={{ background: "#fff", padding: "1px 4px", borderRadius: "3px" }}> where: {"{ deletedAt: null }"}</code> in all list queries by default.
                Add a &ldquo;Show deleted&rdquo; toggle on each list page so Maria can recover mis-deleted records.
              </>
            }
            why={
              <>
                <strong>Audit trail:</strong> hard-deleting a Quote destroys all its linkages
                (QuoteLines, converted Orders, Payments, AuditLog entries, QuoteReminders). Same for
                Order (Payments, ExecutionLogs, customer lifetime-value history), Customer (whole
                CRM record + communication log), Event (orders that came from it), Material (Recipes,
                StockMovements, SupplierPrices, Losses all reference it by SKU). With soft-delete, the
                audit trail stays intact — you can always answer &ldquo;why did this happen?&rdquo;
                <br/><br/>
                <strong>Legal compliance (Mexico LFPDPPP):</strong> the <em>Ley Federal de Protección de
                Datos Personales en Posesión de los Particulares</em> grants data subjects the right
                to ARCO — including <em>cancelación</em> (deletion) of their personal data. For Customer
                specifically, soft-delete alone doesn&apos;t satisfy a legal erasure request — the PII
                still lives in the database. So Customer needs <strong>two</strong> delete actions:
                <ol style={{ paddingLeft: "20px", margin: "4px 0 0 0", lineHeight: 1.7 }}>
                  <li><strong>Soft-delete (hide):</strong> for accidental deletes or inactive customers. Sets <code style={{ background: "#fff", padding: "1px 4px", borderRadius: "3px" }}>deletedAt</code>, hides from lists, preserves history.</li>
                  <li><strong>Permanent erase (for ARCO):</strong> for legal erasure requests. Hard-deletes PII fields (name, phone, email, address, notes), writes an AuditLog entry noting the erasure happened (without storing the PII itself), and soft-deletes the row. Implementation: replace PII with <code style={{ background: "#fff", padding: "1px 4px", borderRadius: "3px" }}>&quot;[ERASED per ARCO request]&quot;</code> tokens, not a true SQL DELETE — because Orders/Quotes still reference the customer by ID and we need them to keep working.</li>
                </ol>
                Quote, Order, Event, Material: soft-delete only (no legal erasure need — they&apos;re business records, not personal data).
              </>
            }
            implementation={
              <>
                <strong>Implementation sketch:</strong>
                <ol style={{ paddingLeft: "20px", margin: "4px 0 0 0", lineHeight: 1.7 }}>
                  <li>Add migration: <code style={{ background: "#fff", padding: "1px 4px", borderRadius: "3px" }}>ALTER TABLE Quote ADD COLUMN deletedAt DATETIME</code> (same for Order, Customer, Event, Material). 5 columns total.</li>
                  <li>Add <code style={{ background: "#fff", padding: "1px 4px", borderRadius: "3px" }}>deletedAt DateTime?</code> field to each model in <code style={{ background: "#fff", padding: "1px 4px", borderRadius: "3px" }}>prisma/schema.prisma</code>.</li>
                  <li>Update delete API routes: <code style={{ background: "#fff", padding: "1px 4px", borderRadius: "3px" }}>prisma.quote.delete()</code> → <code style={{ background: "#fff", padding: "1px 4px", borderRadius: "3px" }}>prisma.quote.update({"{ deletedAt: new Date() }"})</code>.</li>
                  <li>Update list queries on ~10 pages: add <code style={{ background: "#fff", padding: "1px 4px", borderRadius: "3px" }}>where: {"{ deletedAt: null }"}</code> to <code style={{ background: "#fff", padding: "1px 4px", borderRadius: "3px" }}>findMany</code> calls.</li>
                  <li>For Customer specifically, add a second button &ldquo;Erase PII (ARCO)&rdquo; that does the field-replacement dance described above.</li>
                  <li>Optional: add a &ldquo;Recently deleted&rdquo; view on each list page (hidden behind a toggle) showing <code style={{ background: "#fff", padding: "1px 4px", borderRadius: "3px" }}>deletedAt: {"{ not: null }"}</code> records with a &ldquo;Restore&rdquo; button.</li>
                </ol>
              </>
            }
            risks={
              <>
                Existing reports / KPIs that count quotes or orders may start including soft-deleted
                rows if we forget to add the filter to a query site — needs careful audit of every
                <code style={{ background: "#fff", padding: "1px 4px", borderRadius: "3px" }}> findMany</code> /
                <code style={{ background: "#fff", padding: "1px 4px", borderRadius: "3px" }}> count</code> /
                <code style={{ background: "#fff", padding: "1px 4px", borderRadius: "3px" }}> aggregate</code> call.
                Also: the Customer ARCO erase is a one-way operation — once PII is replaced with
                <code style={{ background: "#fff", padding: "1px 4px", borderRadius: "3px" }}> [ERASED]</code> tokens,
                it can&apos;t be undone. Should require a confirmation dialog with the customer name spelled out.
              </>
            }
            effort="~3 hours (5-column migration + ~15 query sites to update + Customer ARCO flow + restore UI)"
          />

          {/* ─── Other wishlist items (from prior sessions) ─── */}
          <WishlistItem
            priority="backlog"
            title="Delivery rules (dynamic fee based on zone / distance / date)"
            description={
              <>
                Replace the flat $100 MXN delivery fee with a rules engine: different fees for
                different zones (San Pedro vs Monterrey vs Santa Catarina), surcharges for
                far-away venues or holiday dates, free delivery above a quote threshold.
              </>
            }
          />
          <WishlistItem
            priority="backlog"
            title="Wiki image upload + Wiki → Material auto-link"
            description={
              <>
                Let Maria paste/upload photos into Wiki articles (currently text-only via
                Markdown). When an article mentions a material SKU, auto-link to the Materials
                page so she can jump from &ldquo;Vida en florero&rdquo; straight to the material
                detail.
              </>
            }
          />
          <WishlistItem
            priority="backlog"
            title="Multi-user / tenant support"
            description={
              <>
                Currently every visitor shares the same demo password. For production with
                multiple staff (Maria + assistants), add per-user accounts with role-based
                permissions (admin can delete, staff can only create/edit).
              </>
            }
          />
          <WishlistItem
            priority="backlog"
            title="Language switcher (ES / EN)"
            description={
              <>
                Most customer-facing text is in Spanish; some internal labels are in English.
                Add a proper i18n layer (Next.js + next-intl is already installed) so Maria can
                flip the UI language for English-speaking staff without changing customer
                documents.
              </>
            }
          />
          <WishlistItem
            priority="backlog"
            title="Seasonal promotions + bulk discounts"
            description={
              <>
                Auto-apply discounts during slow periods (e.g. August is the slowest month — show
                a banner offering 10% off). Add bulk pricing tiers (50+ bouquets = 5% off, 100+ =
                10% off) on quotes.
              </>
            }
          />
          <WishlistItem
            priority="backlog"
            title="Mobile: card view for remaining list pages"
            description={
              <>
                Quotes and Orders already have mobile card views. Extend the pattern to
                Customers, Materials, Suppliers, Payments, Expenses — currently they show as
                horizontally-scrolling tables on mobile.
              </>
            }
          />
          <WishlistItem
            priority="backlog"
            title="Mobile: bottom-sheet dialogs instead of centered modals"
            description={
              <>
                On mobile, dialogs currently render as full-screen centered modals. Bottom-sheet
                dialogs (slide up from the bottom, swipe down to dismiss) are more ergonomic on
                phones. The vaul library is already installed.
              </>
            }
          />
          <WishlistItem
            priority="backlog"
            title="🤖 Bot assistant: ticket photo → ad-hoc purchase / price list"
            description={
              <>
                Snap a photo of a vendor receipt or price list. VLM extracts vendor, date, line
                items, prices, total. SKU-matching service proposes matches (with confidence
                score); items with no SKU get logged as free-text ad-hoc purchases (after the
                <code style={{ background: "#fff", padding: "1px 4px", borderRadius: "3px" }}>AdHocPurchase.materialSku</code>{" "}
                nullable schema change lands). One photo can produce mixed records: ad-hoc
                purchases (with stock bump), expenses (no inventory impact), or skipped items
                (personal). Receipt image is attached to every record created — audit trail
                preserved. <strong>Blocked on finishing the execution-workflow fixes
                (Gap 1–4 from the 2026-11-09 design session).</strong> See{" "}
                <code style={{ background: "#fff", padding: "1px 4px", borderRadius: "3px" }}>BOT_ASSISTANT.md</code>{" "}
                for the full architecture + phased rollout plan.
              </>
            }
            why={
              <>
                Manually logging ad-hoc purchases through the dialog is the most tedious part of
                the current workflow — especially for Costco runs where items don&apos;t match
                the preferred-supplier SKUs. A photo scan collapses the entire data-entry step
                into &quot;upload + confirm.&quot; The price-list scan also keeps the Supplier
                Comparison tab current without manual data entry. Long-term this is the highest-
                leverage automation we could build: it removes the friction that causes Maria to
                skip logging purchases entirely, which means inventory and cost-basis data
                silently drifts.
              </>
            }
            effort="~4 weeks (Phase 0: 1 day proof-of-concept, Phase 1-3: ~1 week each, Phase 4: ongoing alias learning)"
          />
        </div>
      </div>

      {/* DB Counts */}
      <div className="fmd-box">
        <div className="fmd-box-label">Database Row Counts</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: "8px" }}>
          {[["Materials", counts.m], ["Products", counts.p], ["Customers", counts.c], ["Orders", counts.o], ["Events", counts.e], ["Quotes", counts.q], ["Payments", counts.pay], ["Expenses", counts.exp], ["Suppliers", counts.sup], ["Staff", counts.st], ["POs", counts.po], ["Losses", counts.l], ["Exec logs", counts.el], ["Tools", counts.t], ["Recipe ver", counts.rv], ["Blocked dates", counts.bd], ["Capacity days", counts.cd], ["Season markers", counts.sm]].map(([label, count]) => (
            <div key={label as string} className="fmd-stat" style={{ textAlign: "left" }}><div style={{ fontSize: "9px", textTransform: "uppercase", color: "#78716C" }}>{label}</div><div style={{ fontSize: "18px", fontWeight: 700, color: "#44403C" }}>{count}</div></div>
          ))}
        </div>
      </div>

      <div className="fmd-note blue">
        💡 Settings are stored in the <code style={{ background: "#ffffff", padding: "1px 4px", borderRadius: "3px" }}>WorkbookSetting</code> table as key-value pairs. Banking info + configurable defaults are new fields needed for the legal templates (LT-003 Service Terms uses [BANCO], [CLABE], [TITULAR] placeholders).
      </div>
    </div>
  )
}

// ─── Small presentational helpers ────────────────────────────────────────

function SettingField({ label, value, placeholder, suffix }: { label: string; value: string; placeholder: string; suffix?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#ffffff", border: "1px solid #D6D3D1", borderRadius: "4px", padding: "8px 12px", fontSize: "12px", marginBottom: "8px", minHeight: "32px" }}>
      <span style={{ color: "#6B7280" }}>{label}:</span>
      <span style={{ fontWeight: 600, color: value ? "#44403C" : "#D6D3D1" }}>
        {value ? `${value}${suffix ?? ""}` : placeholder}
      </span>
    </div>
  )
}

function InfoCell({ label, value, sub, color = "#44403C", small = false }: { label: string; value: string; sub?: string; color?: string; small?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: "10px", textTransform: "uppercase", color: "#78716C", letterSpacing: "0.5px" }}>{label}</div>
      <div style={{ fontSize: small ? "12px" : "16px", fontWeight: 700, color, marginTop: "2px" }}>{value}</div>
      {sub && <div style={{ fontSize: "10px", color: "#78716C", marginTop: "2px" }}>{sub}</div>}
    </div>
  )
}

function KV({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: "9px", textTransform: "uppercase", color: "#78716C", letterSpacing: "0.5px" }}>{label}</div>
      <div style={{ fontWeight: 600, color: "#44403C", fontFamily: mono ? "monospace" : "inherit" }}>{value}</div>
    </div>
  )
}

type WishlistPriority = "next up" | "backlog"

function WishlistItem({
  priority,
  title,
  description,
  why,
  implementation,
  risks,
  effort,
}: {
  priority: WishlistPriority
  title: string
  description: React.ReactNode
  why?: React.ReactNode
  implementation?: React.ReactNode
  risks?: React.ReactNode
  effort?: string
}) {
  const priorityConfig: Record<WishlistPriority, { bg: string; color: string }> = {
    "next up": { bg: "#D1FAE5", color: "#065F46" },
    backlog: { bg: "#F3F4F6", color: "#6B7280" },
  }
  const p = priorityConfig[priority]
  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #FDE68A",
        borderRadius: "6px",
        padding: "12px",
      }}
    >
      {/* Title row */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px", flexWrap: "wrap" }}>
        <span
          style={{
            background: p.bg,
            color: p.color,
            padding: "2px 8px",
            borderRadius: "10px",
            fontSize: "9px",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.5px",
            whiteSpace: "nowrap",
          }}
        >
          {priority}
        </span>
        <span style={{ fontSize: "13px", fontWeight: 700, color: "#44403C", flex: 1, minWidth: "200px" }}>
          {title}
        </span>
        {effort && (
          <span style={{ fontSize: "10px", color: "#92400E", fontStyle: "italic" }}>{effort}</span>
        )}
      </div>

      {/* Description */}
      <div style={{ fontSize: "12px", color: "#44403C", lineHeight: 1.6, marginBottom: why || implementation || risks ? "10px" : "0" }}>
        {description}
      </div>

      {/* Why section */}
      {why && (
        <div style={{ marginTop: "6px", fontSize: "11px", color: "#78716C", lineHeight: 1.6, paddingTop: "6px", borderTop: "1px dashed #FDE68A" }}>
          <strong style={{ color: "#92400E" }}>Why: </strong>
          {why}
        </div>
      )}

      {/* Implementation sketch */}
      {implementation && (
        <div style={{ marginTop: "6px", fontSize: "11px", color: "#44403C", lineHeight: 1.6, paddingTop: "6px", borderTop: "1px dashed #FDE68A" }}>
          {implementation}
        </div>
      )}

      {/* Risks */}
      {risks && (
        <div style={{ marginTop: "6px", fontSize: "11px", color: "#92400E", lineHeight: 1.6, paddingTop: "6px", borderTop: "1px dashed #FDE68A" }}>
          <strong>Risks: </strong>
          {risks}
        </div>
      )}
    </div>
  )
}
