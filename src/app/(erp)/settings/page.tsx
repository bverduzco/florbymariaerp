export const dynamic = "force-dynamic"

import { db as prisma } from "@/lib/db"

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

export default async function SettingsPage() {
  const [settings, counts] = await Promise.all([getSettings(), getCounts()])
  const settingsMap = new Map(settings.map((s) => [s.key, s.value]))

  function val(key: string): string {
    return settingsMap.get(key) ?? DEFAULTS[key]?.value ?? ""
  }

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

      {/* System Info */}
      <div className="fmd-box">
        <div className="fmd-box-label">System Information</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "12px" }}>
          <div><div style={{ fontSize: "10px", textTransform: "uppercase", color: "#78716C" }}>Prisma models</div><div style={{ fontSize: "18px", fontWeight: 700, color: "#44403C" }}>39</div></div>
          <div><div style={{ fontSize: "10px", textTransform: "uppercase", color: "#78716C" }}>Database</div><div style={{ fontSize: "18px", fontWeight: 700, color: "#44403C" }}>SQLite</div></div>
          <div><div style={{ fontSize: "10px", textTransform: "uppercase", color: "#78716C" }}>Cloudinary</div><div style={{ fontSize: "18px", fontWeight: 700, color: "#44403C" }}>mvtqdpen</div></div>
          <div><div style={{ fontSize: "10px", textTransform: "uppercase", color: "#78716C" }}>ERP version</div><div style={{ fontSize: "18px", fontWeight: 700, color: "#44403C" }}>v1.9</div></div>
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
