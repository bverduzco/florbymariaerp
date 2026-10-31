"use client"

/**
 * <DepositPreview> — shared deposit cell + decline warning + override checkbox.
 *
 * Used by both New Quote dialogs (Quotes tab + Catalogue → Add to Quote → New mode).
 * Renders:
 *   - When no lines: nothing (the parent shows its own empty state)
 *   - When decline rule + not overridden: red warning banner + override checkbox
 *   - When decline rule + overridden: amber "override active" banner
 *   - When other rules: 4-cell totals summary (Subtotal / IVA / Total / Deposit)
 *   - When warning (no date, etc.): amber info banner
 *
 * State:
 *   - `overrideDecline` is owned by the parent (passed in + setter passed in)
 *     so the parent can include it in the submit payload.
 */

import { useState } from "react"
import { computePaymentRule } from "@/lib/payment-rules"

export function DepositPreview({
  total,
  quoteMode,
  eventDate,
  overrideDecline,
  setOverrideDecline,
}: {
  total: number
  quoteMode: "event" | "no_event"
  eventDate: string // yyyy-mm-dd or empty
  overrideDecline: boolean
  setOverrideDecline: (v: boolean) => void
}) {
  // Don't render anything if there's nothing to compute (no lines yet)
  if (total <= 0) return null

  const rule = computePaymentRule(quoteMode, eventDate || null)
  const subtotal = total / 1.16 // back out IVA from total
  const iva = total - subtotal
  const depositRequired = total * rule.depositPct

  return (
    <div className="space-y-2">
      {/* ── 4-cell totals summary ──────────────────────────── */}
      <div className="grid grid-cols-4 gap-2">
        <div className="p-3 bg-stone-50 border border-stone-200 rounded-md text-center">
          <div className="text-[9px] uppercase tracking-wider text-stone-500">
            Subtotal
          </div>
          <div className="text-base font-bold text-stone-800">
            ${subtotal.toLocaleString("es-MX", { maximumFractionDigits: 2 })}
          </div>
        </div>
        <div className="p-3 bg-stone-50 border border-stone-200 rounded-md text-center">
          <div className="text-[9px] uppercase tracking-wider text-stone-500">
            IVA (16%)
          </div>
          <div className="text-base font-bold text-stone-800">
            ${iva.toLocaleString("es-MX", { maximumFractionDigits: 2 })}
          </div>
        </div>
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-md text-center">
          <div className="text-[9px] uppercase tracking-wider text-rose-700">
            Total
          </div>
          <div className="text-base font-bold text-rose-900">
            ${total.toLocaleString("es-MX", { maximumFractionDigits: 2 })}
          </div>
        </div>
        <div
          className={`p-3 border rounded-md text-center ${
            rule.decline && !overrideDecline
              ? "bg-red-50 border-red-300"
              : rule.decline && overrideDecline
                ? "bg-amber-50 border-amber-300"
                : "bg-amber-50 border-amber-200"
          }`}
        >
          <div className="text-[9px] uppercase tracking-wider text-amber-700">
            {rule.shortLabel}
          </div>
          <div
            className={`text-base font-bold ${
              rule.decline && !overrideDecline ? "text-red-700" : "text-amber-900"
            }`}
          >
            {rule.decline && !overrideDecline
              ? "⚠ Decline"
              : `$${depositRequired.toLocaleString("es-MX", { maximumFractionDigits: 2 })}`}
          </div>
        </div>
      </div>

      {/* ── Soft warning (no date, etc.) ──────────────────── */}
      {rule.warning && !rule.decline && (
        <div className="p-2 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-800">
          ⚠ {rule.warning}
        </div>
      )}

      {/* ── Decline warning + override checkbox ──────────── */}
      {rule.decline && (
        <div className="p-3 bg-red-50 border border-red-300 rounded-md text-xs text-red-800">
          <div className="font-semibold mb-1">⚠ {rule.label}</div>
          <div className="mb-2">{rule.warning}</div>
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={overrideDecline}
              onChange={(e) => setOverrideDecline(e.target.checked)}
              className="mt-0.5 accent-red-700"
            />
            <span>
              <span className="font-medium">
                I confirm — accept this quote anyway
              </span>
              <span className="block text-red-700 text-[10px] mt-0.5">
                The override will be logged in the quote&apos;s notes with your
                name + date.
              </span>
            </span>
          </label>
          {overrideDecline && (
            <div className="mt-2 p-2 bg-amber-100 border border-amber-300 rounded text-amber-900">
              ✓ Override active — quote will be created with the would-be
              deposit of ${depositRequired.toLocaleString("es-MX", { maximumFractionDigits: 2 })}{" "}
              (50% of total). The event_declined_too_close rule will be
              recorded for audit.
            </div>
          )}
        </div>
      )}

      {/* ── Rule label (always shown for transparency) ──── */}
      {!rule.decline && (
        <div className="text-[10px] text-stone-500">
          Payment rule: <span className="font-mono">{rule.rule}</span> ·{" "}
          {rule.label}
        </div>
      )}
    </div>
  )
}
