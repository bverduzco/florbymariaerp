"use client"

import { create } from "zustand"

interface NavStore {
  pendingOrderId: string | null
  setPendingOrderId: (id: string | null) => void
  pendingTab: string | null
  setPendingTab: (tab: string | null) => void
}

export const useNavStore = create<NavStore>((set) => ({
  pendingOrderId: null,
  setPendingOrderId: (id) => set({ pendingOrderId: id }),
  pendingTab: null,
  setPendingTab: (tab) => set({ pendingTab: tab }),
}))
