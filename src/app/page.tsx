"use client"

import { useEffect } from "react"
import { useCatalogue } from "@/lib/catalogue-store"
import { usePlanStore } from "@/lib/plan-store"
import { ErpUploadButton } from "@/components/floristry/erp-upload-button"
import { CatalogueGrid } from "@/components/floristry/catalogue-grid"
import { WeeklyPlan } from "@/components/floristry/weekly-plan"
import { ShoppingListPanel } from "@/components/floristry/shopping-list-panel"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Flower2, ShoppingCart, Sparkles } from "lucide-react"

export default function Home() {
  const fetchCatalogue = useCatalogue((s) => s.fetch)
  const catalogueLoading = useCatalogue((s) => s.loading)
  const lastRefreshed = useCatalogue((s) => s.lastRefreshed)
  const productCount = useCatalogue((s) => s.products.length)

  const planItems = usePlanStore((s) => s.items)
  const setShoppingListOpen = usePlanStore((s) => s.setShoppingListOpen)
  const shoppingListOpen = usePlanStore((s) => s.shoppingListOpen)

  const totalPlanQty = planItems.reduce((s, i) => s + i.qty, 0)

  // Initial load
  useEffect(() => {
    fetchCatalogue()
  }, [fetchCatalogue])

  return (
    <div className="min-h-screen flex flex-col bg-stone-50">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-rose-100 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-600 text-white">
              <Flower2 className="h-5 w-5" />
            </div>
            <div className="flex items-baseline gap-2">
              <h1 className="text-base font-semibold text-stone-800">Flor by Maria</h1>
              <span className="hidden sm:inline text-xs text-stone-500">Weekly Planner</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {lastRefreshed && (
              <Badge variant="outline" className="hidden md:inline-flex text-xs text-stone-500">
                {productCount} products · updated {new Date(lastRefreshed).toLocaleTimeString()}
              </Badge>
            )}
            <ErpUploadButton />
            <Button
              onClick={() => setShoppingListOpen(true)}
              className="bg-rose-600 hover:bg-rose-700 text-white gap-1.5"
              size="sm"
            >
              <ShoppingCart className="h-4 w-4" />
              Shopping List
              {totalPlanQty > 0 && (
                <span className="ml-1 inline-flex items-center justify-center min-w-[20px] h-5 px-1 text-[10px] rounded-full bg-white text-rose-700 font-semibold">
                  {totalPlanQty}
                </span>
              )}
            </Button>
          </div>
        </div>
      </header>

      {/* Hero strip */}
      <section className="bg-gradient-to-r from-rose-50 via-pink-50 to-amber-50 border-b border-rose-100">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex items-start gap-3">
            <Sparkles className="h-5 w-5 text-rose-600 mt-0.5 shrink-0" />
            <div>
              <h2 className="text-base font-semibold text-stone-800">
                Plan your week, buy what you need
              </h2>
              <p className="text-sm text-stone-600 mt-0.5 max-w-2xl">
                Browse the bouquet catalogue, add what you&apos;re selling this week, and we&apos;ll expand
                each recipe from your ERP into a single shopping list grouped by supplier — with pack quantities.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Main */}
      <main className="flex-1 mx-auto max-w-7xl w-full px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
          <section>
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-lg font-semibold text-stone-800">Catalogue</h2>
              {catalogueLoading && (
                <span className="text-xs text-stone-500 animate-pulse">Loading…</span>
              )}
            </div>
            <CatalogueGrid />
          </section>

          <aside>
            <WeeklyPlan />
          </aside>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-stone-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-3 text-xs text-stone-500 flex flex-col sm:flex-row justify-between gap-1">
          <span>Flor by Maria · Weekly Planner prototype · Currency: MXN</span>
          <span>Source: ERP Excel workbook · {productCount} products loaded</span>
        </div>
      </footer>

      {/* Slide-over shopping list */}
      <ShoppingListPanel
        open={shoppingListOpen}
        onOpenChange={setShoppingListOpen}
      />
    </div>
  )
}
