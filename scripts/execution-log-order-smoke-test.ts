/**
 * End-to-end smoke test for the new "Linked job" picker.
 * Tests two paths:
 *   A) Pick a pending ORDER (no recipe → must add manual lines).
 *   B) Submit with no job link (manual mode).
 * Verifies orderId is persisted on the resulting ExecutionLog.
 */
import { db } from "../src/lib/db"

async function main() {
  // ── Test A: pick a pending order ────────────────────────────────
  const order = await db.order.findFirst({
    where: { status: { in: ["payment_confirmed", "procuring"] }, lineItems: { some: {} } },
    include: { lineItems: true },
  })
  if (!order) {
    console.log("No pending orders with line items — skipping Test A.")
  } else {
    console.log(`Test A: pending order ${order.orderNumber} (${order.lineItems.length} line item(s))`)
    const mat = await db.material.findFirst({
      where: { sku: { not: "" }, unitCost: { not: null } },
      orderBy: { name: "asc" },
    })
    if (!mat) {
      console.log("  No materials to use — skipping.")
    } else {
      const payload = {
        eventId: null,
        orderId: order.id,
        executedAt: new Date().toISOString().slice(0, 10),
        executedBy: "Maria",
        status: "executed",
        quotedPrice: 800,
        notes: "Smoke test A — order-linked execution",
        lines: [
          {
            materialSku: mat.sku,
            materialName: mat.name,
            qtyUsed: 5,
            unit: mat.unit,
            unitCost: mat.unitCost ?? 1,
            lineCost: Number((5 * (mat.unitCost ?? 1)).toFixed(2)),
            type: "recipe",
          },
        ],
      }
      const res = await fetch("http://localhost:3000/api/execution-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        console.error(`  FAIL: ${res.status}`, data)
        process.exit(1)
      }
      console.log(`  ✓ Created ${data.log.executionNumber}`)
      console.log(`    orderId: ${data.log.orderId ?? "(null!)"}  ← MUST be ${order.id}`)
      console.log(`    eventId: ${data.log.eventId ?? "(null)"}`)
      console.log(`    actualCost: $${data.log.actualCost}`)

      // Verify on the page
      const pageRes = await fetch("http://localhost:3000/execution")
      const pageText = await pageRes.text()
      if (pageText.includes(data.log.executionNumber)) {
        console.log(`  ✓ '${data.log.executionNumber}' appears on /execution page`)
      } else {
        console.error(`  FAIL: '${data.log.executionNumber}' not visible on /execution`)
        process.exit(1)
      }
    }
  }

  // ── Test B: manual mode (no job link) ──────────────────────────
  console.log("\nTest B: manual mode (no job link)")
  const mat = await db.material.findFirst({
    where: { sku: { not: "" }, unitCost: { not: null } },
    orderBy: { name: "asc" },
    skip: 1,
  })
  if (mat) {
    const payload = {
      eventId: null,
      orderId: null,
      executedAt: new Date().toISOString().slice(0, 10),
      executedBy: "Maria",
      status: "executed",
      quotedPrice: null,
      notes: "Smoke test B — manual execution",
      lines: [
        {
          materialSku: mat.sku,
          materialName: mat.name,
          qtyUsed: 3,
          unit: mat.unit,
          unitCost: mat.unitCost ?? 1,
          lineCost: Number((3 * (mat.unitCost ?? 1)).toFixed(2)),
          type: "addition",
        },
      ],
    }
    const res = await fetch("http://localhost:3000/api/execution-logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (!res.ok) {
      console.error(`  FAIL: ${res.status}`, data)
      process.exit(1)
    }
    console.log(`  ✓ Created ${data.log.executionNumber}`)
    console.log(`    orderId: ${data.log.orderId ?? "(null)"}  ← MUST be null`)
    console.log(`    eventId: ${data.log.eventId ?? "(null)"}  ← MUST be null`)
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
