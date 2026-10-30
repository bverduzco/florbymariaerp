"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"

const NAV_SECTIONS = [
  {
    title: "Sales",
    items: [
      { href: "/quotes", icon: "📋", label: "Quotes" },
      { href: "/orders", icon: "🛒", label: "Orders" },
      { href: "/customers", icon: "👥", label: "Customers" },
      { href: "/events", icon: "🎉", label: "Events" },
      { href: "/catalogue", icon: "🌸", label: "Catalogue" },
      { href: "/custom", icon: "🌷", label: "Custom Builder" },
    ],
  },
  {
    title: "Operations",
    items: [
      { href: "/materials", icon: "📦", label: "Materials" },
      { href: "/shoppinglist", icon: "🛒", label: "Shopping List" },
      { href: "/procurement", icon: "🚚", label: "Procurement" },
      { href: "/execution", icon: "🔨", label: "Execution Logs" },
      { href: "/losses", icon: "⚠️", label: "Losses" },
      { href: "/recipes", icon: "📖", label: "Recipes" },
    ],
  },
  {
    title: "Admin",
    items: [
      { href: "/dashboard", icon: "📊", label: "Dashboard" },
      { href: "/expenses", icon: "💸", label: "Expenses" },
      { href: "/payments", icon: "💰", label: "Payments" },
      { href: "/calendar", icon: "📅", label: "Calendar" },
      { href: "/suppliers", icon: "🏪", label: "Suppliers" },
      { href: "/legal", icon: "📄", label: "Legal Templates" },
      { href: "/settings", icon: "⚙️", label: "Settings" },
    ],
  },
  {
    title: "Team",
    items: [
      { href: "/staff", icon: "👤", label: "Staff" },
    ],
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="fixed top-3 left-3 z-50 lg:hidden p-2 rounded-md bg-white border border-stone-200 shadow-sm"
        aria-label="Toggle navigation"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {/* Overlay for mobile */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 bottom-0 w-60 bg-white border-r border-stone-200 z-40 overflow-y-auto transition-transform duration-200 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-stone-200">
          <Link href="/dashboard" className="flex items-center gap-3 group">
            <div className="w-8 h-8 rounded-lg bg-rose-500 flex items-center justify-center text-white text-lg font-bold group-hover:bg-rose-600 transition">
              ✿
            </div>
            <div>
              <div className="text-sm font-bold text-stone-900 leading-tight">Flor by Maria</div>
              <div className="text-[10px] text-stone-400">ERP v1.9</div>
            </div>
          </Link>
        </div>

        {/* Nav sections */}
        <nav className="py-2">
          {NAV_SECTIONS.map((section) => (
            <div key={section.title} className="py-2">
              <div className="px-4 py-1 text-[10px] font-semibold uppercase tracking-wider text-stone-400">
                {section.title}
              </div>
              <ul>
                {section.items.map((item) => {
                  const isActive = pathname === item.href
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setMobileOpen(false)}
                        className={`flex items-center gap-2.5 px-4 py-2 text-sm transition border-l-2 ${
                          isActive
                            ? "bg-rose-50 text-rose-800 border-rose-500 font-medium"
                            : "text-stone-600 border-transparent hover:bg-stone-50 hover:text-stone-900"
                        }`}
                      >
                        <span className="text-base opacity-80">{item.icon}</span>
                        <span>{item.label}</span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-4 py-4 border-t border-stone-200 mt-auto">
          <Link
            href="/login"
            className="flex items-center gap-2 text-xs text-stone-500 hover:text-stone-900 transition"
          >
            ⎋ Logout
          </Link>
        </div>
      </aside>
    </>
  )
}
