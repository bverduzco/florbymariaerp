"use client"

import { useRouter, usePathname, useSearchParams } from "next/navigation"

const MONTHS = [
  { value: 1, label: "January" }, { value: 2, label: "February" },
  { value: 3, label: "March" }, { value: 4, label: "April" },
  { value: 5, label: "May" }, { value: 6, label: "June" },
  { value: 7, label: "July" }, { value: 8, label: "August" },
  { value: 9, label: "September" }, { value: 10, label: "October" },
  { value: 11, label: "November" }, { value: 12, label: "December" },
]

/**
 * MonthPicker — navigates to ?month=YYYY-MM via URL search params.
 * Shows a <select> for month + a <select> for year. Both update the URL,
 * which causes the server component to re-fetch data for the new month.
 */
export function MonthPicker({ currentMonth, currentYear }: { currentMonth: number; currentYear: number }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function navigate(month: number, year: number) {
    const params = new URLSearchParams(searchParams.toString())
    params.set("month", `${year}-${String(month).padStart(2, "0")}`)
    router.push(`${pathname}?${params.toString()}`)
  }

  const years = [2026, 2027, 2028]

  return (
    <div className="flex items-center gap-1">
      <select
        value={currentMonth}
        onChange={(e) => navigate(Number(e.target.value), currentYear)}
        className="px-3 py-1.5 text-sm font-medium border border-stone-300 rounded-md bg-white hover:bg-stone-50 transition cursor-pointer"
      >
        {MONTHS.map((m) => (
          <option key={m.value} value={m.value}>{m.label}</option>
        ))}
      </select>
      <select
        value={currentYear}
        onChange={(e) => navigate(currentMonth, Number(e.target.value))}
        className="px-3 py-1.5 text-sm font-medium border border-stone-300 rounded-md bg-white hover:bg-stone-50 transition cursor-pointer"
      >
        {years.map((y) => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>
    </div>
  )
}
