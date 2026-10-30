import { db as prisma } from "@/lib/db"
import { AddStaffDialog } from "./add-staff-dialog"

async function getStaff() { return prisma.staff.findMany({ orderBy: [{ active: "desc" }, { dateAdded: "asc" }] }) }

export default async function StaffPage() {
  const staff = await getStaff()
  const active = staff.filter((s) => s.active).length
  const internal = staff.filter((s) => s.type === "internal").length
  const freelance = staff.filter((s) => s.type === "freelance").length

  return (
    <div>
      <div className="fmd-screen-header">
        <div><h1>Staff</h1><div className="fmd-subtitle">Team members + skills + pay rates</div></div>
        <AddStaffDialog />
      </div>
      <div className="fmd-kpi-bar">
        <div className="fmd-kpi-cell"><div className="fmd-kpi-value" style={{ color: "#44403C" }}>{staff.length}</div><div className="fmd-kpi-label">Total staff</div></div>
        <div className="fmd-kpi-cell"><div className="fmd-kpi-value" style={{ color: "#047857" }}>{active}</div><div className="fmd-kpi-label">Active</div></div>
        <div className="fmd-kpi-cell"><div className="fmd-kpi-value" style={{ color: "#BE185D" }}>{internal} int / {freelance} free</div><div className="fmd-kpi-label">Type mix</div></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "8px" }}>
        {staff.map((s) => {
          const skills = s.skills?.split(",").map((sk) => sk.trim()).filter(Boolean) ?? []
          const initials = s.name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase()
          return (
            <div key={s.id} className="fmd-box" style={{ marginBottom: 0, opacity: s.active ? 1 : 0.6 }}>
              <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                <div style={{ width: "40px", height: "40px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: 700, flexShrink: 0, background: s.type === "internal" ? "#FCE7F3" : "#EFF6FF", color: s.type === "internal" ? "#BE185D" : "#2563EB" }}>{initials}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontSize: "13px", fontWeight: 600, color: "#44403C" }}>{s.name}</div>
                    <span className={`fmd-status ${s.active ? "accepted" : "expired"}`}>{s.active ? "● Active" : "○ Inactive"}</span>
                  </div>
                  <div style={{ fontSize: "10px", color: "#78716C", fontFamily: "monospace" }}>{s.staffNumber} · {s.type}</div>
                  {s.phone && <div style={{ fontSize: "11px", color: "#6B7280", marginTop: "4px" }}>📞 {s.phone}</div>}
                  {skills.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "6px" }}>
                      {skills.map((sk) => <span key={sk} className="fmd-status" style={{ background: "#F3F4F6", color: "#44403C" }}>{sk}</span>)}
                    </div>
                  )}
                  {s.payRate && <div style={{ fontSize: "11px", color: "#78716C", marginTop: "4px" }}>${s.payRate}/hr</div>}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
