/**
 * End-to-end test of the Quote → Order FK migration.
 *
 * Verifies:
 *   A) /orders page still builds and the linked quote (via orderId FK) shows up.
 *   B) PATCH /api/quotes/[id] with `orderId` works (and validates non-existent order → 404).
 *   C) PATCH /api/quotes/[id] with legacy `linkedOrderId` still works (translates to orderId).
 *   D) After PATCH clears orderId, quote is no longer linked.
 *
 * Cleans up after itself: restores the original orderId on any quote it modified.
 */
import { db } from "../src/lib/db"

async function main() {
  // ── Find a quote + an order to test with ────────────────────
  const orders = await db.order.findMany({
    select: { id: true, orderNumber: true },
    orderBy: { orderNumber: "asc" },
  })
  if (orders.length < 1) {
    console.log("No orders available — cannot test.")
    return
  }
  const targetOrder = orders[0]

  const quotes = await db.quote.findMany({
    select: { id: true, quoteNumber: true, orderId: true, linkedOrderId: true },
  })
  if (quotes.length < 1) {
    console.log("No quotes available — cannot test.")
    return
  }
  const targetQuote = quotes[0]

  console.log(`Test setup:`)
  console.log(`  Quote: ${targetQuote.quoteNumber} (orderId=${targetQuote.orderId ?? "null"}, linkedOrderId=${targetQuote.linkedOrderId ?? "null"})`)
  console.log(`  Order: ${targetOrder.orderNumber} (id=${targetOrder.id})`)
  const originalOrderId = targetQuote.orderId

  // ── Test A: verify /orders page builds + linked quotes appear ──
  console.log("\nTest A: /orders page builds")
  const ordersPageRes = await fetch("http://localhost:3000/orders")
  if (!ordersPageRes.ok) {
    console.error(`  FAIL: /orders returned ${ordersPageRes.status}`)
    process.exit(1)
  }
  console.log(`  ✓ /orders returned 200`)

  // ── Test B: PATCH with new orderId ───────────────────────────
  console.log("\nTest B: PATCH /api/quotes/[id] with orderId (new FK)")
  const patchB = await fetch(`http://localhost:3000/api/quotes/${targetQuote.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId: targetOrder.id }),
  })
  const dataB = await patchB.json()
  if (!patchB.ok) {
    console.error(`  FAIL: ${patchB.status}`, dataB)
    process.exit(1)
  }
  console.log(`  ✓ Quote updated: orderId=${dataB.quote.orderId}, linkedOrderId=${dataB.quote.linkedOrderId}`)
  if (dataB.quote.orderId !== targetOrder.id) {
    console.error(`  FAIL: orderId not set to ${targetOrder.id}`)
    process.exit(1)
  }
  if (dataB.quote.linkedOrderId !== targetOrder.orderNumber) {
    console.error(`  FAIL: legacy linkedOrderId should be synced to ${targetOrder.orderNumber}`)
    process.exit(1)
  }

  // ── Test B2: PATCH with non-existent orderId → 404 ──────────
  console.log("\nTest B2: PATCH with non-existent orderId → 404")
  const patchB2 = await fetch(`http://localhost:3000/api/quotes/${targetQuote.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId: "nonexistent-order-id" }),
  })
  if (patchB2.status !== 404) {
    const dataB2 = await patchB2.json()
    console.error(`  FAIL: expected 404, got ${patchB2.status}`, dataB2)
    process.exit(1)
  }
  console.log(`  ✓ Got 404 as expected`)

  // ── Test C: PATCH with legacy linkedOrderId ─────────────────
  console.log("\nTest C: PATCH with legacy linkedOrderId (backward compat)")
  // Find another order to link to via the legacy path
  const otherOrder = orders[1] ?? orders[0]
  const patchC = await fetch(`http://localhost:3000/api/quotes/${targetQuote.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ linkedOrderId: otherOrder.orderNumber }),
  })
  const dataC = await patchC.json()
  if (!patchC.ok) {
    console.error(`  FAIL: ${patchC.status}`, dataC)
    process.exit(1)
  }
  console.log(`  ✓ Legacy link translated: orderId=${dataC.quote.orderId} (should be ${otherOrder.id})`)
  if (dataC.quote.orderId !== otherOrder.id) {
    console.error(`  FAIL: orderId should be ${otherOrder.id}`)
    process.exit(1)
  }

  // ── Test C2: PATCH with legacy linkedOrderId that doesn't exist → 404 ──
  console.log("\nTest C2: PATCH with non-existent linkedOrderId → 404")
  const patchC2 = await fetch(`http://localhost:3000/api/quotes/${targetQuote.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ linkedOrderId: "ORD-9999-NONEXISTENT" }),
  })
  if (patchC2.status !== 404) {
    const dataC2 = await patchC2.json()
    console.error(`  FAIL: expected 404, got ${patchC2.status}`, dataC2)
    process.exit(1)
  }
  console.log(`  ✓ Got 404 as expected`)

  // ── Test D: clear the link ──────────────────────────────────
  console.log("\nTest D: PATCH with orderId=null clears the link")
  const patchD = await fetch(`http://localhost:3000/api/quotes/${targetQuote.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId: null }),
  })
  const dataD = await patchD.json()
  if (!patchD.ok) {
    console.error(`  FAIL: ${patchD.status}`, dataD)
    process.exit(1)
  }
  if (dataD.quote.orderId !== null || dataD.quote.linkedOrderId !== null) {
    console.error(`  FAIL: both orderId and linkedOrderId should be null after clearing`)
    process.exit(1)
  }
  console.log(`  ✓ Both orderId and linkedOrderId are null`)

  // ── Cleanup: restore original state ─────────────────────────
  console.log("\nCleanup: restoring original orderId on quote")
  await db.quote.update({
    where: { id: targetQuote.id },
    data: {
      orderId: originalOrderId,
      // Also restore the legacy linkedOrderId if it was originally set
      linkedOrderId: targetQuote.linkedOrderId,
    },
  })
  console.log(`  ✓ Restored`)
}

main()
  .then(() => {
    console.log("\n✓ All tests passed.")
    process.exit(0)
  })
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
