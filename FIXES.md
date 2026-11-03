# Fixes — Codebase Audit of Bugs & Broken Logic

This document catalogs bugs identified during a codebase audit performed
on 2026-11-03. It's a companion to the Wishlist in Settings → System
Information; the Wishlist tracks *features* under consideration, while
this file tracks *bugs to fix* (broken logic, data-integrity risks,
billing-correctness issues).

Each class is independent and can be fixed in isolation, but the
priority order at the bottom reflects what to fix first based on
severity (billing correctness > data loss > silent drift > UX nits).

---

## Class 1 — Missing `$transaction` on multi-write operations

Every "do multiple DB writes as one logical operation" route has this
bug. Prisma's `db.x.create()` / `db.x.update()` are committed
immediately. If any step fails mid-way (network blip, validation error,
constraint violation, OOM), the database is left in a half-updated
state with no rollback.

### Affected routes

| Route | File | What's half-committed on failure |
|---|---|---|
| `POST /api/quotes/[id]/convert-to-order` | `src/app/api/quotes/[id]/convert-to-order/route.ts` | Order created but Quote not linked, Customer not promoted, AuditLog incomplete |
| `POST /api/execution-logs` | `src/app/api/execution-logs/route.ts` | ExecutionLog created but only some lines have stock deductions applied |
| `POST /api/losses` | `src/app/api/losses/route.ts` | Loss created but stock not deducted, StockMovement missing |
| `POST /api/payments` (when linked to Order) | `src/app/api/payments/route.ts` | Payment created but Order status/payment fields not updated, AuditLog missing |
| `PATCH /api/purchase-orders/[id]` (mark received) | `src/app/api/purchase-orders/[id]/route.ts` | Some materials got stock bumped, others didn't, PO status not yet updated → next "receive" attempt double-increments |
| `PATCH /api/orders/[id]/line-items` | `src/app/api/orders/[id]/line-items/route.ts` | **Critical:** deletes ALL existing line items, then creates new ones. If createMany fails, the order has ZERO line items — pure data loss |
| `PATCH /api/events/[id]` (link/unlink order) | `src/app/api/events/[id]/route.ts` | Order's eventId changed but Event not updated, or vice versa |
| `DELETE /api/events/[id]` | `src/app/api/events/[id]/route.ts` | Orders unlinked from event, but if delete fails, orders are orphaned with no way to reattach |
| `POST /api/quote-lines` | `src/app/api/quote-lines/route.ts` | QuoteLine created, but if the recompute-totals step fails, the quote's totals are stale |
| `PATCH /api/quote-lines/[id]` | `src/app/api/quote-lines/[id]/route.ts` | Line updated but recompute-totals step may fail silently |
| `DELETE /api/quote-lines/[id]` | `src/app/api/quote-lines/[id]/route.ts` | Line deleted but recompute-totals step may fail silently |
| `POST /api/materials/reset-perishable` | `src/app/api/materials/reset-perishable/route.ts` | Loop creates Losses + StockMovements + Material updates one at a time — any failure mid-loop leaves partial state |

The `PATCH /api/orders/[id]/line-items` one is the worst — it's a
literal delete-then-recreate that loses data on failure.

### Fix pattern

Wrap each multi-write block in `await db.$transaction(async (tx) => { ... })`
and use `tx.x.create()` instead of `db.x.create()` inside. Prisma
will roll back all writes if any throws.

For SQLite (local dev) and Turso (prod), the underlying adapter
supports transactions natively, so this is safe.

---

## Class 2 — Stale-read race conditions on stock updates

This is the same anti-pattern as the original `count + 1` bug we fixed
in commit `324f836`, just for stock quantities:

```ts
// BROKEN — every stock-mutating route does this
const material = await db.material.findUnique({
  where: { sku },
  select: { currentStockPacks: true },
})
const newStock = (material.currentStockPacks ?? 0) - qtyLost  // ← stale read
await db.material.update({
  where: { sku },
  data: { currentStockPacks: newStock },
})
```

If two concurrent operations touch the same material, the second write
overwrites the first. SQLite/Turso is serializable at the row level
during a transaction, but only if you actually wrap the read+write in
a transaction — the current code doesn't.

