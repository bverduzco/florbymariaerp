import { Sidebar } from "@/components/sidebar"
import { TopBar } from "@/components/top-bar"
import { MobileNav } from "@/components/mobile-nav"

// Route group layout — wraps all ERP pages with the shared sidebar + top bar.
// Matches the wireframe's design system:
//   - Background: #FAFAF9 (stone-50)
//   - Sidebar: 240px, white, border-right (desktop only — hidden on mobile)
//   - Top bar: 48px, white, border-bottom, logout button
//   - Main content: 24px padding (desktop), 0 padding (mobile — pages handle their own)
//   - MobileNav: bottom tab bar (mobile only — hidden on desktop)
//   - Primary accent: rose (#BE185D)

export default function ErpLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-[#FAFAF9]">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6 lg:p-6 max-lg:p-0">
          {children}
        </main>
      </div>
      <MobileNav />
    </div>
  )
}
