import { db as prisma } from "@/lib/db"
import { LogExpenseDialog } from "./log-expense-dialog"

async function getExpenses() { return prisma.expense.findMany({ orderBy: { date: "desc" } }) }

const CAT_EMOJI: Record<string, string> = { gas: "⛽", parking: "🅿️", software: "💻", utilities: "💡", labor: "👤", venue_fee: "🏛️", equipment_rental: "🔧", market_run: "🛒", other: "📦" }

export default async function ExpensesPage() {
  const expenses = await getExpenses()
  const total = expenses.length
  const totalAmount = expenses.reduce((s, e) => s + e.amount, 0)
  const monthStart = new Date("2026-10-01"), monthEnd = new Date("2026-10-31")
  const thisMonth = expenses.filter((e) => e.date >= monthStart && e.date <= monthEnd).reduce((s, e) => s + e.amount, 0)
  const byCategory = expenses.reduce((acc, e) => { if (!acc[e.category]) acc[e.category] = { count: 0, total: 0 }; acc[e.category].count++; acc[e.category].total += e.amount; return acc }, {} as Record<string, { count: number; total: number }>)

  return (
    <div>
      <div className="fmd-screen-header">
        <div><h1>Expenses</h1><div className="fmd-subtitle">Operating costs · gas, parking, software, etc.</div></div>
        <LogExpenseDialog />
      </div>
      <div className="fmd-kpi-bar">
        <div className="fmd-kpi-cell"><div className="fmd-kpi-value" style={{ color: "#44403C" }}>{total}</div><div className="fmd-kpi-label">Total expenses</div></div>
        <div className="fmd-kpi-cell"><div className="fmd-kpi-value" style={{ color: "#991B1B" }}>${thisMonth.toLocaleString("es-MX", { maximumFractionDigits: 0 })}</div><div className="fmd-kpi-label">This month</div></div>
        <div className="fmd-kpi-cell"><div className="fmd-kpi-value" style={{ color: "#D97706" }}>${totalAmount.toLocaleString("es-MX", { maximumFractionDigits: 0 })}</div><div className="fmd-kpi-label">All-time total</div></div>
      </div>
      {Object.keys(byCategory).length > 0 && (
        <div className="fmd-box">
          <div className="fmd-box-label">By Category</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "8px" }}>
            {Object.entries(byCategory).map(([cat, data]) => (
              <div key={cat} className="fmd-stat" style={{ textAlign: "left" }}>
                <div style={{ fontSize: "10px", textTransform: "uppercase", color: "#78716C" }}>{CAT_EMOJI[cat] ?? "📦"} {cat.replace(/_/g, " ")}</div>
                <div style={{ fontSize: "16px", fontWeight: 700, color: "#44403C" }}>${data.total.toLocaleString("es-MX", { maximumFractionDigits: 0 })}</div>
                <div style={{ fontSize: "10px", color: "#78716C" }}>{data.count}x</div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="fmd-box">
        <div className="fmd-box-label">All Expenses ({expenses.length})</div>
        <div style={{ overflowX: "auto" }}>
          <table className="fmd-table">
            <thead><tr><th>Expense #</th><th>Date</th><th>Category</th><th>Description</th><th>Vendor</th><th style={{ textAlign: "right" }}>Amount</th></tr></thead>
            <tbody>
              {expenses.map((e) => (
                <tr key={e.id}>
                  <td style={{ fontFamily: "monospace", fontSize: "11px" }}>{e.expenseNumber}</td>
                  <td>{e.date.toLocaleDateString("es-MX", { day: "2-digit", month: "short" })}</td>
                  <td><span className="fmd-status" style={{ background: "#F3F4F6", color: "#44403C" }}>{CAT_EMOJI[e.category] ?? "📦"} {e.category}</span></td>
                  <td style={{ color: "#44403C" }}>{e.description}</td>
                  <td>{e.vendorPayee ?? "—"}</td>
                  <td style={{ textAlign: "right", fontWeight: 700, color: "#991B1B" }}>${e.amount.toLocaleString("es-MX", { maximumFractionDigits: 2 })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
