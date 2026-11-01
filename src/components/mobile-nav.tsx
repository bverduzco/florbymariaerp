"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

/**
 * <MobileNav> — bottom tab bar for mobile (replaces sidebar on small screens).
 *
 * Option C: 5 tabs — Inicio · Cotiz · Pedidos · Compras · Ejec
 * Wiki is NOT in the bottom nav (accessible via hamburger menu + landing button).
 *
 * Shown only on screens < lg (1024px). Hidden on desktop where the
 * sidebar is always visible.
 *
 * Active state is determined by pathname matching.
 */

const TABS = [
  { href: "/", icon: "🏠", label: "Inicio", match: (p: string) => p === "/" },
  { href: "/quotes", icon: "📋", label: "Cotiz.", match: (p: string) => p.startsWith("/quotes") },
  { href: "/orders", icon: "🛒", label: "Pedidos", match: (p: string) => p.startsWith("/orders") },
  { href: "/shoppinglist", icon: "📝", label: "Compras", match: (p: string) => p.startsWith("/shoppinglist") },
  { href: "/execution", icon: "🔨", label: "Ejec.", match: (p: string) => p.startsWith("/execution") },
]

export function MobileNav() {
  const pathname = usePathname()

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-[#E7E5E4]"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="flex">
        {TABS.map((tab) => {
          const isActive = tab.match(pathname)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex-1 flex flex-col items-center gap-1 py-2 transition ${
                isActive ? "text-[#BE185D]" : "text-[#78716C] hover:text-[#44403C]"
              }`}
            >
              <span className="text-lg leading-none" style={{ fontSize: "20px" }}>
                {tab.icon}
              </span>
              <span
                className={`text-[9px] ${isActive ? "font-semibold" : "font-medium"}`}
              >
                {tab.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
