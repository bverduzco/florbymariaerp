"use client"

import { useEffect, useState } from "react"
import { useCatalogue } from "@/lib/catalogue-store"
import { usePlanStore } from "@/lib/plan-store"
import { BackupButton } from "@/components/floristry/backup-button"
import { CatalogueGrid } from "@/components/floristry/catalogue-grid"
import { WeeklyPlan } from "@/components/floristry/weekly-plan"
import { ShoppingListPanel } from "@/components/floristry/shopping-list-panel"
import { CustomersTab } from "@/components/floristry/customers-tab"
import { DeliveryView } from "@/components/floristry/delivery-view"
import { OrdersTab } from "@/components/floristry/orders-tab"
import { OrderIntakeForm } from "@/components/floristry/order-intake-form"
import { GenerateDraftButton } from "@/components/floristry/generate-draft-button"
import { LogoutButton } from "@/components/floristry/logout-button"
import { CustomTab } from "@/components/floristry/custom-tab"
import { InventoryTab } from "@/components/floristry/inventory-tab"
import { DashboardTab } from "@/components/floristry/dashboard-tab"
import { EventsTab } from "@/components/floristry/events-tab"
import { useNavStore } from "@/lib/nav-store"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Flower2,
  Sparkles,
  ClipboardList,
  Users,
  CalendarDays,
  PlusCircle,
  FileSpreadsheet,
  Wand2,
  Boxes,
  LayoutDashboard,
  PartyPopper,
} from "lucide-react"

type TabKey = "intake" | "orders" | "custom" | "catalogue" | "inventory" | "plan" | "customers" | "delivery" | "events" | "dashboard"

