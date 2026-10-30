// src/app/staff/page.tsx
//
// Staff directory — people who do operational work.
// Maria (owner, STAFF-001) + future assistants/drivers.

import { db as prisma } from "@/lib/db"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AddStaffDialog } from "./add-staff-dialog"

async function getStaff() {
  return prisma.staff.findMany({
    orderBy: [{ active: "desc" }, { dateAdded: "asc" }],
  })
}

export default async function StaffPage() {
  const staff = await getStaff()

  const total = staff.length
  const active = staff.filter((s) => s.active).length
  const inactive = staff.filter((s) => !s.active).length
  const internal = staff.filter((s) => s.type === "internal").length
  const freelance = staff.filter((s) => s.type === "freelance").length

  return (
    <main className="min-h-screen bg-stone-50 px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-wrap justify-between items-start gap-4">
          <div>
            <div className="text-xs uppercase tracking-wider text-stone-500">
              People who do operational work · v1.9
            </div>
            <h1 className="mt-1 text-3xl font-bold text-stone-900">Staff</h1>
            <p className="mt-1 text-sm text-stone-600">
              Maria (owner) + future team. Structured with IDs so metrics can be calculated per person (waste rate, on-time delivery, assembly time).
            </p>
          </div>
          <AddStaffDialog />
        </header>

        {/* KPI bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 mb-6 border border-stone-200 rounded-lg overflow-hidden bg-white">
          <KpiCell value={`${total}`} label="Total staff" />
          <KpiCell value={`${active}`} label="Active" color="green" />
          <KpiCell value={`${inactive}`} label="Inactive" color="amber" />
          <KpiCell value={`${internal} int / ${freelance} free`} label="Type mix" color="purple" />
        </div>

        {/* Staff cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {staff.map((s) => {
            const skills = s.skills?.split(",").map((sk) => sk.trim()).filter(Boolean) ?? []
            const initials = s.name
              .split(" ")
              .slice(0, 2)
              .map((n) => n[0])
              .join("")
              .toUpperCase()
            return (
              <Card
                key={s.id}
                className={`border-stone-200 hover:shadow-sm transition ${
                  !s.active ? "opacity-70" : ""
                }`}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start gap-3">
                    {/* Avatar with initials */}
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                        s.type === "internal"
                          ? "bg-violet-100 text-violet-700"
                          : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-base truncate">{s.name}</CardTitle>
                        {s.active ? (
                          <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-300 flex-shrink-0">
                            ● Active
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs bg-stone-100 text-stone-500 border-stone-300 flex-shrink-0">
                            ○ Inactive
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="font-mono text-xs text-stone-500">{s.staffNumber}</span>
                        <Badge
                          variant="outline"
                          className={`text-xs ${
                            s.type === "internal"
                              ? "bg-violet-50 text-violet-700 border-violet-300"
                              : "bg-blue-50 text-blue-700 border-blue-300"
                          }`}
                        >
                          {s.type}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  {/* Contact */}
                  <div className="space-y-1 text-xs">
                    {s.phone && (
                      <div className="flex items-center gap-2 text-stone-700">
                        <span className="text-stone-400">📞</span>
                        <span>{s.phone}</span>
                      </div>
                    )}
                    {s.email && (
                      <div className="flex items-center gap-2 text-stone-700">
                        <span className="text-stone-400">✉️</span>
                        <span className="truncate">{s.email}</span>
                      </div>
                    )}
                    {!s.phone && !s.email && (
                      <div className="text-stone-400 italic">No contact info</div>
                    )}
                  </div>

                  {/* Skills */}
                  {skills.length > 0 && (
                    <div className="pt-2 border-t border-stone-100">
                      <div className="text-stone-500 text-xs uppercase tracking-wider mb-2">Skills</div>
                      <div className="flex flex-wrap gap-1">
                        {skills.map((skill) => (
                          <Badge
                            key={skill}
                            variant="outline"
                            className="text-xs bg-stone-50 text-stone-700 border-stone-300"
                          >
                            {skill}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Pay rate + date added */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-stone-100 text-xs">
                    <div>
                      <div className="text-stone-500">Pay rate</div>
                      <div className="text-stone-900 font-medium">
                        {s.payRate ? `$${s.payRate}/hr` : "—"}
                      </div>
                    </div>
                    <div>
                      <div className="text-stone-500">Added</div>
                      <div className="text-stone-900 font-medium">
                        {s.dateAdded.toLocaleDateString("es-MX", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Notes */}
                  {s.notes && (
                    <div className="pt-2 border-t border-stone-100 text-xs text-stone-500 italic">
                      {s.notes}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Future plans */}
        <Card className="mt-6 border-stone-200 bg-stone-50/50">
          <CardContent className="pt-6 text-sm text-stone-700 space-y-2">
            <div className="font-semibold text-stone-900">How staff is used in the ERP</div>
            <ul className="list-disc list-inside ml-2 space-y-1 text-xs">
              <li>Each staff member gets a <code className="rounded bg-white px-1.5 py-0.5 border border-stone-200">STAFF-NNNN</code> ID.</li>
              <li>Skills field is comma-separated: <code className="rounded bg-white px-1.5 py-0.5 border border-stone-200">assembly, delivery, conditioning, setup, teardown, design</code>.</li>
              <li>Pay Rate is optional — used for labor cost tracking (Phase 3).</li>
              <li>Active=false means no longer available (past freelancer, etc.).</li>
              <li><strong>Currently free-text fields</strong> on Orders (Delivered By), Execution Logs (Executed By), and Losses (Discovered By) will eventually become FK references to this Staff table.</li>
              <li>Enables per-person metrics: waste rate, on-time delivery, avg assembly time.</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

function KpiCell({
  value,
  label,
  color = "default",
}: {
  value: string
  label: string
  color?: "default" | "green" | "amber" | "purple"
}) {
  const colorMap = {
    default: "text-stone-900",
    green: "text-emerald-700",
    amber: "text-amber-700",
    purple: "text-violet-700",
  }
  return (
    <div className="p-3 border-r border-stone-200 last:border-r-0 min-w-[120px]">
      <div className={`text-xl font-bold ${colorMap[color]}`}>{value}</div>
      <div className="text-xs text-stone-500 mt-0.5">{label}</div>
    </div>
  )
}
