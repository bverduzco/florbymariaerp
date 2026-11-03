// src/app/(erp)/payments/page.tsx — wireframe-matched styling

export const dynamic = "force-dynamic"

import { db as prisma } from "@/lib/db"
import { RecordPaymentDialog } from "./record-payment-dialog"
import { PaymentsFilters } from "./payments-filters"

async function getPayments() {
  return prisma.payment.findMany({ orderBy: { date: "desc" } })
}

export default async function PaymentsPage() {
  const payments = await getPayments()

  const monthStart = new Date("2026-10-01")
  const monthEnd = new Date("2026-10-31")
  const inMonth = payments.filter((p) => p.direction === "inbound" && p.date >= monthStart && p.date <= monthEnd && p.status === "confirmed").reduce((s, p) => s + p.amount, 0)
  const outMonth = payments.filter((p) => p.direction === "outbound" && p.date >= monthStart && p.date <= monthEnd && p.status === "confirmed").reduce((s, p) => s + p.amount, 0)
  const net = inMonth - outMonth
  const pending = payments.filter((p) => p.status === "pending").reduce((s, p) => s + p.amount, 0)

  const serialized = payments.map((p) => ({
    id: p.id, paymentNumber: p.paymentNumber, date: p.date.toISOString(),
    direction: p.direction, type: p.type, linkedId: p.linkedId, linkedName: p.linkedName,
    amount: p.amount, method: p.method, reference: p.reference, status: p.status,
    recordedBy: p.recordedBy, notes: p.notes,
  }))

  return (
    <div>
      <div className="fmd-screen-header">
        <div>
          <h1>Payments</h1>
          <div className="fmd-subtitle">Unified money ledger · in (customers) + out (suppliers)</div>
        </div>
        <RecordPaymentDialog />
      </div>

      <div className="fmd-kpi-bar">
        <div className="fmd-kpi-cell"><div className="fmd-kpi-value" style={{ color: "#047857" }}>+${inMonth.toLocaleString("es-MX", { maximumFractionDigits: 0 })}</div><div className="fmd-kpi-label">In this month</div></div>
        <div className="fmd-kpi-cell"><div className="fmd-kpi-value" style={{ color: "#991B1B" }}>-${outMonth.toLocaleString("es-MX", { maximumFractionDigits: 0 })}</div><div className="fmd-kpi-label">Out this month</div></div>
        <div className="fmd-kpi-cell"><div className="fmd-kpi-value" style={{ color: net >= 0 ? "#047857" : "#991B1B" }}>{net >= 0 ? "+" : "-"}${Math.abs(net).toLocaleString("es-MX", { maximumFractionDigits: 0 })}</div><div className="fmd-kpi-label">Net cash flow</div></div>
        <div className="fmd-kpi-cell"><div className="fmd-kpi-value" style={{ color: "#D97706" }}>${pending.toLocaleString("es-MX", { maximumFractionDigits: 0 })}</div><div className="fmd-kpi-label">Pending</div></div>
      </div>

      <div className="fmd-box">
        <div className="fmd-box-label">All Payments ({payments.length})</div>
        <PaymentsFilters payments={serialized} />
      </div>

      <div className="fmd-note blue">💡 Small orders = 100% prepay. Events = 50% deposit + 50% balance 14 days before. All suppliers = COD.</div>
    </div>
  )
}