### Affected routes

- `POST /api/losses` (lines 53-58)
- `POST /api/execution-logs` (lines 153-159, in a loop — each line)
- `PATCH /api/purchase-orders/[id]` mark-as-received (lines 56-65, in a loop)
- `POST /api/materials/reset-perishable` (lines 50-58, in a loop)

### Fix pattern

Replace the read-then-write with Prisma's atomic increment/decrement:

```ts
// GOOD — atomic at the SQL level
await db.material.update({
  where: { sku },
  data: { currentStockPacks: { decrement: qtyLost } },
})
```

This translates to `UPDATE ... SET currentStockPacks = currentStockPacks - N`
which is atomic. Combined with Class 1's `$transaction`, fully safe.

### Lower-bound floor

`{ decrement: qtyLost }` can produce negative stock. Two options:
1. Inside a transaction, check `currentStockPacks >= qtyLost` before decrement, abort otherwise
2. Use raw SQL: `UPDATE Material SET currentStockPacks = MAX(0, currentStockPacks - ?) WHERE sku = ?`

---

## Class 3 — Quote total calculation ignores discount + delivery fee

**This is a billing-correctness bug.** Customers see wrong numbers on
their quotes (PDF + WhatsApp message).

### The bug

Across the entire codebase, "total" is computed as
`subtotal + iva`, ignoring both discount and delivery fee. But the
PDF and WhatsApp message *display* discount and delivery as separate
line items, then show the wrong total below them.

### Where the wrong total gets stored/used

| Location | Code | Notes |
|---|---|---|
| `POST /api/quotes` line 107-108 | `const iva = subtotal * 0.16; const total = subtotal + iva` | No discount, no delivery |
| `POST /api/quote-lines` line 65 | `const newTotal = newSubtotal + newIva` | Same — recomputes totals after adding a line, ignores discount + delivery |
| `PATCH /api/quote-lines/[id]` line 56 | `const newTotal = newSubtotal + newIva` | Same |
| `DELETE /api/quote-lines/[id]` line 112 | `const newTotal = newSubtotal + newIva` | Same |
| `PATCH /api/quotes/[id]` line 55-56 | Stores `discount` field but does NOT recompute subtotal/iva/total/deposit | Comment in `discount-section.tsx` claiming "IVA + total + deposit recompute automatically on the server" is wrong |

### Downstream effect on billing (customer-facing)

`src/lib/pdf/quote.ts` line 78: `balanceDue = payload.total - payload.depositRequired` — both wrong.
`src/lib/quote-message.ts` line 88: same formula, same bug.

### Concrete example

Quote for $1000 with $200 discount, $100 delivery:

| Field | Current (buggy) | Should be |
|---|---|---|
| Subtotal | $1000 | $1000 |
| Discount | −$200 | −$200 |
| **Discounted subtotal** | (not stored) | $800 |
| IVA (16%) | $160 (on $1000) | $128 (on $800) |
| Delivery | $100 | $100 |
| **TOTAL** | **$1160** (1000 + 160) | **$1028** (800 + 128 + 100) |
| Deposit (50%) | $580 | $514 |
| Balance due | $580 | $514 |

Customer is being told they owe $580 deposit when they actually owe $514. The error is the discount amount — Maria could be overcharging customers by the discount amount.

### Fix pattern

Create a single helper `recomputeQuoteTotals(quoteId)` in
`src/lib/quote-totals.ts` that:
1. Fetches the quote + all its lines
2. Computes `subtotal = Σ(lineTotal)`
3. Computes `discountAmount = discountType === "percentage" ? subtotal * discount/100 : discount`
4. Computes `discountedSubtotal = max(0, subtotal - discountAmount)`
5. Computes `iva = discountedSubtotal * 0.16`
6. Computes `total = discountedSubtotal + iva + (deliveryFee ?? 100)`
7. Looks up stored `paymentRule` via `lookupPaymentRule`, computes `depositRequired = total * rule.depositPct`
8. Writes all of those back to the Quote in one update

