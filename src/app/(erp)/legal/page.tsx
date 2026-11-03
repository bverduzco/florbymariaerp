export const dynamic = "force-dynamic"

import { db as prisma } from "@/lib/db"

async function getLegalData() {
  const [templates, variables, settings] = await Promise.all([
    prisma.legalTemplate.findMany({ orderBy: { templateNumber: "asc" } }),
    prisma.templateVariable.findMany({ orderBy: { placeholder: "asc" } }),
    prisma.workbookSetting.findMany(),
  ])
  return { templates, variables, settings }
}

const APPLY_EMOJI: Record<string, string> = { all_quotes: "📝", small_orders: "📦", event_quotes: "💒", all_customers: "👥" }

// Default values for placeholders that don't have a WorkbookSetting yet
const DEFAULT_VALUES: Record<string, string> = {
  "[Nombre o razón social]": "Flor by Maria",
  "[Nombre comercial]": "Flor by Maria",
  "[Nombre completo o razón social]": "Flor by Maria",
  "[domicilio]": "(business address — set in Settings)",
  "[calle, número, colonia, C.P., municipio, estado]": "(business address — set in Settings)",
  "[correo]": "(business email — set in Settings)",
  "[correo del responsable de datos]": "(business email — set in Settings)",
  "[TELÉFONO]": "(WhatsApp number — set in Settings)",
  "[URL]": "(website URL — set in Settings)",
  "[URL del sitio]": "(website URL — set in Settings)",
  "[QR]": "(QR code — auto-generated at render time)",
  "[BANCO]": "(bank name — set in Settings)",
  "[CLABE]": "(18-digit CLABE — set in Settings)",
  "[TITULAR]": "(account holder — set in Settings)",
  "[48 horas]": "48 hours",
  "[20%]": "20%",
  "[90]": "90",
  "[3]": "3",
  "[30]": "30",
  "[7]": "7",
  "[15]": "15",
  "[20]": "20",
  "[día]": new Date().getDate().toString(),
  "[mes]": new Date().toLocaleDateString("es-MX", { month: "long" }),
  "[año]": new Date().getFullYear().toString(),
}

function substitutePlaceholders(text: string, settingsMap: Map<string, string>): { preview: string; replaced: Array<{ placeholder: string; value: string; source: string }> } {
  const replaced: Array<{ placeholder: string; value: string; source: string }> = []
  let preview = text

  // Settings-based substitution
  const settingsKeys: Record<string, string> = {
    "[Nombre o razón social]": "businessName",
    "[Nombre comercial]": "businessName",
    "[Nombre completo o razón social]": "businessName",
    "[domicilio]": "address",
    "[calle, número, colonia, C.P., municipio, estado]": "address",
    "[correo]": "email",
    "[correo del responsable de datos]": "email",
    "[TELÉFONO]": "phone",
    "[URL]": "website_url",
    "[URL del sitio]": "website_url",
    "[BANCO]": "banco",
    "[CLABE]": "clabe",
    "[TITULAR]": "titular",
  }

  for (const [placeholder, settingKey] of Object.entries(settingsKeys)) {
    if (preview.includes(placeholder)) {
      const value = settingsMap.get(settingKey) || DEFAULT_VALUES[placeholder] || "(not set)"
      const source = settingsMap.get(settingKey) ? `Settings → ${settingKey}` : "default"
      preview = preview.replaceAll(placeholder, value)
      replaced.push({ placeholder, value, source })
    }
  }

  // Default-only substitutions (no settings key)
  for (const [placeholder, value] of Object.entries(DEFAULT_VALUES)) {
    if (preview.includes(placeholder)) {
      // Only add to replaced list if not already added
      if (!replaced.find((r) => r.placeholder === placeholder)) {
        preview = preview.replaceAll(placeholder, value)
        replaced.push({ placeholder, value, source: "default" })
      }
    }
  }

  return { preview, replaced }
}

