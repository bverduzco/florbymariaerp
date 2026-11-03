export const dynamic = "force-dynamic"

import { db as prisma } from "@/lib/db"
import {
  EXPECTED_PRISMA_MODEL_COUNT,
  getMigrationStatuses,
  SCHEMA_CHANGE_REQUIRES_MIGRATION,
  SCHEMA_CHANGE_NO_MIGRATION,
} from "@/lib/migrations"

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
  const url = process.env.DATABASE_URL ?? ""
  const isTurso = url.startsWith("libsql://") || url.startsWith("https://") || url.startsWith("http://")
  const isLocalFile = url.startsWith("file:")

  let dbType: string
  let dbHost: string
  if (isTurso) {
    dbType = "Turso (libSQL)"
    // Extract just the hostname — strip query params (auth token!)
    try {
      const u = new URL(url)
      dbHost = u.hostname
    } catch {
      dbHost = "(invalid URL)"
    }
  } else if (isLocalFile) {
    dbType = "Local SQLite"
    // Show just the basename, not the full path
    dbHost = url.replace(/^file:/, "").split("/").pop() ?? url
  } else {
    dbType = "Unknown"
    dbHost = "(unset)"
  }

  return { dbType, dbHost, isTurso, isLocalFile }
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
            label="Database"
            value={dbInfo.dbType}
            color={dbInfo.isTurso ? "#047857" : "#6B7280"}
            sub={dbInfo.dbHost}
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
