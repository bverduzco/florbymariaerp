"use client"

/**
 * <QuotePdfButton> — clickable PDF icon that downloads the quote PDF.
 *
 * Two display modes (controlled by `variant` prop):
 *   - "icon"  → small PDF icon (used in the All Quotes table column)
 *   - "button" → labeled "⬇ Download PDF" button (used in the Quote detail page)
 *
 * Implementation: triggers a direct browser navigation to
 * /api/quotes/[id]/pdf — the browser handles the download automatically
 * because the API sets Content-Disposition: attachment.
 */

import Link from "next/link"

export function QuotePdfButton({
  quoteId,
  variant = "icon",
}: {
  quoteId: string
  variant?: "icon" | "button"
}) {
  if (variant === "button") {
    return (
      <Link
        href={`/api/quotes/${quoteId}/pdf`}
        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-rose-600 text-white rounded-md hover:bg-rose-700 transition"
        title="Download this quote as a PDF (customer-facing, Spanish)"
      >
        <span>📄</span>
        <span>Download PDF</span>
      </Link>
    )
  }

  // icon variant — used in table cell
  return (
    <Link
      href={`/api/quotes/${quoteId}/pdf`}
      className="inline-flex items-center justify-center w-7 h-7 text-stone-500 hover:text-rose-700 hover:bg-rose-50 rounded transition"
      title="Download PDF"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="12" y1="18" x2="12" y2="12" />
        <polyline points="9 15 12 18 15 15" />
      </svg>
      <span className="sr-only">Download PDF</span>
    </Link>
  )
}
