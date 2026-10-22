"use client"

import { useEffect, useRef, useState } from "react"
import { Input } from "@/components/ui/input"
import { User, X } from "lucide-react"

interface Customer {
  id: string
  name: string
  phone?: string
}

interface CustomerInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  ariaLabel?: string
  className?: string
}

/**
 * Customer name input with autocomplete dropdown.
 * Fetches customers from /api/customers on mount, then shows a filtered
 * dropdown as the user types. Selecting a suggestion fills the input.
 *
 * Free-text entry is still allowed — the user can type any name.
 */
export function CustomerInput({
  value,
  onChange,
  placeholder = "Customer",
  ariaLabel,
  className = "",
}: CustomerInputProps) {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [focused, setFocused] = useState(false)
  const [highlightIdx, setHighlightIdx] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    fetch("/api/customers", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { customers: [] }))
      .then((data) => {
        if (!cancelled) {
          setCustomers((data.customers ?? []).map((c: Customer) => ({
            id: c.id,
            name: c.name,
            phone: c.phone,
          })))
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  // Filtered suggestions (max 6)
  const suggestions = focused && value.trim().length > 0
    ? customers
        .filter((c) => c.name.toLowerCase().includes(value.trim().toLowerCase()))
        .slice(0, 6)
    : focused && value.trim().length === 0
      ? customers.slice(0, 6)
      : []

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setFocused(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (suggestions.length === 0) return
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setHighlightIdx((i) => (i + 1) % suggestions.length)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setHighlightIdx((i) => (i - 1 + suggestions.length) % suggestions.length)
    } else if (e.key === "Enter" && highlightIdx >= 0) {
      e.preventDefault()
      const picked = suggestions[highlightIdx]
      onChange(picked.name)
      setFocused(false)
      setHighlightIdx(-1)
    } else if (e.key === "Escape") {
      setFocused(false)
      setHighlightIdx(-1)
    }
  }

  return (
    <div className="relative" ref={containerRef}>
      <User className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone-400 pointer-events-none z-10" />
      <Input
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setHighlightIdx(-1)
        }}
        onFocus={() => setFocused(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className={`${className} w-full`}
        autoComplete="off"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 p-0.5"
          aria-label="Clear customer name"
        >
          <X className="h-3 w-3" />
        </button>
      )}

      {focused && suggestions.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-stone-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
          {suggestions.map((c, i) => (
            <button
              key={c.id}
              type="button"
              onMouseDown={(e) => {
                // Prevent input blur before click
                e.preventDefault()
                onChange(c.name)
                setFocused(false)
                setHighlightIdx(-1)
              }}
              onMouseEnter={() => setHighlightIdx(i)}
              className={`w-full text-left px-2 py-1.5 text-xs transition-colors ${
                i === highlightIdx ? "bg-rose-50 text-rose-800" : "text-stone-700 hover:bg-stone-100"
              }`}
            >
              <div className="font-medium">{c.name}</div>
              {c.phone && <div className="text-[10px] text-stone-500">{c.phone}</div>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
