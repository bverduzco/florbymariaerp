import { db as prisma } from "@/lib/db"

async function getSettings() { return prisma.workbookSetting.findMany({ orderBy: [{ section: "asc" }, { key: "asc" }] }) }
async function getCounts() {
  const [m, p, c, o, e, q, pay, exp, sup, st, bd, cd, sm, po, l, el, t, rv] = await Promise.all([
    prisma.material.count(), prisma.product.count(), prisma.customer.count(), prisma.order.count(), prisma.event.count(), prisma.quote.count(), prisma.payment.count(), prisma.expense.count(), prisma.supplier.count(), prisma.staff.count(), prisma.blockedDate.count(), prisma.capacityDay.count(), prisma.seasonMarker.count(), prisma.purchaseOrder.count(), prisma.loss.count(), prisma.executionLog.count(), prisma.tool.count(), prisma.recipeVersion.count(),
  ])
  return { m, p, c, o, e, q, pay, exp, sup, st, bd, cd, sm, po, l, el, t, rv }
}

export default async function SettingsPage() {
  const [settings, counts] = await Promise.all([getSettings(), getCounts()])
  const bySection = settings.reduce((acc, s) => { if (!acc[s.section]) acc[s.section] = []; acc[s.section].push(s); return acc }, {} as Record<string, typeof settings>)

  return (
    <div>
      <div className="fmd-screen-header"><div><h1>Settings</h1><div className="fmd-subtitle">Workbook configuration + system info</div></div></div>
      <div className="fmd-box">
        <div className="fmd-box-label">System Information</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "12px" }}>
          <div><div style={{ fontSize: "10px", textTransform: "uppercase", color: "#78716C" }}>Prisma models</div><div style={{ fontSize: "18px", fontWeight: 700, color: "#44403C" }}>39</div></div>
          <div><div style={{ fontSize: "10px", textTransform: "uppercase", color: "#78716C" }}>Database</div><div style={{ fontSize: "18px", fontWeight: 700, color: "#44403C" }}>SQLite</div></div>
          <div><div style={{ fontSize: "10px", textTransform: "uppercase", color: "#78716C" }}>Cloudinary</div><div style={{ fontSize: "18px", fontWeight: 700, color: "#44403C" }}>mvtqdpen</div></div>
          <div><div style={{ fontSize: "10px", textTransform: "uppercase", color: "#78716C" }}>ERP version</div><div style={{ fontSize: "18px", fontWeight: 700, color: "#44403C" }}>v1.9</div></div>
        </div>
      </div>
      <div className="fmd-box">
        <div className="fmd-box-label">Database Row Counts</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: "8px" }}>
          {[["Materials", counts.m], ["Products", counts.p], ["Customers", counts.c], ["Orders", counts.o], ["Events", counts.e], ["Quotes", counts.q], ["Payments", counts.pay], ["Expenses", counts.exp], ["Suppliers", counts.sup], ["Staff", counts.st], ["POs", counts.po], ["Losses", counts.l], ["Exec logs", counts.el], ["Tools", counts.t], ["Recipe ver", counts.rv], ["Blocked dates", counts.bd], ["Capacity days", counts.cd], ["Season markers", counts.sm]].map(([label, count]) => (
            <div key={label as string} className="fmd-stat" style={{ textAlign: "left" }}><div style={{ fontSize: "9px", textTransform: "uppercase", color: "#78716C" }}>{label}</div><div style={{ fontSize: "18px", fontWeight: 700, color: "#44403C" }}>{count}</div></div>
          ))}
        </div>
      </div>
      {Object.entries(bySection).map(([section, items]) => (
        <div key={section} className="fmd-box">
          <div className="fmd-box-label" style={{ textTransform: "capitalize" }}>{section}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "8px" }}>
            {items.map((s) => (<div key={s.id} style={{ padding: "10px", border: "1px solid #D6D3D1", borderRadius: "6px", background: "#FAFAF9" }}><code style={{ fontSize: "12px", fontWeight: 600, color: "#44403C" }}>{s.key}</code><div style={{ fontSize: "14px", fontWeight: 700, color: "#44403C", marginTop: "4px" }}>{s.value || <span style={{ color: "#D6D3D1", fontStyle: "italic" }}>(empty)</span>}</div>{s.notes && <div style={{ fontSize: "10px", color: "#78716C", marginTop: "4px" }}>{s.notes}</div>}</div>))}
          </div>
        </div>
      ))}
    </div>
  )
}
