import { Sidebar } from "@/components/sidebar"

// Route group layout — wraps all ERP pages with the shared sidebar.
// URL paths are NOT affected: /quotes stays /quotes, /dashboard stays /dashboard.
// The (erp) folder name is a Next.js convention for grouping without URL impact.

export default function ErpLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-stone-50">
      <Sidebar />
      {/* Main content area — offset by sidebar width on desktop */}
      <div className="lg:pl-60">
        {/* Top bar (mobile hamburger lives in Sidebar component) */}
        <div className="hidden lg:block sticky top-0 z-30 bg-white/80 backdrop-blur-sm border-b border-stone-200 h-12" />
        <div className="p-6 lg:p-8 pt-16 lg:pt-8">
          {children}
        </div>
      </div>
    </div>
  )
}