export default async function LegalPage() {
  const { templates, variables, settings } = await getLegalData()
  const needNewFields = variables.filter((v) => v.cellOrField?.includes("new field")).length

  const settingsMap = new Map(settings.map((s) => [s.key, s.value]))

  return (
    <div>
      <div className="fmd-screen-header">
        <div><h1>Legal Templates</h1><div className="fmd-subtitle">Privacy notices, terms & conditions — with [PLACEHOLDER] substitution</div></div>
      </div>

      <div className="fmd-kpi-bar">
        <div className="fmd-kpi-cell"><div className="fmd-kpi-value" style={{ color: "#44403C" }}>{templates.length}</div><div className="fmd-kpi-label">Templates</div></div>
        <div className="fmd-kpi-cell"><div className="fmd-kpi-value" style={{ color: "#BE185D" }}>{variables.length}</div><div className="fmd-kpi-label">Placeholders</div></div>
        <div className="fmd-kpi-cell"><div className="fmd-kpi-value" style={{ color: "#D97706" }}>{needNewFields}</div><div className="fmd-kpi-label">Need new fields</div></div>
      </div>

      {/* Template Library */}
      <div className="fmd-box">
        <div className="fmd-box-label">Template Library</div>
        <div style={{ overflowX: "auto" }}>
          <table className="fmd-table">
            <thead><tr><th>ID</th><th>Name</th><th>Applies To</th><th>Trigger</th><th>Version</th><th style={{ textAlign: "right" }}>Length</th></tr></thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id}>
                  <td style={{ fontFamily: "monospace", fontSize: "11px" }}>{t.templateNumber}</td>
                  <td style={{ fontWeight: 600, color: "#44403C" }}>{t.name}</td>
                  <td><span className="fmd-status" style={{ background: "#F3F4F6", color: "#44403C" }}>{APPLY_EMOJI[t.appliesTo] ?? "📄"} {t.appliesTo.replace(/_/g, " ")}</span></td>
                  <td style={{ fontSize: "11px" }}>{t.trigger}</td>
                  <td>{t.version}</td>
                  <td style={{ textAlign: "right" }}>{t.templateText.length.toLocaleString()} chars</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Template Preview with live substitution */}
      <div className="fmd-box">
        <div className="fmd-box-label">Template Preview (with placeholder substitution)</div>
        <div className="fmd-note blue" style={{ marginBottom: "12px" }}>
          Preview shows actual values from Settings replacing [PLACEHOLDERS]. Green text = substituted value. Pink text = placeholder still unresolved (set the value in Settings).
        </div>

        {templates.map((t) => {
          const { preview, replaced } = substitutePlaceholders(t.templateText, settingsMap)
          const unresolved = (t.templateText.match(/\[[^\]]+\]/g) ?? []).filter(
            (p) => !replaced.find((r) => r.placeholder === p)
          )

          return (
            <div key={t.id} style={{ marginBottom: "16px", border: "1px solid #D6D3D1", borderRadius: "8px", overflow: "hidden" }}>
              {/* Template header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "#FAFAF9", borderBottom: "1px solid #D6D3D1" }}>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "#44403C" }}>
                  {t.templateNumber} · {t.name}
                </div>
                <div style={{ fontSize: "11px", color: "#78716C" }}>
                  {replaced.length} substituted · {unresolved.length} unresolved
                </div>
              </div>

              {/* Substituted preview */}
              <div style={{ padding: "12px", background: "#ffffff", maxHeight: "200px", overflowY: "auto", fontSize: "11px", color: "#44403C", whiteSpace: "pre-wrap", lineHeight: "1.5" }}>
                {preview.slice(0, 1000)}
                {preview.length > 1000 && <span style={{ color: "#D6D3D1", fontStyle: "italic" }}>... ({preview.length - 1000} more chars)</span>}
              </div>

              {/* Substitution details */}
              {replaced.length > 0 && (
                <div style={{ padding: "8px 12px", borderTop: "1px solid #D6D3D1", background: "#FAFAF9" }}>
                  <div style={{ fontSize: "10px", textTransform: "uppercase", color: "#78716C", marginBottom: "6px" }}>Substitutions:</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                    {replaced.slice(0, 8).map((r, i) => (
                      <div key={i} style={{ fontSize: "10px", display: "flex", alignItems: "center", gap: "6px" }}>
                        <code style={{ color: "#BE185D", fontFamily: "monospace" }}>{r.placeholder}</code>
                        <span style={{ color: "#78716C" }}>→</span>
                        <span style={{ color: "#047857", fontWeight: 600 }}>{r.value}</span>
                        <span style={{ color: "#D6D3D1", fontSize: "9px" }}>({r.source})</span>
                      </div>
                    ))}
                    {replaced.length > 8 && <div style={{ fontSize: "9px", color: "#78716C" }}>... {replaced.length - 8} more</div>}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Template Variables reference table */}
      <div className="fmd-box">
        <div className="fmd-box-label">Template Variables — Placeholder → Data Source Mapping</div>
        <div style={{ overflowX: "auto" }}>
          <table className="fmd-table">
            <thead><tr><th>Placeholder</th><th>Source</th><th>Sheet</th><th>Cell / Field</th><th>Notes</th></tr></thead>
            <tbody>
              {variables.map((v) => (
                <tr key={v.id}>
                  <td style={{ fontFamily: "monospace", fontSize: "11px", color: "#BE185D" }}>{v.placeholder}</td>
                  <td>{v.dataSource}</td>
                  <td>{v.sheet ?? "—"}</td>
                  <td style={{ fontFamily: "monospace", fontSize: "11px" }}>{v.cellOrField}{v.cellOrField?.includes("new field") && <span className="fmd-status pending" style={{ marginLeft: "4px" }}>needed</span>}</td>
                  <td style={{ maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.notes ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
