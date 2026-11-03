export const dynamic = "force-dynamic"

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
      <div className="fmd-box">
        <div className="fmd-box-label">Staff Directory</div>
        <div style={{ overflowX: "auto" }}>
          <table className="fmd-table">
            <thead>
              <tr>
                <th>Staff ID</th>
                <th>Name</th>
                <th>Type</th>
                <th>Phone</th>
                <th>Skills</th>
                <th style={{ textAlign: "right" }}>Pay Rate</th>
                <th>Status</th>
                <th>Added</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => {
                const skills = s.skills?.split(",").map((sk) => sk.trim()).filter(Boolean) ?? []
                return (
                  <tr key={s.id} style={{ opacity: s.active ? 1 : 0.6 }}>
                    <td style={{ fontFamily: "monospace", fontSize: "11px" }}>{s.staffNumber}</td>
                    <td style={{ fontWeight: 600, color: "#44403C" }}>{s.name}</td>
                    <td><span className="fmd-status" style={{ background: s.type === "internal" ? "#FCE7F3" : "#EFF6FF", color: s.type === "internal" ? "#BE185D" : "#2563EB" }}>{s.type}</span></td>
                    <td>{s.phone ?? "—"}</td>
                    <td>
                      {skills.length > 0 ? (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "3px" }}>
                          {skills.map((sk) => <span key={sk} className="fmd-status" style={{ background: "#F3F4F6", color: "#44403C" }}>{sk}</span>)}
                        </div>
                      ) : "—"}
                    </td>
                    <td style={{ textAlign: "right" }}>{s.payRate ? `$${s.payRate}/hr` : "—"}</td>
                    <td><span className={`fmd-status ${s.active ? "accepted" : "expired"}`}>{s.active ? "Active" : "Inactive"}</span></td>
                    <td style={{ fontSize: "11px" }}>{s.dateAdded.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
