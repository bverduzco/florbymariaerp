"use client"

import Link from "next/link"

// Top bar — matches wireframe: 48px, white, border-bottom, logout button on right
export function TopBar() {
  return (
    <div
      className="flex items-center justify-end px-4 bg-white border-b border-[#D6D3D1] flex-shrink-0"
      style={{ height: "48px" }}
    >
      <Link
        href="/login"
        className="text-xs text-[#78716C] hover:text-[#44403C] transition px-3 py-1.5 rounded border border-[#D6D3D1] hover:bg-[#FAFAF9]"
      >
        ⎋ Logout
      </Link>
    </div>
  )
}
