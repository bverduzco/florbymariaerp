"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

/**
 * DiscountSection — shows + edits the discount on a quote.
 *
 * Two modes:
 *   - flat: discount is a dollar amount ($200 off)
 *   - percentage: discount is a percentage (10% off)
 *
 * The discount applies to the subtotal (before IVA).
 * IVA + total + deposit recompute automatically on the server.
 *
 * Shows the live impact: "Saves $X · New total: $Y"
 */
export function DiscountSection({
  quoteId,
  discount,
  discountType,
  subtotal,
}: {
  quoteId: string
  discount: number
  discountType: string
  subtotal: number
}) {
  const [type, setType] = useState(discountType || "flat")
  const [value, setValue] = useState(discount.toString())
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  // Compute live preview
  const numericValue = Number(value) || 0
  const discountAmount =
    type === "percentage"
      ? subtotal * (numericValue / 100)
      : numericValue
  const discountedSubtotal = Math.max(0, subtotal - discountAmount)
  const newIva = discountedSubtotal * 0.16
  const newTotal = discountedSubtotal + newIva

  async function handleSave() {
    setLoading(true)
    try {
      const res = await fetch(`/api/quotes/${quoteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          discount: numericValue,
          discountType: type,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed")
      toast.success("Discount applied", {
        description:
          type === "percentage"
            ? `${numericValue}% off — saves $${discountAmount.toFixed(0)}`
            : `$${numericValue} off — saves $${numericValue}`,
      })
      router.refresh()
    } catch (e) {
      toast.error("Failed to apply discount", {
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setLoading(false)
    }
  }

  async function handleRemove() {
    setLoading(true)
    try {
      await fetch(`/api/quotes/${quoteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ discount: 0, discountType: "flat" }),
      })
      toast.success("Discount removed")
      setType("flat")
      setValue("0")
      router.refresh()
    } catch {
      toast.error("Failed to remove discount")
    } finally {
      setLoading(false)
    }
  }

  const hasDiscount = numericValue > 0

  return (
    <div className="border border-stone-200 rounded-md p-3 text-xs">
      <div className="flex items-center justify-between mb-2">
        <span className="uppercase tracking-wider text-stone-500 font-semibold">Discount</span>
        {hasDiscount && (
          <button
            type="button"
            onClick={handleRemove}
            disabled={loading}
            className="text-[10px] text-red-500 hover:underline"
          >
            Remove discount
          </button>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="h-8 text-xs w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="flat">$ Flat</SelectItem>
            <SelectItem value="percentage">% Percentage</SelectItem>
          </SelectContent>
        </Select>
        <Input
          type="number"
          step={type === "percentage" ? "1" : "0.01"}
          min="0"
          max={type === "percentage" ? "100" : undefined}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="h-8 text-xs w-24"
          placeholder={type === "percentage" ? "10" : "200"}
        />
        <span className="text-stone-400">{type === "percentage" ? "%" : "$"}</span>
        <Button
          type="button"
          size="sm"
          onClick={handleSave}
          disabled={loading || numericValue === discount}
          className="h-8 text-xs"
        >
          {loading ? "..." : "Apply"}
        </Button>
      </div>

      {hasDiscount && (
        <div className="mt-2 p-2 bg-rose-50 border border-rose-200 rounded text-[11px]">
          <div className="flex justify-between">
            <span className="text-stone-600">Original subtotal</span>
            <span className="line-through text-stone-400">${subtotal.toLocaleString("es-MX", { maximumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-rose-700">Discount ({type === "percentage" ? `${numericValue}%` : `flat`})</span>
            <span className="text-rose-700">−${discountAmount.toLocaleString("es-MX", { maximumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between border-t border-rose-200 mt-1 pt-1">
            <span className="font-semibold text-stone-700">New total (with IVA)</span>
            <span className="font-bold text-rose-900">${newTotal.toLocaleString("es-MX", { maximumFractionDigits: 2 })}</span>
          </div>
        </div>
      )}
    </div>
  )
}
