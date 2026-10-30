/**
 * One-time backfill: copy Quote.linkedOrderId (loose string = Order.orderNumber)
 * into the new proper FK Quote.orderId (which references Order.id).
 *
 * Run with: npx tsx scripts/backfill-quote-orderid.ts
 *
 * Idempotent: skips Quotes that already have orderId set.
 * Reports:
 *   - quotes total / with linkedOrderId / already migrated / migrated this run / not found
 */
import { db } from "../src/lib/db"

async function main() {
  const allQuotes = await db.quote.findMany({
    select: { id: true, quoteNumber: true, linkedOrderId: true, orderId: true },
  })
  console.log(`Total quotes: ${allQuotes.length}`)

  const withLinked = allQuotes.filter((q) => q.linkedOrderId)
  const alreadyMigrated = withLinked.filter((q) => q.orderId !== null)
  const needsMigration = withLinked.filter((q) => q.orderId === null)
  console.log(`  with linkedOrderId set: ${withLinked.length}`)
  console.log(`  already migrated (orderId already set): ${alreadyMigrated.length}`)
  console.log(`  need migration: ${needsMigration.length}`)

  if (needsMigration.length === 0) {
    console.log("Nothing to do.")
    return
  }

  // Batch-lookup all referenced orders by orderNumber in one query
  const orderNumbers = needsMigration.map((q) => q.linkedOrderId!).filter(Boolean) as string[]
  const orders = await db.order.findMany({
    where: { orderNumber: { in: orderNumbers } },
    select: { id: true, orderNumber: true },
  })
  const orderNumberToId = new Map(orders.map((o) => [o.orderNumber, o.id]))

  let migrated = 0
  let notFound = 0
  const notFoundNumbers: string[] = []

  for (const q of needsMigration) {
    const ordId = orderNumberToId.get(q.linkedOrderId!)
    if (!ordId) {
      notFound++
      notFoundNumbers.push(`${q.quoteNumber} → ${q.linkedOrderId}`)
      continue
    }
    await db.quote.update({
      where: { id: q.id },
      data: { orderId: ordId },
    })
    migrated++
    console.log(`  ✓ ${q.quoteNumber}: linkedOrderId='${q.linkedOrderId}' → orderId='${ordId}'`)
  }

  console.log(`\nMigration complete.`)
  console.log(`  Migrated: ${migrated}`)
  console.log(`  Not found (Order with that orderNumber doesn't exist): ${notFound}`)
  if (notFound > 0) {
    console.log("  Orphaned quotes (linkedOrderId points to a non-existent Order):")
    notFoundNumbers.forEach((n) => console.log(`    - ${n}`))
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
