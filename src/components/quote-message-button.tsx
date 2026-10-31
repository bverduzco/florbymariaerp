"use client"

/**
 * <QuoteMessageButton> — clickable notebook icon that opens a dialog
 * showing the pre-written WhatsApp message for this quote, with a
 * "Copy to clipboard" button. Maria reviews/tweaks the message in the
 * textarea, then clicks Copy and pastes into WhatsApp manually.
 *
 * Two display modes (controlled by `variant` prop):
 *   - "icon"   → small notebook icon (used in the All Quotes table column)
 *   - "button" → labeled "💬 WhatsApp message" button (used in the Quote detail page)
 *
 * Implementation:
 *   1. On click, fetches /api/quotes/[id]/message (returns {message, waMeUrl, ...})
 *   2. Opens a Dialog with the message text in an editable <Textarea>
 *   3. "Copy to clipboard" button uses navigator.clipboard.writeText()
 *   4. Shows a "Open WhatsApp" link if the customer has a phone number
 *      (uses wa.me URL with pre-filled message)
 */

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"

export function QuoteMessageButton({
  quoteId,
  variant = "icon",
}: {
  quoteId: string
  variant?: "icon" | "button"
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")
  const [waMeUrl, setWaMeUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function handleOpenChange(next: boolean) {
    setOpen(next)
    if (next && !message) {
      // First open — fetch the message
      setLoading(true)
      try {
        const res = await fetch(`/api/quotes/${quoteId}/message`)
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error ?? "Failed to load message")
        }
        const data = await res.json()
        setMessage(data.message)
        setWaMeUrl(data.waMeUrl ?? null)
      } catch (e) {
        toast.error("Failed to load message", {
          description: e instanceof Error ? e.message : String(e),
        })
        setOpen(false)
      } finally {
        setLoading(false)
      }
    }
    if (!next) {
      // Reset copied state when closing
      setCopied(false)
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(message)
      setCopied(true)
      toast.success("Copied to clipboard", {
        description: "Paste into WhatsApp now (Ctrl+V / Cmd+V).",
      })
    } catch (e) {
      // Fallback: select the textarea contents so Maria can Ctrl+C manually
      toast.error("Couldn't auto-copy", {
        description:
          "Select the text in the box below and press Ctrl+C (or Cmd+C) to copy manually.",
      })
    }
  }

  const trigger = variant === "button" ? (
    <button
      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-stone-900 text-white rounded-md hover:bg-stone-800 transition"
      title="Show the WhatsApp message for this quote"
    >
      <span>💬</span>
      <span>WhatsApp message</span>
    </button>
  ) : (
    <button
      className="inline-flex items-center justify-center w-7 h-7 text-stone-500 hover:text-emerald-700 hover:bg-emerald-50 rounded transition"
      title="Show WhatsApp message"
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
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
      </svg>
      <span className="sr-only">Show WhatsApp message</span>
    </button>
  )

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-[640px] max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>WhatsApp message</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="py-8 text-center text-sm text-stone-500">
            Loading message…
          </div>
        ) : (
          <div className="space-y-3 pt-2">
            <p className="text-xs text-stone-500">
              Review the message below. Edit if needed, then click{" "}
              <b>Copy to clipboard</b> and paste into WhatsApp.
              {waMeUrl && (
                <>
                  {" "}
                  Or click <b>Open WhatsApp</b> to start a chat with the
                  message pre-filled (if the customer has a phone number).
                </>
              )}
            </p>
            <Textarea
              value={message}
              onChange={(e) => {
                setMessage(e.target.value)
                setCopied(false)
              }}
              rows={18}
              className="text-xs font-mono"
              placeholder="(message will appear here)"
            />
            <div className="flex items-center gap-2 text-xs text-stone-500">
              <span>{message.length} characters</span>
              {waMeUrl && (
                <span className="ml-auto">
                  ✅ Customer phone on file — one-click WhatsApp available
                </span>
              )}
            </div>
          </div>
        )}
        <DialogFooter className="gap-2">
          {waMeUrl && (
            <a
              href={waMeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition mr-auto"
              title="Opens WhatsApp with the message pre-filled (uses customer's phone number)"
            >
              <span>💬</span>
              <span>Open WhatsApp</span>
            </a>
          )}
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Close
          </Button>
          <Button type="button" onClick={handleCopy} disabled={!message}>
            {copied ? "✓ Copied" : "📋 Copy to clipboard"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
