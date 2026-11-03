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
      { href: "/seasons", icon: "🗓️", label: "Seasons" },
      { href: "/suppliers", icon: "🏪", label: "Suppliers" },
      { href: "/legal", icon: "📄", label: "Legal Templates" },
      { href: "/settings", icon: "⚙️", label: "Settings" },
    ],
  },
  {
    title: "Team",
    items: [
      { href: "/knowledge", icon: "📚", label: "Wiki" },
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
        className="fixed top-3 left-3 z-50 lg:hidden p-2 rounded-md bg-white border border-[#D6D3D1]"
        aria-label="Toggle navigation"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#44403C]">
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

      {/* Sidebar — always visible on desktop (flex child), slide-in on mobile */}
      <aside
        className={`fixed lg:sticky left-0 top-0 bottom-0 w-60 h-screen bg-white border-r border-[#D6D3D1] z-40 overflow-y-auto transition-transform duration-200 flex-shrink-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Header — matches wireframe: logo (rose bg, 8px radius) + title + version */}
        <div className="flex items-center gap-2 px-4 py-4 border-b border-[#D6D3D1]">
          <Link href="/" className="flex items-center gap-2 group">
            <img src="/flower-logo.svg" alt="Flor by Maria" width={32} height={32} className="rounded-lg group-hover:opacity-90 transition" />
            <div>
              <div className="text-sm font-bold text-[#44403C] leading-tight">Flor by Maria</div>
              <div className="text-[10px] text-[#78716C]">ERP v1.9</div>
            </div>
          </Link>
        </div>

        {/* Nav sections — matches wireframe zone structure */}
        <nav className="py-2">
          {NAV_SECTIONS.map((section) => (
            <div key={section.title} className="py-1">
              <div
                className="px-4 py-1 text-[10px] font-bold uppercase tracking-wider text-[#78716C]"
                style={{ letterSpacing: "1px" }}
              >
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
                        className={`flex items-center gap-2 px-4 py-2 text-[13px] transition border-l-[3px] ${
                          isActive
                            ? "bg-[#FCE7F3] text-[#BE185D] border-[#BE185D] font-semibold"
                            : "text-[#44403C] border-transparent hover:bg-[#FCE7F3]"
                        }`}
                      >
                        <span className="text-base opacity-70">{item.icon}</span>
                        <span>{item.label}</span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>
    </>
  )
}
