"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"

export interface PlanItem {
  productSku: string
  qty: number
}

interface PlanStore {
  /** Items currently in the weekly plan */
  items: PlanItem[]
  /** Optional week start date (ISO yyyy-mm-dd) */
  weekStartDate: string | null
  /** Whether the shopping list panel is open */
  shoppingListOpen: boolean

  addItem: (sku: string, qty?: number) => void
  removeItem: (sku: string) => void
  setQty: (sku: string, qty: number) => void
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
      addItem: (sku, qty = 1) =>
        set((state) => {
          const existing = state.items.find((i) => i.productSku === sku)
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.productSku === sku ? { ...i, qty: i.qty + qty } : i,
              ),
            }
          }
          return { items: [...state.items, { productSku: sku, qty }] }
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
      clear: () => set({ items: [] }),
      setWeekStartDate: (date) => set({ weekStartDate: date }),
      setShoppingListOpen: (open) => set({ shoppingListOpen: open }),
    }),
    { name: "flor-plan-store" },
  ),
)
