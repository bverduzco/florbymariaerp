# Bot Assistant — Vision for Receipt / Price List Scanning

> **Status:** Concept only. Not being built yet.
>
> **Created:** 2026-11-09
>
> **Owner:** Maria (with assistant design partner)
>
> **Dependencies:** Must finish the execution-workflow fixes (Gap 1–4 from
> the 2026-11-09 design session) before this is tackled. The schema changes
> for no-SKU ad-hoc purchases are a prerequisite — without them, half the
> real-world receipts can't be logged.

---

## The scenario Maria described

> "Say I go shopping for items, but the pricelist hasn't been updated in a
> while. I either take a picture of the pricelist at the warehouse or I take
> a picture of the receipt. I ask you to scan it and make it into a table,
> then match it to SKUs. From the picture we can learn the vendor, the date,
> the items, amounts, price per item, total cost. A picture like that could
> be linked to a PO or be logged as ad-hoc. It would save me the trouble of
> marking every item I purchased manually, especially if it doesn't match
> the PO exactly. It is likely that when I visit a vendor I buy things
> unrelated to a specific quote/order, but the expense still needs to be
> logged if it pertains to my work. You can then tell me what picture records
> need to be applied to inventory."

---

## Why this beats the narration bot

An earlier brainstorm explored a "narrate your day" bot — Maria would
describe her work verbally and the bot would log execution entries, ad-hoc
purchases, etc. That idea struggled with two problems: **ambiguous input**
("roses" — which one?) and **disambiguation friction** (the bot asking
clarifying questions constantly).

A receipt photo eliminates both:

- **The receipt has structured data already.** Vendor name at the top,
  date in a predictable location, line items in a table, numbers explicit.
  The VLM is reading, not interpreting.
- **The receipt is the source of truth.** If the receipt says 3 packs at
  $97, that's auditable evidence — no ambiguity about what was actually
  paid.
- **The interaction is asynchronous and visual.** Maria snaps a photo at
  10 AM at Costco. She sits down at 6 PM, sees the extracted table, fixes
  two mismatched SKUs, clicks "log as ad-hoc." No back-and-forth
  conversation, no latency requirements.

The narration bot wanted **real-time understanding**. The receipt scan
wants **post-hoc digitization**. The latter is a much easier problem.

---

## Architecture (5 pieces)

### 1. Image intake

Maria uploads the photo either via:
- An ERP page: `/procurement/upload-receipt`
- Or via a chat interface (send photo to a bot → bot calls ERP API)

Image goes to Cloudinary (already integrated for product photos).
Cloudinary URL is stored as the audit trail — every record created from
this receipt links back to the image.

### 2. Extraction via VLM (Vision Language Model)

The VLM gets the image + a structured prompt. Two variants:

**For receipts:**
> "Extract: vendor name, vendor address (if shown), receipt/ticket number,
> date, payment method, line items (description, qty, unit, unit price,
> line total), subtotal, tax, total. Return as JSON."

**For price lists:**
> "Extract: vendor name, list date, all material entries with name, pack
> size, price per pack, unit. Return as JSON."

VLMs are very good at receipts — it's one of the most-studied document
formats in OCR research. Hard cases: crumpled paper, faded thermal
printer ink, non-Spanish receipts, vendor-specific table layouts. Most
are solvable with a second VLM pass or human correction in the UI.

### 3. SKU matching service

For each extracted line item, try to match to a Material in the DB:

- **Exact match on `material.name`**: "ROSA AZUL" → FLR-ROSA-AZUL. Done.
- **Fuzzy match**: "Rosa Azul Blue Curio" → 92% similarity → propose with
  high confidence.
- **Partial match**: "Eucalipto Dolar" → matches "EUCALIPTO DOLAR" →
  propose.
- **No match**: "Costco foliage mix" → no SKU exists → propose as
  "no-SKU ad-hoc, free text" (requires the schema change to make
  `AdHocPurchase.materialSku` nullable — see Gap 1 from the 2026-11-09
  design session).

Matching service uses:
- Postgres trigram similarity (or SQLite FTS5 with synonyms)
- A learned aliases table: every time Maria manually matches "Blue Curio"
  → ROSA-AZUL, the system remembers. Next time it auto-matches.
