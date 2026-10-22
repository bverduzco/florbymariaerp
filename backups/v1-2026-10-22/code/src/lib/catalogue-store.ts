"use client"

import { create } from "zustand"

export interface CatalogueProduct {
  sku: string
  name: string
  category: string
  size: string
  description: string
  actualPriceBeforeIva: number
  totalCost: number
  marginPct: number
  linesToReview: number
  recipeLines: {
    componentSku: string
    componentName: string
    qty: number
    unit: string
    color: string
    category: string
  }[]
}

interface CatalogueStore {
  products: CatalogueProduct[]
  loading: boolean
  error: string | null
  lastRefreshed: string | null
  fetch: () => Promise<void>
}

export const useCatalogue = create<CatalogueStore>((set, get) => ({
  products: [],
  loading: false,
  error: null,
  lastRefreshed: null,
  fetch: async () => {
    if (get().loading) return
    set({ loading: true, error: null })
    try {
      const res = await fetch("/api/catalogue", { cache: "no-store" })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      set({
        products: data.products ?? [],
        loading: false,
        lastRefreshed: new Date().toISOString(),
      })
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : String(e) })
    }
  },
}))