export default function Home() {
  const fetchCatalogue = useCatalogue((s) => s.fetch)
  const catalogueLoading = useCatalogue((s) => s.loading)
  const lastRefreshed = useCatalogue((s) => s.lastRefreshed)
  const productCount = useCatalogue((s) => s.products.length)

  const planItems = usePlanStore((s) => s.items)
  const setShoppingListOpen = usePlanStore((s) => s.setShoppingListOpen)
  const shoppingListOpen = usePlanStore((s) => s.shoppingListOpen)

  const [initialOrderId, setInitialOrderId] = useState<string | null>(null)
  const [tab, setTab] = useState<TabKey>(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search)
      const tabParam = params.get("tab")
      const validTabs = ["intake", "orders", "custom", "catalogue", "inventory", "plan", "customers", "delivery", "events", "dashboard"]
      if (tabParam && validTabs.includes(tabParam)) {
        return tabParam as TabKey
      }
    }
    return "intake"
  })

  useEffect(() => {
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    const orderIdParam = params.get("orderId")
    const tabParam = params.get("tab")
    const hasParams = Boolean(orderIdParam || tabParam)
    if (orderIdParam) {
      Promise.resolve().then(() => setInitialOrderId(orderIdParam))
    }
    if (hasParams) {
      Promise.resolve().then(() => {
        window.history.replaceState({}, "", window.location.pathname)
      })
    }
  }, [])

  const totalPlanQty = planItems.reduce((s, i) => s + i.qty, 0)
  const planWithDeliveries = planItems.filter((i) => i.deliveryDate).length

  const pendingTab = useNavStore((s) => s.pendingTab)
  const setPendingTab = useNavStore((s) => s.setPendingTab)
  useEffect(() => {
    if (!pendingTab || pendingTab === tab) return
    const targetTab = pendingTab
    requestAnimationFrame(() => {
      setTab(targetTab as TabKey)
      setPendingTab(null)
    })
  }, [pendingTab, tab, setPendingTab])

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
              <span className="hidden sm:inline text-xs text-stone-500">v1.9</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {lastRefreshed && (
              <Badge variant="outline" className="hidden md:inline-flex text-xs text-stone-500">
                {productCount} products · updated {new Date(lastRefreshed).toLocaleTimeString()}
              </Badge>
            )}
            <BackupButton />
            <LogoutButton />
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
                Capture orders, track payments through the sales pipeline, manage customers,
                and generate monthly Excel drafts for backup.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Main — tabbed */}
      <main className="flex-1 mx-auto max-w-7xl w-full px-4 sm:px-6 lg:px-8 py-6">
        <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
          <TabsList className="bg-white border border-rose-100 p-1 h-auto flex-wrap w-full justify-between">
            <TabsTrigger value="intake" className="gap-1.5 flex-1 data-[state=active]:bg-rose-50 data-[state=active]:text-rose-700">
              <PlusCircle className="h-4 w-4" />
              <span className="hidden sm:inline">New Order</span>
              <span className="sm:hidden">Order</span>
            </TabsTrigger>
            <TabsTrigger value="orders" className="gap-1.5 flex-1 data-[state=active]:bg-rose-50 data-[state=active]:text-rose-700">
              <ClipboardList className="h-4 w-4" />
              <span className="hidden sm:inline">Orders</span>
              <span className="sm:hidden">ORD</span>
            </TabsTrigger>
            <TabsTrigger value="custom" className="gap-1.5 flex-1 data-[state=active]:bg-rose-50 data-[state=active]:text-rose-700">
              <Wand2 className="h-4 w-4" />
              <span className="hidden sm:inline">Custom</span>
              <span className="sm:hidden">Cust</span>
            </TabsTrigger>
            <TabsTrigger value="catalogue" className="gap-1.5 flex-1 data-[state=active]:bg-rose-50 data-[state=active]:text-rose-700">
              <Flower2 className="h-4 w-4" />
              <span className="hidden sm:inline">Catalogue</span>
              <span className="sm:hidden">Cat</span>
            </TabsTrigger>
            <TabsTrigger value="plan" className="gap-1.5 flex-1 data-[state=active]:bg-rose-50 data-[state=active]:text-rose-700">
              <ClipboardList className="h-4 w-4" />
              <span className="hidden sm:inline">Plan</span>
              <span className="sm:hidden">Plan</span>
              {totalPlanQty > 0 && (
                <Badge className="ml-1 bg-rose-100 text-rose-700 px-1.5 py-0 text-[10px]">
                  {totalPlanQty}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="delivery" className="gap-1.5 flex-1 data-[state=active]:bg-rose-50 data-[state=active]:text-rose-700">
              <CalendarDays className="h-4 w-4" />
              <span className="hidden sm:inline">Delivery</span>
              <span className="sm:hidden">Del</span>
              {planWithDeliveries > 0 && (
                <Badge className="ml-1 bg-rose-100 text-rose-700 px-1.5 py-0 text-[10px]">
                  {planWithDeliveries}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="customers" className="gap-1.5 flex-1 data-[state=active]:bg-rose-50 data-[state=active]:text-rose-700">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Customers</span>
              <span className="sm:hidden">Cust</span>
            </TabsTrigger>
            <TabsTrigger value="events" className="gap-1.5 flex-1 data-[state=active]:bg-rose-50 data-[state=active]:text-rose-700">
              <PartyPopper className="h-4 w-4" />
              <span className="hidden sm:inline">Events</span>
              <span className="sm:hidden">Evt</span>
            </TabsTrigger>
            <TabsTrigger value="inventory" className="gap-1.5 flex-1 data-[state=active]:bg-rose-50 data-[state=active]:text-rose-700">
              <Boxes className="h-4 w-4" />
              <span className="hidden sm:inline">Inventory</span>
              <span className="sm:hidden">Inv</span>
            </TabsTrigger>
            <TabsTrigger value="dashboard" className="gap-1.5 flex-1 data-[state=active]:bg-rose-50 data-[state=active]:text-rose-700">
              <LayoutDashboard className="h-4 w-4" />
              <span className="hidden sm:inline">Dashboard</span>
              <span className="sm:hidden">Dash</span>
            </TabsTrigger>
          </TabsList>

          {/* Action bar */}
          <div className="mt-4 flex items-center justify-end gap-2">
            <GenerateDraftButton />
          </div>

          <TabsContent value="intake" className="mt-4">
            <OrderIntakeForm />
          </TabsContent>

          <TabsContent value="orders" className="mt-4">
            <OrdersTab initialOrderId={initialOrderId} />
          </TabsContent>

          <TabsContent value="custom" className="mt-4">
            <CustomTab />
          </TabsContent>

          <TabsContent value="catalogue" className="mt-4">
            <Card className="border-rose-200 bg-rose-50/40 p-4 mb-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <Flower2 className="h-5 w-5 text-rose-700" />
                  <h2 className="text-lg font-semibold text-stone-800">Catalogue</h2>
                </div>
                {catalogueLoading && (
                  <span className="text-xs text-stone-500 animate-pulse">Loading…</span>
                )}
              </div>
            </Card>
            <CatalogueGrid />
          </TabsContent>

          <TabsContent value="inventory" className="mt-4">
            <InventoryTab />
          </TabsContent>

          <TabsContent value="plan" className="mt-4">
            <WeeklyPlan />
          </TabsContent>

          <TabsContent value="customers" className="mt-4">
            <CustomersTab />
          </TabsContent>

          <TabsContent value="delivery" className="mt-4">
            <DeliveryView onNavigateToOrder={(orderId) => {
              setInitialOrderId(orderId)
              setTab("orders")
            }} />
          </TabsContent>

          <TabsContent value="events" className="mt-4">
            <EventsTab />
          </TabsContent>

          <TabsContent value="dashboard" className="mt-4">
            <DashboardTab />
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-stone-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-3 text-xs text-stone-500 flex flex-col sm:flex-row justify-between gap-1">
          <span>Flor by Maria · v1.9 · Currency: MXN</span>
          <span>Source: ERP Excel workbook · {productCount} products loaded</span>
        </div>
      </footer>

      <ShoppingListPanel
        open={shoppingListOpen}
        onOpenChange={setShoppingListOpen}
      />
    </div>
  )
}
