export const dynamic = "force-dynamic"

import { db as prisma } from "@/lib/db"
import { CustomBouquetBuilder } from "./bouquet-builder"
import { CustomBouquetHistory } from "./custom-bouquet-history"

async function getMaterials() {
  return prisma.customMaterial.findMany({
    orderBy: [{ type: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      pricePerStem: true,
      type: true,
      class: true,
      source: true,
      erpSku: true,
      erpName: true,
      matchConfidence: true,
    },
  })
}

async function getCustomers() {
  return prisma.customer.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, phone: true },
  })
}

/**
 * Fetch the most recent HIDDEN custom recipes (the audit trail of every
 * custom bouquet that became an order). For each one, also pull the linked
 * Order's customer info via the SKU on the order's first line item.
 *
 * The link is implicit — there's no FK from CustomRecipe to Order. We match
 * Order.lineItems.productSku = CustomRecipe.erpProductSku. If multiple orders
 * share the same SKU (rare — would mean Maria re-used a recipe), we take the
 * most recent one.
 */
async function getRecentHiddenRecipes(limit = 20) {
  const recipes = await prisma.customRecipe.findMany({
    where: { hidden: true },
    include: { lines: true },
    orderBy: { createdAt: "desc" },
    take: limit,
  })

  if (recipes.length === 0) return []

  // Look up the linked order + customer for each recipe via the SKU.
  // One query with `some` filter per recipe is N+1 but N is small (≤20).
  const enriched = await Promise.all(
    recipes.map(async (r) => {
      if (!r.erpProductSku) {
        return { recipe: r, order: null as null | { orderNumber: string; customerName: string; deliveryDate: Date | null } }
      }
      const order = await prisma.order.findFirst({
        where: { lineItems: { some: { productSku: r.erpProductSku } } },
        select: {
          orderNumber: true,
          deliveryDate: true,
          customer: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
      })
      return {
        recipe: r,
        order: order
          ? {
              orderNumber: order.orderNumber,
              customerName: order.customer.name,
              deliveryDate: order.deliveryDate,
            }
          : null,
      }
    }),
  )

  return enriched
}

export default async function CustomPage() {
  const [materials, customers, recentRecipes] = await Promise.all([
    getMaterials(),
    getCustomers(),
    getRecentHiddenRecipes(20),
  ])
  const flowers = materials.filter((m) => m.type === "flower").length
  const foliage = materials.filter((m) => m.type === "foliage").length

  return (
    <div>
      <div className="fmd-screen-header">
        <div>
          <h1>Custom Bouquet Builder</h1>
          <div className="fmd-subtitle">Pick materials and quantities to design a custom bouquet · {flowers} flowers + {foliage} foliage to choose from!</div>
        </div>
      </div>

      <CustomBouquetBuilder materials={materials} customers={customers} />

      {recentRecipes.length > 0 && (
        <div style={{ marginTop: "16px" }}>
          <CustomBouquetHistory recipes={recentRecipes} />
        </div>
      )}
    </div>
  )
}
