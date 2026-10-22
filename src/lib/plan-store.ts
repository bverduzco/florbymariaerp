"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"

export interface PlanItem {
  productSku: string
  qty: number
  /** ISO date (yyyy-mm-dd) when the customer wants the product delivered. Optional. */
  deliveryDate: string | null
  /** Customer name (free-text). Optional. */
  customerName: string | null
}

interface PlanStore {
  /** Items currently in the weekly plan */
  items: PlanItem[]
  /** Optional week start date (ISO yyyy-mm-dd) */
  weekStartDate: string | null
  /** Whether the shopping list panel is open */
  shoppingListOpen: boolean

  addItem: (sku: string, qty?: number, deliveryDate?: string | null, customerName?: string | null) => void
  removeItem: (sku: string) => void
  setQty: (sku: string, qty: number) => void
  setDeliveryDate: (sku: string, date: string | null) => void
  setCustomerName: (sku: string, name: string | null) => void
  clear: () => void
  setWeekStartDate: (date: string | null) => void
  setShoppingListOpen: (open: boolean) => void
}

export const usePlanStore = create<PlanStore>()(
  persist(
    (set) => ({
      items: [],
      weekStartDate: null,
      shoppingListOpen: false,
      addItem: (sku, qty = 1, deliveryDate = null, customerName = null) =>
        set((state) => {
          const existing = state.items.find((i) => i.productSku === sku)
          if (existing) {
            // If adding with deliveryDate/customerName, keep existing ones unless explicitly provided
            return {
              items: state.items.map((i) =>
                i.productSku === sku
                  ? {
                      ...i,
                      qty: i.qty + qty,
                      deliveryDate: deliveryDate !== null ? deliveryDate : i.deliveryDate,
                      customerName: customerName !== null && customerName !== "" ? customerName : i.customerName,
                    }
                  : i,
              ),
            }
          }
          return { items: [...state.items, { productSku: sku, qty, deliveryDate, customerName }] }
        }),
      removeItem: (sku) =>
        set((state) => ({
          items: state.items.filter((i) => i.productSku !== sku),
        })),
      setQty: (sku, qty) =>
        set((state) => ({
          items: state.items
            .map((i) => (i.productSku === sku ? { ...i, qty: Math.max(0, qty) } : i))
            .filter((i) => i.qty > 0),
        })),
      setDeliveryDate: (sku, date) =>
        set((state) => ({
          items: state.items.map((i) =>
            i.productSku === sku ? { ...i, deliveryDate: date } : i,
          ),
        })),
      setCustomerName: (sku, name) =>
        set((state) => ({
          items: state.items.map((i) =>
            i.productSku === sku ? { ...i, customerName: name } : i,
          ),
        })),
      clear: () => set({ items: [] }),
      setWeekStartDate: (date) => set({ weekStartDate: date }),
      setShoppingListOpen: (open) => set({ shoppingListOpen: open }),
    }),
    { name: "flor-plan-store" },
  ),
)