Call this from every site that mutates quote lines or discount:
`POST /api/quotes`, `POST /api/quote-lines`, `PATCH /api/quote-lines/[id]`, `DELETE /api/quote-lines/[id]`, `PATCH /api/quotes/[id]`.

---

## Class 4 — QuoteLine lineNumber uses the same broken `count + 1` pattern

In `POST /api/quote-lines` (lines 37-38):

```ts
const existingLines = await db.quoteLine.count({ where: { quoteId } })
const lineNumber = existingLines + 1
```

### Severity

Doesn't crash (no unique constraint on `(quoteId, lineNumber)`), but produces duplicate line numbers within the same quote whenever a line is deleted. Cosmetic but indicates the same broken mental model that caused the QTE-0007 collision.

### Fix pattern

Reuse `generateSequentialNumber()` from `src/lib/sequential-number.ts`,
or just compute `MAX(lineNumber) + 1` inline:

```ts
const lastLine = await db.quoteLine.findFirst({
  where: { quoteId },
  orderBy: { lineNumber: "desc" },
  select: { lineNumber: true },
})
const lineNumber = (lastLine?.lineNumber ?? 0) + 1
```

---

## Class 5 — PATCH /api/quotes/[id] doesn't recompute totals after discount change

Already mentioned in Class 3 but worth isolating because the user-visible
symptom is confusing.

### The bug

The `DiscountSection` client component calls:
```ts
fetch(`/api/quotes/${quoteId}`, {
  method: "PATCH",
  body: JSON.stringify({ discount: numericValue, discountType: type }),
})
```

The server stores `discount` and `discountType` on the Quote row but
**does not recompute** `subtotal` / `iva` / `total` / `depositRequired`.
After Maria applies a discount, the quote detail page reloads and
shows the OLD total. The displayed discount line says "−$200" but
the total below it hasn't moved.

### Fix pattern

Same as Class 3: call `recomputeQuoteTotals(quoteId)` from the
`PATCH /api/quotes/[id]` handler when `body.discount` or
`body.discountType` is present.

---

## Class 6 — No status-transition validation

Both `PATCH /api/orders/[id]/status` and `PATCH /api/orders/[id]`
(which also accepts `status` in body) allow any-to-any status
transitions. An order can go from `fulfilled` back to `draft`, or
from `cancelled` to `delivered`. No business-rule enforcement.

The `advancePipeline` convenience in `PATCH /api/orders/[id]` is
correct (one step at a time, terminal states rejected), but raw
`status: "X"` in the body bypasses it.

### Same issue with events

`PATCH /api/events/[id]` (line 65: no validation of valid status
values), while the dedicated `/api/events/[id]/status` route DOES
validate. Inconsistent.

### Fix pattern

Define a canonical pipeline + transition map:

```ts
// src/lib/order-status.ts
const PIPELINE = ["draft","quote_sent","awaiting_payment",
  "payment_confirmed","procuring","producing","delivered","fulfilled"]
const TERMINAL = ["fulfilled","cancelled"]
function isValidTransition(from: string, to: string): boolean {
  if (to === "cancelled") return !TERMINAL.includes(from)
  const i = PIPELINE.indexOf(from), j = PIPELINE.indexOf(to)
  return j === i + 1
}
```

Call from both status endpoints.

---

## Class 7 — Date timezone bugs

Several routes do `new Date(body.eventDate + "T00:00:00")`. On Vercel
(UTC), this creates a Date at local-midnight-of-the-server, which is
**UTC midnight**, not Mexico City midnight. A date picked as "Nov 26"
in Mexico City becomes `2026-11-26T00:00:00Z` → displayed as
`2026-11-25T18:00:00` in CDT. Events can appear on the wrong day in
the calendar.

The calendar grid uses `toISOString().slice(0, 10)` which gives UTC
date — so if a date was stored as UTC midnight Nov 26, it shows as
Nov 26 in the calendar (correct). But comparisons against `new Date()`
(which is "now" in UTC) can still be off by up to 6 hours near day
boundaries.

### Affected routes

