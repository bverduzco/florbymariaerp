export const dynamic = "force-dynamic"

import { db as prisma } from "@/lib/db"
import { CustomBouquetBuilder } from "./bouquet-builder"

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

export default async function CustomPage() {
  const materials = await getMaterials()
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

      <CustomBouquetBuilder materials={materials} />
    </div>
  )
}