- The existing `SupplierPrice` table: if LA FINCA sells "Blue Curio" and
  we've logged that price before, the alias is implicit.

### 4. Confirmation UI

A new ERP page: `/procurement/receipts/[id]`. Shows:

```
[Image thumbnail]                    Costco Wholesale
                                     Receipt #8847-23491
                                     Date: 2026-11-06
                                     Total: $487.34
                                     Payment: card

Extracted items (4):

| ✓ | Line item               | Qty | Unit price | Proposed SKU        | Confidence |
|---|-------------------------|-----|------------|---------------------|------------|
| ✓ | Rosa Blue Curio         | 3   | $97.00     | FLR-ROSA-AZUL       | 92%        |
| ✓ | Eucalipto Dolar         | 2   | $48.50     | FOL-EUCALIPTO-DOLAR | 88%        |
| ⚠ | Foliage mix             | 1   | $50.00     | (no match)          | 0%         |
| ✗ | Pizza slice             | 1   | $4.99      | (skip — not work)   | —          |

[ Log as ad-hoc purchases (3 items, $482.50) ]   [ Add to PO-3007 ]
[ Save as expense only (no inventory bump) ]
```

Maria ticks/unticks items, fixes wrong SKU matches via dropdown, marks
items as "skip — not work-related." Then clicks one of the action
buttons.

### 5. Action — creates the right ERP records

- **"Log as ad-hoc purchases"** → creates one `AdHocPurchase` per line.
  Bumps stock on the SKU-matched ones. The no-SKU ones (Costco foliage
  mix) get logged with `materialSku = null` (after schema change).
- **"Add to PO-3007"** → links the ad-hoc purchases as the "actual
  purchase" for that PO's lines. The PO's `actualCost` updates with real
  prices.
- **"Save as expense only"** → logs the items as expenses (no inventory
  bump, no PO link). Useful for things like tape, ribbon, scissors —
  work-related but not material-tracking-worthy.
- **The image URL is attached to every record created.** Audit trail
  preserved.

---

## Receipt vs. Price List — two different features

| | Receipt | Price list |
|---|---|---|
| What it is | Proof of purchase | Vendor's catalog |
| When taken | At checkout, after buying | At the warehouse, browsing |
| What it proves | You paid $X for item Y on date Z | Vendor W sells item Y for $X |
| ERP target | AdHocPurchase / Expense | SupplierPrice (table already exists) |
| Inventory impact | Yes (bumps stock) | No (just price reference) |
| Financial impact | Yes (cost recorded) | No |

Both flows share 80% of the architecture (image intake + VLM extraction
+ SKU matching). The difference is the destination table and the action
button.

The price list flow is actually more valuable long-term, because the
`SupplierPrice` table is what powers the Supplier Comparison tab on
`/procurement`. If Maria scans LA FINCA's price list once a month, the
comparison stays current — and she'd catch price drift the moment it
happens.

---

## Mixed items on one receipt — what already exists vs. what's missing

Maria said: "I buy things unrelated to a specific quote/order, but the
expense still needs to be logged if it pertains to my work."

The ERP already has two distinct record types:
- `AdHocPurchase` — material-specific, has SKU, bumps inventory
- `Expense` — generic expense, no SKU required, financial-only

So a Costco receipt with mixed items becomes:
- Roses + eucalyptus → AdHocPurchase (3 lines, bumps stock)
- Foliage mix (no SKU) → AdHocPurchase with `materialSku = null` (after
  schema change)
- Tape + ribbon → Expense (no inventory impact)
- Pizza slice → ignored

All four linked to the same receipt image. One photo, multiple record
types.

---

## Phased rollout

**Phase 0 (1 day) — proof of concept:**
A standalone script or simple ERP page where Maria uploads a receipt
photo, the VLM extracts the data, and she sees the structured result.
No ERP record creation — just the extraction. This proves the VLM
accuracy is good enough on real receipts. If it works on 10 real
receipts, the foundation is solid.

**Phase 1 (1 week) — receipts → ad-hoc purchases:**
Wire Phase 0 to actually create AdHocPurchases (with the SKU-matching
service + confirmation UI). Skip the "Expense" path and "price list"
path for now. Just receipts → ad-hoc purchases.

