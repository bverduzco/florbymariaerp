/**
 * End-to-end test for the execution log POST endpoint.
 * Picks the first event with line items, prefills from recipes,
 * adjusts one qty, and POSTs to /api/execution-logs.
 */
import { db } from "../src/lib/db"

async function main() {
  // 1. Find an event with line items. If none, fall back to a manual no-event test.
  const event = await db.event.findFirst({
    where: { lineItems: { some: {} } },
    include: { lineItems: true },
  })

  let lines: Array<{
    materialSku: string
    materialName: string
    qtyUsed: number
    unit: string
    unitCost: number
    lineCost: number
    type: string
  }> = []
  let eventId: string | null = null

  if (event) {
    console.log(`Using event ${event.eventNumber} (${event.name}) — ${event.lineItems.length} line item(s)`)
    eventId = event.id
    for (const li of event.lineItems) {
      const recipe = await db.recipeLine.findMany({ where: { productSku: li.productSku } })
      for (const rl of recipe) {
        const mat = await db.material.findUnique({ where: { sku: rl.componentSku } })
        if (!mat) continue
        const qtyUsed = Number((rl.qty * li.qty).toFixed(2))
        lines.push({
          materialSku: mat.sku,
          materialName: mat.name,
          qtyUsed,
          unit: rl.unit,
          unitCost: rl.unitCost,
          lineCost: Number((qtyUsed * rl.unitCost).toFixed(2)),
          type: "recipe",
        })
      }
    }
  } else {
    console.log("No events with line items — falling back to manual mode (no event link).")
    // Pull a couple of real materials so the test is realistic.
    const mats = await db.material.findMany({
      where: { sku: { not: "" }, unitCost: { not: null } },
      take: 3,
      orderBy: { name: "asc" },
    })
    if (mats.length < 2) {
      console.log("Not enough materials to build a test payload.")
      return null
    }
    lines = [
      {
        materialSku: mats[0].sku,
        materialName: mats[0].name,
        qtyUsed: 10,
        unit: mats[0].unit,
        unitCost: mats[0].unitCost ?? 1,
        lineCost: Number((10 * (mats[0].unitCost ?? 1)).toFixed(2)),
        type: "recipe",
      },
      {
        materialSku: mats[1].sku,
        materialName: mats[1].name,
        qtyUsed: 2,
        unit: mats[1].unit,
        unitCost: mats[1].unitCost ?? 1,
        lineCost: Number((2 * (mats[1].unitCost ?? 1)).toFixed(2)),
        type: "addition",
      },
    ]
  }

  if (lines.length === 0) {
    console.log("No recipe lines for the event's products — can't build a test payload.")
    return null
  }

  // 3. Submit
  const payload = {
    eventId,
    executedAt: new Date().toISOString().slice(0, 10),
    executedBy: "Maria",
    status: "executed",
    quotedPrice: 1500,
    notes: "Smoke test from execution-log-smoke-test.ts",
    lines,
  }
  console.log(`Submitting ${lines.length} line(s), quotedPrice=$1500`)

  const res = await fetch("http://localhost:3000/api/execution-logs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  const data = await res.json()
  if (!res.ok) {
    console.error(`FAIL: ${res.status}`, data)
    process.exit(1)
  }
  console.log(`✓ Created ${data.log.executionNumber}`)
  console.log(`  estimatedCost: $${data.log.estimatedCost}`)
  console.log(`  actualCost:    $${data.log.actualCost}`)
  console.log(`  marginDollars: $${data.log.marginDollars} (${((data.log.marginPct ?? 0) * 100).toFixed(0)}%)`)
  console.log(`  lines: ${data.log.lines.length}`)

  // 4. Verify it shows up on the page (GET /execution should return 200 and the EXE number)
  const pageRes = await fetch("http://localhost:3000/execution")
  const pageText = await pageRes.text()
  if (pageText.includes(data.log.executionNumber)) {
    console.log(`✓ '${data.log.executionNumber}' appears on /execution page`)
  } else {
    console.error(`FAIL: '${data.log.executionNumber}' not visible on /execution`)
    process.exit(1)
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