- `POST /api/quotes` (line 202): `new Date(body.eventDate)`
- `POST /api/orders` (line 133): `new Date(body.deliveryDate + "T00:00:00")`
- `POST /api/events` (line 94): `new Date(body.eventDate + "T00:00:00")`
- `PATCH /api/events/[id]` (line 70): same
- Calendar pages compare against `new Date()` (line 67 of calendar/page.tsx): no timezone conversion

### Fix pattern

Either:
1. **Always store dates as `YYYY-MM-DD` strings**, not `Date` objects — avoids the timezone ambiguity entirely. Calendar grid already uses `toISOString().slice(0, 10)` so this matches existing convention.
2. Or use a `parseMexicoCityDate(iso: string)` helper that interprets the string in CST/CDT and returns the correct UTC instant.

Option 1 is simpler and matches what calendar-grid.ts already does.

---

## Class 8 — DELETE endpoints don't protect downstream references

| Endpoint | Issue |
|---|---|
| `DELETE /api/orders/[id]` | Doesn't check if the order has Payments, ExecutionLogs, or linked Quotes. Deletion orphans those records (their `linkedId` / `orderId` fields still reference the deleted order). |
| `DELETE /api/materials/[id]` | Doesn't check if the material has RecipeLines, StockMovements, SupplierPrices, Losses, ExecutionLogLines. Schema uses `onDelete: Cascade` (silent nuke of recipe lines) on some, `SetNull` on others, but the API gives no warning before triggering cascades. |
| `DELETE /api/customers/[id]` | Schema uses `onDelete: Restrict` (good — can't delete a Customer with Orders), but the API doesn't return a friendly error explaining why the delete failed. |
| `DELETE /api/quotes/[id]` | Manually clears `quote.orderId` first to avoid FK issues, but doesn't check if the quote has Payments, AuditLog entries, QuoteReminders. |
| `DELETE /api/events/[id]` | Unlinks orders first (`updateMany({ eventId: null })`), then deletes event. If delete fails, orders are orphaned. |

### Fix pattern

For each DELETE endpoint, before actually deleting:
1. Run a `_count` query on every related model
2. If any count > 0, return 422 with the list of dependent records ("Cannot delete: 3 Payments, 2 ExecutionLogs reference this Order")
3. Optionally: support `?force=true` to proceed with the delete anyway (with cascades documented)

Also: implement the **soft-delete pattern** from the Wishlist — once that's done, "delete" becomes "set deletedAt = now()" and downstream references remain intact.

---

## Recommended priority for fixing

In order of severity:

1. **Class 3** — quote total wrong. Billing correctness bug, customers see wrong numbers. **Fix first.**
2. **Class 1 (`PATCH /api/orders/[id]/line-items` deletes-then-recreates without transaction)** — direct data loss risk. Fix immediately.
3. **Class 1 (`POST /api/quotes/[id]/convert-to-order`)** — quote→order conversion is half-atomic; can leave quotes unlinked to orders that exist.
4. **Class 2 (stale-read stock deductions)** — silent inventory drift, especially bad during concurrent PO receipts.
5. **Class 5 (discount PATCH doesn't recompute)** — visible UX bug + billing bug.
6. **Class 1 (other multi-write routes)** — lower frequency but same class.
7. **Class 8 (delete endpoints orphan references)** — usually silent, only matters when someone deletes the wrong thing.
8. **Class 6 (status transitions)** — annoyance, not data loss.
9. **Class 7 (timezone)** — edge case, only matters near midnight.
10. **Class 4 (lineNumber collision)** — cosmetic.

### Suggested bundled fix

Classes 1, 2, 3, 5 are all in the same files (the API routes), they're
related (data integrity + billing correctness), and fixing them
together means we can write a single regression test that covers all
of them rather than re-touching the same routes 4 times. ~3-4 hours
estimated for the bundle.

Class 3 alone (just the billing-correctness fix) is ~1 hour if you
want to ship that first as a hotfix.

---

## History

- 2026-11-03: Created from the audit done after the `count + 1`
  collision fix (commit `324f836`). The collision fix uncovered
  related patterns of broken logic across the rest of the API surface.