**Phase 2 (1 week) — no-SKU + Expense + PO link:**
Add the "no-SKU" path (depends on the schema change), the "Expense"
path (link to existing `/expenses`), and the "attach to PO" path.

**Phase 3 (1 week) — price list flow:**
Separate upload type, writes to `SupplierPrice`.

**Phase 4 (ongoing) — learn aliases:**
Every correction Maria makes trains the alias table. The system gets
better the more she uses it.

---

## Honest challenges

1. **VLM accuracy on real-world receipts.** Thermal paper + crumpled +
   Spanish vendor names = harder than marketing demos suggest. Plan
   for ~80% line items correct on first try, ~95% after one round of
   human correction. The confirmation UI has to be fast, not just
   look good in a demo.

2. **SKU matching is a moving target.** Vendors change names
   ("Blue Curio" → "Blue Curio Rosa"), Maria adds new materials,
   discontinues old ones. The matching service needs to learn. The
   aliases table is the right approach but it takes time to build up.

3. **The "is this work-related?" question.** The VLM can't tell whether
   the pizza slice is for the workshop team lunch (work expense,
   deductible) or a personal snack (skip). It can guess based on item
   type (pizza = probably personal; floral tape = definitely work). But
   Maria will always need to confirm. The UI has to make this
   confirmation fast — checkbox per line, default best-guess
   pre-checked.

---

## Three scoping questions to answer before committing to build

1. **How many receipts per week?** If 1-2, manual entry isn't bad enough
   to justify the build. If 5+, the bot pays for itself in week one.

2. **What's the photo quality like?** Consistent clean overhead shots of
   flat receipts → high accuracy. Snapping while walking out with a
   crumpled receipt in hand → lower accuracy. The system can be tuned
   for one or the other, not both.

3. **Are vendors' price lists structured?** LA FINCA probably has a
   clean Excel-style list. Costco's price labels are photos of
   chalkboards. One is easy, the other is hard. Worth checking what
   we're actually working with.

---

## Why this is parked

Maria explicitly said: "This is too big to deal with right now, but I
wanted to check. We have to finish workflow first."

The "workflow" she's referring to is the execution-log Gap 1–4 design
session from 2026-11-09:

- **Gap 1** — Ad-hoc-purchase source option in execution dialog (so
  Costco purchases can be linked mid-execution)
- **Gap 2** — Editable execution logs (PATCH endpoint + UI)
- **Gap 3** — Paid/Unpaid dropdown on execution logs
- **Gap 4** — Per-line `costBasis` (list / linked-purchase / manual) +
  "Link ad-hoc purchases" multi-select at execution time

The schema changes from that session (`AdHocPurchase.materialSku`
nullable + `ExecutionLog` time tracking fields + `paymentStatus` +
`costBasis` on `ExecutionLogLine`) are prerequisites for this bot
assistant too. So finishing the workflow fixes first means the bot
assistant lands on a foundation that already supports no-SKU ad-hoc
purchases — which is the most common case in real receipts.

**Order of operations:**

1. Finish Gap 1–4 (workflow fixes) — ~2-3 weeks of work
2. Then revisit this bot assistant concept — answer the three scoping
   questions above, decide whether to start Phase 0

---

## Related files

- `FIXES.md` — Class 9 covers the post-audit regressions from v1.9.2,
  including the `qtyLostPacks` → `qtyLost` rename that prompted the
  workflow discussion
- `src/app/(erp)/settings/page.tsx` — WishlistItem for this is filed
  under "Bot assistant ticket photo" with priority "backlog"
- `src/app/api/ad-hoc-purchases/route.ts` — current ad-hoc endpoint;
  would be the API target for the bot's record creation
- `src/app/api/materials/route.ts` — material search endpoint; would
  power the SKU-matching service
- `prisma/schema.prisma` — `AdHocPurchase` model (lines 607+); needs
  `materialSku` nullable before this bot can handle real-world receipts

---

## History

- **2026-11-09:** Concept documented from a design discussion with
  Maria. Parked in favor of finishing the execution-workflow fixes
  (Gap 1–4) first. Added as a backlog item in the Settings →
  Wishlist.
