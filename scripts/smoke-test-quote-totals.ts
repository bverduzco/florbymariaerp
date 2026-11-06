// scripts/smoke-test-quote-totals.ts
//
// Verifies the Class 3+4+5 fixes: quote total math, lineNumber via MAX+1,
// and recompute-after-discount-change.
//
// Runs against the local SQLite database (DATABASE_URL=file:./db/custom.db)
// via direct API calls to the dev server.
//
// Prerequisites:
//   1. Start the dev server: npm run dev
//   2. Run this script: npx tsx scripts/smoke-test-quote-totals.ts
//
// What it tests:
//   - Creates a quote with 2 line items + flat $200 discount + $100 delivery
//     Expected math:
//       Line 1: 5 × $200 = $1000
//       Line 2: 2 × $50  = $100
//       Subtotal = $1100
//       Discount = $200 (flat)
//       Discounted subtotal = $900
//       IVA (16% of $900) = $144
//       Delivery = $100
//       Total = $900 + $144 + $100 = $1144
//       Deposit (50% default, no eventDate) = $572
//   - Adds a 3rd line via POST /api/quote-lines, verifies totals recompute
//   - Edits the discount via PATCH /api/quotes/[id], verifies totals recompute
//   - Deletes a line via DELETE /api/quote-lines/[id], verifies totals recompute
//   - Cleans up the test quote afterward

const API_BASE = "http://127.0.0.1:3000"
const TEST_CUSTOMER_NAME = `SMOKE TEST ${new Date().toISOString().slice(0, 16)}`

