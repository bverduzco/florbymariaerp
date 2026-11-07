export const dynamic = "force-dynamic"

import { db as prisma } from "@/lib/db"
import { AddLoanDialog } from "./add-loan-dialog"
import { ReturnLoanButton } from "./return-loan-button"

async function getLoans() {
  try {
    return await prisma.loanRecord.findMany({
      orderBy: [{ dateReturned: "asc" }, { dateBorrowed: "desc" }],
    })
  } catch {
    return []
  }
}

export default async function LoansPage() {
  const loans = await getLoans()
  const active = loans.filter((l) => !l.dateReturned)
  const returned = loans.filter((l) => l.dateReturned)

  return (
    <div>
      <div className="fmd-screen-header">
        <div><h1>Loans</h1><div className="fmd-subtitle">Borrowed items — vases, bases, equipment from other florists</div></div>
        <AddLoanDialog />
      </div>

      <div className="fmd-kpi-bar hidden lg:flex">
        <div className="fmd-kpi-cell"><div className="fmd-kpi-value" style={{ color: "#D97706" }}>{active.length}</div><div className="fmd-kpi-label">Active loans</div></div>
        <div className="fmd-kpi-cell"><div className="fmd-kpi-value" style={{ color: "#047857" }}>{returned.length}</div><div className="fmd-kpi-label">Returned</div></div>
        <div className="fmd-kpi-cell"><div className="fmd-kpi-value" style={{ color: "#44403C" }}>{loans.length}</div><div className="fmd-kpi-label">Total</div></div>
      </div>

      {loans.length === 0 ? (
        <div className="fmd-box" style={{ textAlign: "center", padding: "32px" }}>
          <div style={{ fontSize: "13px", color: "#78716C" }}>No loans recorded yet. Click <b>+ Add Loan</b> above to track a borrowed item.</div>
        </div>
      ) : (
        <div className="fmd-box">
          <div className="fmd-box-label">All Loans ({loans.length})</div>
          <div style={{ overflowX: "auto" }}>
            <table className="fmd-table">
              <thead>
                <tr>
                  <th>Loan #</th>
                  <th>Item</th>
                  <th>Description</th>
                  <th>Owner</th>
                  <th style={{ textAlign: "right" }}>Qty</th>
                  <th>Borrowed</th>
                  <th>Promised</th>
                  <th>Returned</th>
                  <th>Notes</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {loans.map((loan) => {
                  const isOverdue = !loan.dateReturned && loan.datePromised && new Date(loan.datePromised) < new Date()
                  return (
                    <tr key={loan.id} style={{ opacity: loan.dateReturned ? 0.6 : 1 }}>
                      <td style={{ fontFamily: "monospace", fontSize: "11px", fontWeight: 600, color: "#78716C" }}>{loan.loanNumber ?? "—"}</td>
                      <td style={{ fontWeight: 600, color: "#44403C" }}>{loan.itemName}</td>
                      <td style={{ fontSize: "11px", color: "#78716C" }}>{loan.description ?? "—"}</td>
                      <td>{loan.owner}</td>
                      <td style={{ textAlign: "right" }}>{loan.qty}</td>
                      <td style={{ fontSize: "11px" }}>{loan.dateBorrowed.toLocaleDateString("es-MX", { day: "2-digit", month: "short" })}</td>
                      <td style={{ fontSize: "11px", color: isOverdue ? "#991B1B" : "#78716C" }}>
                        {loan.datePromised ? loan.datePromised.toLocaleDateString("es-MX", { day: "2-digit", month: "short" }) : "—"}
                        {isOverdue && <span style={{ marginLeft: "4px", fontSize: "9px" }}>⚠ overdue</span>}
                      </td>
                      <td style={{ fontSize: "11px", color: loan.dateReturned ? "#047857" : "#9CA3AF" }}>
                        {loan.dateReturned ? loan.dateReturned.toLocaleDateString("es-MX", { day: "2-digit", month: "short" }) : "—"}
                      </td>
                      <td style={{ fontSize: "11px", color: "#78716C" }}>{loan.notes ?? "—"}</td>
                      <td>
                        {!loan.dateReturned && (
                          <ReturnLoanButton id={loan.id} itemName={loan.itemName} />
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="fmd-note blue">
        💡 Loans are items borrowed from other florists or venues (vases, bases, stands). They are NOT part of your inventory — they don't affect stock counts or cost calculations. Track them here so you know what to return.
      </div>
    </div>
  )
}