async function main() {
  console.log("=== Smoke test: Quote totals (Class 3+4+5 fixes) ===")
  console.log(`API base: ${API_BASE}`)
  console.log("")

  // 1. Create the quote with 2 lines + discount + delivery
  console.log("Step 1: Create quote with 2 lines, $200 flat discount, $100 delivery")
  const createRes = await fetch(`${API_BASE}/api/quotes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      customerName: TEST_CUSTOMER_NAME,
      quoteMode: "no_event",  // 100% deposit (no event date)
      discount: 200,
      discountType: "flat",
      deliveryFee: 100,
      lineItems: [
        { description: "Bouquet A", qty: 5, unitPrice: 200 },
        { description: "Bouquet B", qty: 2, unitPrice: 50 },
      ],
    }),
  })
  if (!createRes.ok) {
    const err = await createRes.json().catch(() => ({}))
    throw new Error(`Create failed: ${createRes.status} ${JSON.stringify(err)}`)
  }
  const created = await createRes.json()
  const quoteId = created.quote.id
  console.log(`  ✓ Created ${created.quote.quoteNumber} (id: ${quoteId})`)
  console.log(`    subtotal:        $${created.quote.subtotal} (expected $1100)`)
  console.log(`    iva:             $${created.quote.iva} (expected $144)`)
  console.log(`    total:           $${created.quote.total} (expected $1144)`)
  console.log(`    depositRequired: $${created.quote.depositRequired} (expected $1144 — no_event = 100%)`)
  console.log(`    deliveryFee:     $${created.quote.deliveryFee}`)
  console.log(`    discount:        $${created.quote.discount}`)
  console.log("")

  assert("subtotal", created.quote.subtotal, 1100)
  assert("iva", created.quote.iva, 144)
  assert("total", created.quote.total, 1144)
  assert("depositRequired", created.quote.depositRequired, 1144)  // 100% COD for no_event
  console.log("✓ All initial totals correct\n")

  // 2. Add a 3rd line via POST /api/quote-lines
  console.log("Step 2: Add 3rd line ($300 = 1 × $300)")
  const addLineRes = await fetch(`${API_BASE}/api/quote-lines`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      quoteId,
      description: "Bouquet C",
      qty: 1,
      unitPrice: 300,
    }),
  })
  if (!addLineRes.ok) throw new Error(`Add line failed: ${addLineRes.status}`)
  const added = await addLineRes.json()
  console.log(`  ✓ Added line (lineNumber: ${added.quoteLine.lineNumber})`)
  console.log(`    New subtotal:        $${added.quoteTotals.subtotal} (expected $1400)`)
  console.log(`    New iva:             $${added.quoteTotals.iva} (expected $192)`)
  console.log(`    New total:           $${added.quoteTotals.total} (expected $1492)`)
  console.log(`    New depositRequired: $${added.quoteTotals.depositRequired} (expected $1492)`)
  console.log("")
  assert("after-add lineNumber (should be 3, not 2)", added.quoteLine.lineNumber, 3)
  assert("after-add subtotal", added.quoteTotals.subtotal, 1400)
  assert("after-add iva", added.quoteTotals.iva, 192)
  assert("after-add total", added.quoteTotals.total, 1492)
  console.log("✓ Totals recomputed correctly after line addition\n")

  // 3. Change discount via PATCH /api/quotes/[id]
  console.log("Step 3: Change discount to 10% (percentage)")
  const patchRes = await fetch(`${API_BASE}/api/quotes/${quoteId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      discount: 10,
      discountType: "percentage",
    }),
  })
  if (!patchRes.ok) throw new Error(`PATCH failed: ${patchRes.status}`)
  const patched = await patchRes.json()
  // With $1400 subtotal, 10% off = $140 discount
  // Discounted subtotal = $1260
  // IVA = $1260 × 0.16 = $201.60
  // Total = $1260 + $201.60 + $100 = $1561.60
  console.log(`  ✓ Patched discount to 10%`)
  console.log(`    New subtotal:        $${patched.quoteTotals.subtotal} (expected $1400)`)
  console.log(`    New iva:             $${patched.quoteTotals.iva} (expected $201.60)`)
  console.log(`    New total:           $${patched.quoteTotals.total} (expected $1561.60)`)
  console.log(`    New depositRequired: $${patched.quoteTotals.depositRequired} (expected $1561.60)`)
  console.log("")
  assert("after-patch subtotal", patched.quoteTotals.subtotal, 1400)
  assert("after-patch iva", Math.round(patched.quoteTotals.iva * 100) / 100, 201.6)
  assert("after-patch total", Math.round(patched.quoteTotals.total * 100) / 100, 1561.6)
  console.log("✓ Totals recomputed correctly after discount change\n")

  // 4. Delete the 3rd line, verify totals recompute
  console.log("Step 4: Delete the 3rd line")
  const lineIdToDelete = added.quoteLine.id
  const delRes = await fetch(`${API_BASE}/api/quote-lines/${lineIdToDelete}`, {
    method: "DELETE",
  })
  if (!delRes.ok) throw new Error(`DELETE failed: ${delRes.status}`)
  const deleted = await delRes.json()
  // Back to 2 lines = $1100 subtotal
  // 10% off = $110 discount
  // Discounted subtotal = $990
  // IVA = $990 × 0.16 = $158.40
  // Total = $990 + $158.40 + $100 = $1248.40
  console.log(`  ✓ Deleted line`)
  console.log(`    New subtotal:        $${deleted.quoteTotals.subtotal} (expected $1100)`)
  console.log(`    New iva:             $${deleted.quoteTotals.iva} (expected $158.40)`)
  console.log(`    New total:           $${deleted.quoteTotals.total} (expected $1248.40)`)
  console.log("")
  assert("after-delete subtotal", deleted.quoteTotals.subtotal, 1100)
  assert("after-delete iva", Math.round(deleted.quoteTotals.iva * 100) / 100, 158.4)
  assert("after-delete total", Math.round(deleted.quoteTotals.total * 100) / 100, 1248.4)
  console.log("✓ Totals recomputed correctly after line deletion\n")

  // 5. Cleanup — delete the test quote
  console.log("Step 5: Cleanup — delete the test quote")
  const cleanupRes = await fetch(`${API_BASE}/api/quotes/${quoteId}`, {
    method: "DELETE",
  })
  if (!cleanupRes.ok) console.log(`  (cleanup warning: ${cleanupRes.status})`)
  else console.log(`  ✓ Deleted test quote ${quoteId}`)

  console.log("\n=== ALL TESTS PASSED ===")
  console.log("Class 3 (totals math):            ✓")
  console.log("Class 4 (lineNumber via MAX+1):   ✓ (line 3 was lineNumber=3, not duplicate)")
  console.log("Class 5 (recompute on discount):  ✓")
}

function assert(label: string, actual: number, expected: number) {
  const actualRounded = Math.round(actual * 100) / 100
  const expectedRounded = Math.round(expected * 100) / 100
  if (actualRounded !== expectedRounded) {
    console.error(`\n✗ FAIL: ${label}`)
    console.error(`    actual:   ${actualRounded}`)
    console.error(`    expected: ${expectedRounded}`)
    process.exit(1)
  }
}

main().catch((e) => {
  console.error("Fatal:", e instanceof Error ? e.message : e)
  process.exit(1)
})
