# Flor by Maria ERP — Rebuild Brief

> **Document type:** Specification for a from-scratch rebuild
> **Starting point:** ERP v1.9.4 (commit `f306911`, pushed 2026-11-11)
> **Target stack:** Next.js 16 (App Router) + TypeScript 5 + Prisma + Turso + Vercel
> **Author:** Design session with Maria (business owner) + assistant
> **Date:** 2026-11-11
> **Status:** Specification — not yet started

---

## 0. How to read this document

This brief tells a dev agent (human or AI) exactly what to build if starting from a clean repository, taking v1.9.4 as the reference for what the system does today. The goal is **not** to clone v1.9.4 feature-for-feature — it's to rebuild the same business capability with better architecture, paying upfront for things v1.9.4 deferred.

The brief is opinionated. Where v1.9.4 made a trade-off that didn't age well, this document says so explicitly and prescribes the alternative. Where v1.9.4 made a good call, the brief preserves it.

---

## 1. Business context

**Flor by Maria** is a solo florist business in Monterrey, Mexico. Maria designs and sells custom bouquets, arrangements, and event florals. The business model:

- **Procurement:** flowers bought in packs (typically 10-24 stems per pack) from a primary supplier (LA FINCA) and ad-hoc from Costco, Mercado de Jamaica, etc.
- **Production:** bouquets arranged in a home studio; perishable inventory with 5-7 day shelf life
- **Sales:** quotes → orders → payments; mix of one-off custom bouquets + repeat catalogue items + event work (weddings, etc.)
- **Pricing:** cost-per-stem × 3.5 (flowers × 2.5 + 40% labor surcharge) + 16% IVA — break-even is ~30% of every pack sold
- **Volume:** currently low (5-20 orders/week), with room to grow to a 5-10 person shop over the next 2-3 years

The ERP must support this workflow today and scale gracefully if Maria hires staff.

### 1.1 Out of scope (build via SaaS integration, not custom code)

- **Wire service integration** (FTD/Teleflora) — FTD explicitly forbids third-party integration; if wire orders are ever needed, switch to a SaaS that handles them
- **E-commerce storefront** — use Shopify + webhook → `/api/orders` (1 week of integration work beats 3 months of custom storefront)
- **Delivery routing** — use Routific/Onfleet if volume justifies it
- **Payment processing** — integrate Stripe via webhook, don't build PCI-compliant flows

These are integration targets, not features to build.

---

## 2. Target architecture

### 2.1 Stack (non-negotiable)

| Layer | Technology | Reason |
|---|---|---|
| Framework | Next.js 16 with App Router | Already deployed, Vercel-native, matches v1.9.4 |
| Language | TypeScript 5 (strict mode) | Non-negotiable |
| Styling | Tailwind CSS 4 + shadcn/ui (New York) | Already in v1.9.4, productive |
| Database ORM | Prisma (latest stable) | Already in use; driver adapters work for both SQLite + libSQL |
| Local DB | SQLite via `better-sqlite3` adapter | For dev — fast, file-based |
| Prod DB | Turso (libSQL) via `@prisma/adapter-libsql` | Edge-replicated SQLite, generous free tier |
| Hosting | Vercel (Hobby → Pro when needed) | Already deployed |
| Auth | NextAuth.js v4 (already installed) | Multi-user from day 1 — see §5 |
| State (client) | Zustand | Already in v1.9.4 |
| State (server) | TanStack Query | Already installed |
| Image hosting | Cloudinary (already integrated) | For product photos, receipt scans, etc. |

### 2.2 Project structure

```
src/
  app/
    (erp)/                    # All authenticated ERP routes live here
      layout.tsx              # Sidebar + TopBar + main wrapper
      dashboard/page.tsx
      quotes/...
      orders/...
      customers/...
      ...
    (auth)/                   # Public auth routes
      login/page.tsx
    api/                      # Route handlers — see §4 for conventions
      ...
    download/                 # Backup Excel download (public route)
    globals.css               # Design system — see §6
    layout.tsx                # Root layout (html, body, fonts)
    page.tsx                  # Redirects to /dashboard (auth-gated)
  lib/
    audit.ts                  # withAudit() HOF — see §3.4
    auth.ts                   # NextAuth config
    db.ts                     # Prisma client + adapter selection
    migrations.ts             # Migration registry — see §3.2
    pricing.ts                # Single source of truth for pricing math
    soft-delete.ts            # Soft-delete helpers + query filters
    status-transitions.ts     # Pipeline + state machine definitions
    sequential-number.ts      # Consecutive ID generator (QTE-, ORD-, etc.)
  components/
    ui/                       # shadcn/ui components (New York)
    sidebar.tsx
    top-bar.tsx
    ...
  scripts/
    seed.ts                   # Realistic seed data — see §8.1
    generate-backup-excel.ts  # Backup export
prisma/
  schema.prisma
  turso-migrations/           # SQL migration files (one per change)
```

**Skip entirely:** `src/components/floristry/*` — this was the legacy single-page-app shell in v1.9.4 that was superseded by the `(erp)/...` route group. ~2,000 lines of dead code. Don't rebuild it.

### 2.3 Vercel deployment config

`vercel.json` (matches v1.9.4):

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs",
  "buildCommand": "npx prisma generate && next build",
  "installCommand": "npm install",
  "regions": ["iad1"],
  "functions": {
    "src/app/api/orders/[id]/pdf/route.ts": { "maxDuration": 60 },
    "src/app/api/quotes/[id]/pdf/route.ts": { "maxDuration": 60 },
    "src/app/api/plan/pdf/route.ts": { "maxDuration": 60 }
  },
  "crons": []
}
```

PDF/Excel generation routes get 60s max duration (requires Vercel Pro). All other routes use the default 10s.

### 2.4 Environment variables

```bash
# Database — local dev
DATABASE_URL=file:./db/custom.db

# Database — production (Turso)
# Set in Vercel: libsql://<db>.turso.io?authToken=<token>

# Auth (NextAuth)
NEXTAUTH_URL=https://florbymaria.vercel.app
NEXTAUTH_SECRET=<openssl rand -base64 32>

# Optional: separate demo DB for testing without polluting prod
DATABASE_URL_DEMO=libsql://<demo-db>.turso.io?authToken=<demo-token>

# Cloudinary (already configured in v1.9.4)
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

**Do not** carry forward the shared `DEMO_PASSWORD` + HMAC-signed cookie auth from v1.9.4. Use NextAuth.js with real per-user accounts from day 1 (see §5).

### 2.5 `next.config.ts`

```ts
const nextConfig: NextConfig = {
  serverExternalPackages: ["pdfmake"],
  reactStrictMode: true,

  // IMPORTANT: do NOT enable typescript.ignoreBuildErrors.
  // v1.9.4 had this set to true as a stopgap during v1.7 migration; it
  // silently swallowed 5 type errors that shipped to production. The
  // rebuild must have clean types from day 1.
  typescript: {
    ignoreBuildErrors: false,
  },

  experimental: {
    serverActions: { bodySizeLimit: "5mb" },
  },

  outputFileTracingExcludes: {
    "/api/**": [
      "./node_modules/better-sqlite3/**/*",
      "./node_modules/@prisma/adapter-better-sqlite3/**/*",
      // Strip unused Prisma WASM engines for DBs we don't use
      "./node_modules/@prisma/client/runtime/query_engine_bg.cockroachdb.wasm-base64.*",
      "./node_modules/@prisma/client/runtime/query_engine_bg.postgresql.wasm-base64.*",
      "./node_modules/@prisma/client/runtime/query_engine_bg.mysql.wasm-base64.*",
      "./node_modules/@prisma/client/runtime/query_engine_bg.sqlserver.wasm-base64.*",
    ],
    "/**": [
      "./node_modules/better-sqlite3/**/*",
      "./node_modules/@prisma/adapter-better-sqlite3/**/*",
      // same WASM engine exclusions
    ],
  },
}
```

**`typescript.ignoreBuildErrors: false` is mandatory.** If the build fails on a type error, fix the type. Do not bypass.

---

## 3. Schema design

The v1.9.4 schema has 45 tables. The rebuild consolidates to ~28 tables by unifying redundant concepts. Every table includes `createdAt`, `updatedAt`, and `deletedAt` from day 1.

### 3.1 Soft-delete on every entity (mandatory)

Every table that represents a business entity gets:

```prisma
model Customer {
  id        String    @id @default(cuid())
  ...
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  deletedAt DateTime?  // null = active; non-null = soft-deleted
  @@index([deletedAt])
}
```

**List queries default to active records:**

```ts
// lib/soft-delete.ts
export const activeOnly = { deletedAt: null } as const

// Usage in any list query:
const customers = await db.customer.findMany({
  where: { ...activeOnly, ...otherFilters },
})
```

**Delete buttons call:**

```ts
await db.customer.update({
  where: { id },
  data: { deletedAt: new Date() },
})
```

**For Customer specifically (LFPDPPP — Mexico data protection law):**

ARCO erase flow for legal erasure requests — replaces PII fields with `[ERASED per ARCO request]` tokens, writes an AuditLog entry noting the erasure happened (without storing the PII itself), then soft-deletes the row. Hard-delete is never used for Customer because Quotes/Orders still reference the customer by ID.

### 3.2 Migration system from day 1

`src/lib/migrations.ts` exists from commit 1. Every schema change ships with:

1. A new SQL file at `prisma/turso-migrations/<YYYYMMDD>_<description>.sql`
2. A matching entry in the `MIGRATIONS` array in `src/lib/migrations.ts` (with the SQL statements inlined — Vercel serverless doesn't bundle arbitrary files for `readFileSync`)
3. The Settings page shows pending migrations + a "Apply migrations" button (calls `/api/admin/migrate`)
4. CI runs migrations on preview deployments automatically

```ts
// src/lib/migrations.ts
export type Migration = {
  name: string  // matches .sql filename without extension
  description: string
  addedAt: string  // ISO date
  statements: string[]
}

export const MIGRATIONS: Migration[] = [
  // Initial schema migration (informational — applied at bootstrap)
  { name: "initial_schema", description: "...", addedAt: "2026-01-01",
    statements: [] },

  // Every subsequent schema change gets an entry here
]
```

**Migration endpoint:** `GET /api/admin/migrate` (authenticated). Idempotent — applies pending migrations, skips applied ones, safe to re-run.

### 3.3 Unified line-item concept (critical)

v1.9.4 has 6 separate "line item" tables with similar shapes: `ExecutionLogLine`, `AdHocPurchase`, `PurchaseOrderLine`, `RecipeLine`, `QuoteLine`, `OrderLineItem`. Each has its own type, its own API, its own create/update logic. Adding a cross-cutting field like `color` requires touching all 6.

**Rebuild approach:** Define a shared `LineItem` interface in `src/lib/types.ts`:

```ts
// Shared shape for every line-item-like record in the system.
// Specialized tables (ExecutionLogLine, AdHocPurchase, etc.) extend
// this base type with their domain-specific fields.
interface LineItemBase {
  // Material reference (nullable on AdHocPurchase to support no-SKU purchases)
  materialSku: string | null
  materialName: string  // always populated (denormalized from Material if SKU set, free-text otherwise)
  materialType: string | null  // flower | foliage | packaging | other

  // Quantity + cost
  qty: number
  unit: string  // stem | pack | piece | meter | wrap
  unitCost: number
  lineCost: number  // qty × unitCost, computed

  // v1.9.4 fields — present on EVERY line item from day 1
  color: string | null     // primary visual axis (rose color, vase color)
  variant: string | null   // secondary axis (rose variety, eucalyptus species, vase size)

  // v1.9.3 fields — present on EVERY line item from day 1
  costBasis: "list" | "linked-purchase" | "manual"  // how unitCost was determined
  linkedAdhocPurchaseId: string | null  // FK when costBasis = "linked-purchase"

  notes: string | null
}
```

Specialized tables (`ExecutionLogLine`, `AdHocPurchase`, etc.) extend this base with their domain fields. When a cross-cutting field is added in the future (e.g. `lotNumber` for batch tracking), it touches the base type once — not 6 tables.

### 3.4 Unified SalesDocument (Quote + Order merge)

v1.9.4 has `Quote` and `Order` as separate tables. Converting a Quote to an Order copies all line items — data duplication risk, no version history.

**Rebuild:** Single `SalesDocument` table with a `type` discriminator:

```prisma
model SalesDocument {
  id          String   @id @default(cuid())
  number      String   @unique  // QTE-0001 or ORD-1001 (prefix based on type)
  type        String   // "quote" | "order"
  status      String   // pipeline status — see status-transitions.ts
  customerId  String
  customer    Customer @relation(fields: [customerId], references: [id])

  // Pricing snapshot (recomputed on every line change)
  subtotal        Float
  discount        Float   @default(0)
  discountType    String  @default("flat")  // flat | percentage
  iva             Float
  deliveryFee     Float   @default(100)
  total           Float
  depositRequired Float
  balanceDue      Float

  // Dates
  eventDate      DateTime?
  deliveryDate   DateTime?
  deliveryAddress String?

  // Notes + soft-delete
  cardMessage      String?
  internalNotes    String?
  notes            String?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  deletedAt        DateTime?

  // Relations
  lineItems SalesDocumentLineItem[]
  versions  SalesDocumentVersion[]
  payments  Payment[]
  executionLogs ExecutionLog[]
  auditLogs AuditLog[]

  @@index([type, status])
  @@index([customerId])
  @@index([deletedAt])
}

model SalesDocumentLineItem {
  id                  String  @id @default(cuid())
  salesDocumentId     String
  salesDocument       SalesDocument @relation(fields: [salesDocumentId], references: [id], onDelete: Cascade)
  // LineItemBase fields (materialSku, materialName, qty, unit, unitCost, lineCost, color, variant, costBasis, etc.)
  ...
  lineNumber Int
  productSku String  // for catalogue items; null for free-text line items
}

model SalesDocumentVersion {
  // Snapshot of the document at a status transition — for audit trail
  id              String   @id @default(cuid())
  salesDocumentId String
  status          String   // status at the time of the snapshot
  snapshot        String   // JSON of the full document + line items
  changedBy       String
  changedAt       DateTime @default(now())
}
```

**Quote → Order conversion** = update `type: "order"`, `status: "draft"`, regenerate the number with `ORD-` prefix, write a `SalesDocumentVersion` snapshot. No copy, no duplication.

### 3.5 Unified Product (CustomRecipe + Product merge)

v1.9.4 has `CustomRecipe` AND `Product` — two tables for the same concept (a design + its bill of materials). Saving a custom bouquet creates both, with sync issues.

**Rebuild:** Single `Product` table:

```prisma
model Product {
  id              String   @id @default(cuid())
  sku             String   @unique  // PRD-XXXX for catalogue, CBQ-XXXX for custom hidden
  name            String
  category        String   // Bouquet | Arrangement | Centerpiece | Custom
  size            String?
  isCustom        Boolean  @default(false)  // true = custom bouquet (hidden from catalogue)
  ...
  recipeLines     RecipeLine[]
  ...
}
```

- Catalogue tab shows `isCustom=false` Products by default
- Custom Bouquet History shows `isCustom=true` Products
- No `CustomRecipe` table — recipe lines link directly to `Product`
- The "Save as Recipe (visible)" flow creates `isCustom=false`
- The "Create Order" flow creates `isCustom=true` (hidden) + a SalesDocument of type "order"

### 3.6 Color + variant on every inventory-touching table (mandatory)

From day 1, these tables include `color: String?` and `variant: String?`:

- `AdHocPurchase`
- `ExecutionLogLine` (becomes `SalesDocumentLineItem` in unified model — but execution logs still need their own line table)
- `Loss`
- `StockMovement`
- `RecipeLine`
- `PurchaseOrderLine`
- `SalesDocumentLineItem`

Both columns are nullable (existing records unaffected), with `@@index([color])` for fast per-color queries.

### 3.7 Structured AuditLog (not free text)

v1.9.4 stores `oldValue` + `newValue` as free-text strings. The rebuild uses structured JSON:

```prisma
model AuditLog {
  id          String   @id @default(cuid())
  entityType  String   // "Customer" | "Order" | "ExecutionLog" | ...
  entityId    String
  action      String   // "create" | "update" | "delete" | "status_change"
  fieldChanges Json?   // [{ field: "deliveryFee", oldValue: 100, newValue: 150 }, ...]
  changedBy   String   // user ID from NextAuth
  changedAt   DateTime @default(now())

  @@index([entityType, entityId])
  @@index([changedAt])
}
```

Queries like "show me every time the price changed on ORD-1003" become trivial.

### 3.8 Final table list (~28 tables)

Consolidated from v1.9.4's 45 tables:

**Sales**
1. `Customer` (with soft-delete + ARCO erase flow)
2. `CustomerNote`
3. `SalesDocument` (Quote + Order merged)
4. `SalesDocumentLineItem`
5. `SalesDocumentVersion` (snapshots)
6. `Event` + `EventLineItem`
7. `Payment`
8. `QuoteReminder`

**Catalogue + Recipes**
9. `Product` (CustomRecipe merged in via `isCustom`)
10. `RecipeLine`
11. `RecipeVersion`
12. `Material` (with `color` + `variant` field on the record itself, for the available-colors list)
13. `CustomMaterial` (El Gato price list — kept separate because it's a different data source)
14. `MaterialAvailability`
15. `MaterialSubstitution`
16. `Supplier`
17. `SupplierPrice`

**Procurement + Inventory**
18. `PurchaseOrder` + `PurchaseOrderLine`
19. `AdHocPurchase` (with `color` + `variant` + nullable `materialSku`)
20. `Expense`
21. `StockMovement`
22. `StockAdjustment`
23. `Loss`
24. `MissingPurchaseLog`
25. `LoanRecord`
26. `Tool`

**Execution**
27. `ExecutionLog`
28. `ExecutionLogLine` (with `color` + `variant` + `costBasis` + `linkedAdhocPurchaseId`)

**Admin**
29. `BlockedDate`
30. `CapacityDay`
31. `SeasonMarker`
32. `Staff`
33. `AuditLog`
34. `WikiArticle`
35. `WorkbookSetting` (configurable pricing rules + business info)
36. `LegalTemplate` + `TemplateVariable`

**Authentication** (new — see §5)
37. `User` (NextAuth)
38. `Account` (NextAuth OAuth)
39. `Session` (NextAuth session)

**Dropped entirely** (redundant with unified models above):
- `Quote` + `QuoteLine` (merged into `SalesDocument` + `SalesDocumentLineItem`)
- `Order` + `OrderLineItem` (merged into `SalesDocument` + `SalesDocumentLineItem`)
- `CustomRecipe` + `CustomRecipeLine` (merged into `Product` + `RecipeLine`)
- `RibbonProperty`, `PaperProperty` (niche, not used in v1.9.4 UI — can add back if needed)

---

## 4. API conventions

### 4.1 `withAudit` higher-order wrapper (mandatory)

Every mutating route handler is wrapped. The wrapper automatically:
1. Authenticates the request via NextAuth
2. Runs the handler
3. On success, writes an AuditLog entry with structured field changes
4. Returns the response

```ts
// lib/audit.ts
export function withAudit<T extends (...args: any[]) => Promise<NextResponse>>(
  handler: T,
  options: { entityType: string }
): T {
  return (async (...args: any[]) => {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const before = /* capture state if needed */
    const result = await handler(...args)
    const after = /* capture state */

    await db.auditLog.create({
      data: {
        entityType: options.entityType,
        entityId: /* extracted from result */,
        action: /* inferred from method */,
        fieldChanges: diff(before, after),
        changedBy: session.user.id,
      }
    })

    return result
  }) as T
}

// Usage:
export const POST = withAudit(async (req: Request) => {
  // ... handler body — no audit code needed here
  return NextResponse.json({ ... }, { status: 201 })
}, { entityType: "Customer" })
```

No route can ship without audit logging — there's no path around the wrapper.

### 4.2 `$transaction` on every multi-write operation

If a route does 2+ DB writes, wrap them in `db.$transaction(async (tx) => { ... })`. No exceptions. Use `tx.x.create()` instead of `db.x.create()` inside.

This was a v1.9.4 fix (Class 1 in `FIXES.md`). The rebuild has it from day 1.

### 4.3 Atomic stock operations

Stock-mutating routes use Prisma's atomic increment/decrement operators:

```ts
// GOOD — atomic at the SQL level
await db.material.update({
  where: { sku },
  data: { currentStockPacks: { decrement: qtyLost } },
})

// BAD — read-then-write race condition
const mat = await db.material.findUnique({ where: { sku } })
const newStock = mat.currentStockPacks - qtyLost
await db.material.update({ where: { sku }, data: { currentStockPacks: newStock } })
```

Combined with `$transaction`, fully safe against concurrent writes.

### 4.4 Status transitions as a state machine

`src/lib/status-transitions.ts` defines canonical pipelines + `isValidTransition(from, to)` for every entity with a status field. Every PATCH endpoint that accepts a `status` field validates via this helper.

### 4.5 Sequential number generation

`src/lib/sequential-number.ts` provides `generateSequentialNumber(db, model, field, prefix, padding)` — used for `QTE-`, `ORD-`, `EXE-`, `ADHOC-`, `CBQ-`, `LOSS-`, `PO-`, `LOAN-`, etc.

**Important:** use `findFirst({ orderBy: { field: "desc" } })` to find the max, NOT `count()`. The `count + 1` pattern caused the QTE-0007 collision bug in v1.9.3 (commit `324f836`).

---

## 5. Authentication + multi-user (do differently)

v1.9.4 uses a shared `DEMO_PASSWORD` + HMAC-signed cookie. The rebuild uses NextAuth.js v4 with real per-user accounts.

### 5.1 Why multi-user from day 1

The v1.9.4 schema already has a `Staff` table and `executedBy` fields that pretend to be per-user. This is the worst of both worlds — schema complexity without functionality. Either commit to multi-user (rebuild approach) or drop the Staff table entirely (not recommended — you'll want staff tracking eventually).

### 5.2 Roles + permissions

Three roles:
- **Admin** (Maria): full access, can delete, can change settings, can apply migrations
- **Staff**: can create/edit customers, orders, quotes, executions, ad-hoc purchases, losses; cannot delete; cannot access Settings, Audit Trail, or apply migrations
- **Viewer** (future — for accountants): read-only access to financial reports

Implemented as a `role` field on `User`. Route handlers check `session.user.role` via the `withAudit` wrapper.

### 5.3 Per-user audit trail

Because every mutation goes through `withAudit`, the audit log records the acting user automatically. The Audit Trail page (`/audit`) shows a filter by user.

---

## 6. Design system (preserve from v1.9.4)

The visual design system is one of the things v1.9.4 got right. Preserve it.

### 6.1 Color palette

```css
:root {
  /* Flor by Maria brand palette — used throughout the UI */
  --fmd-rose: #BE185D;        /* primary accent — buttons, links, active states */
  --fmd-rose-light: #FCE7F3;  /* light rose backgrounds */
  --fmd-stone: #44403C;       /* primary text color */
  --fmd-stone-light: #78716C; /* secondary text */
  --fmd-bg: #FAFAF9;          /* app background (warm off-white, not pure white) */
  --fmd-border: #D6D3D1;      /* borders, dividers */
  --fmd-green: #047857;       /* success states, paid status */
  --fmd-amber: #D97706;       /* warnings, pending status */
  --fmd-blue: #2563EB;        /* info, time tracking */
  --fmd-gray: #6B7280;        /* neutral secondary */
}
```

The primary accent is **rose** (`#BE185D`), not the Tailwind default indigo/blue. This is intentional — Maria's brand is floral, and the rose accent reinforces the visual identity. **Do not use indigo or blue as primary colors anywhere.**

### 6.2 Typography

- Body: `--font-geist-sans` (already in v1.9.4 via `next/font/google`)
- Mono: `--font-geist-mono` (for SKUs, numbers in tables)
- Headings: same as body, just larger + bolder

### 6.3 Component conventions

**shadcn/ui (New York style)** — already installed. Use these for buttons, inputs, dialogs, tables, etc. Don't build custom components when a shadcn one exists.

**Custom `fmd-*` classes** (defined in `globals.css`):
- `.fmd-screen-header` — page header (title + subtitle + action buttons)
- `.fmd-kpi-bar` — horizontal bar of KPI cells at the top of list pages
- `.fmd-kpi-cell` — single KPI (value + label)
- `.fmd-box` — bordered card container (white bg, `--fmd-border` border, 8px radius)
- `.fmd-box-label` — small uppercase label inside a `.fmd-box`
- `.fmd-table` — standard data table (header row + alternating row styles)
- `.fmd-status` — small status badge (color-coded by status value)
- `.fmd-note` — callout box (blue, amber, or red variants)
- `.fmd-btn` — button variants (primary, success, warning, outline)

These are not Tailwind utilities — they're custom classes that compose Tailwind primitives. Keep them in `globals.css` for consistency.

### 6.4 Layout

```
┌─────────────────────────────────────────────────┐
│ TopBar (48px, white, border-bottom)             │
├─────────┬───────────────────────────────────────┤
│ Sidebar │ Main content                          │
│ (240px) │  - Screen header (title + actions)   │
│         │  - KPI bar (lg:flex, hidden on mobile)│
│         │  - Content boxes                      │
│         │  - Tables / forms                     │
└─────────┴───────────────────────────────────────┘
```

- **Desktop (lg+):** fixed sidebar 240px, sticky TopBar, scrollable main with 24px padding
- **Mobile:** sidebar hidden by default (slide-in via hamburger), TopBar simplified, main padding 0 (pages handle their own padding), bottom tab bar (`MobileNav`) for primary navigation
- **Touch targets:** minimum 44px on mobile

### 6.5 Status badge color mapping

```css
.fmd-status.draft      { background: #E0E7FF; color: #3730A3; }
.fmd-status.sent       { background: #FEF3C7; color: #92400E; }
.fmd-status.viewed     { background: #E0E7FF; color: #3730A3; }
.fmd-status.negotiating{ background: #FEF3C7; color: #92400E; }
.fmd-status.accepted   { background: #D1FAE5; color: #065F46; }
.fmd-status.declined   { background: #FEE2E2; color: #991B1B; }
.fmd-status.cancelled  { background: #FEE2E2; color: #991B1B; }
.fmd-status.received   { background: #D1FAE5; color: #065F46; }
.fmd-status.executed   { background: #D1FAE5; color: #065F46; }
.fmd-status.partial    { background: #FEF3C7; color: #92400E; }
.fmd-status.pending    { background: #FEF3C7; color: #92400E; }
```

### 6.6 Color + variant badges (new in v1.9.4 — preserve)

When displaying a `color` or `variant` field inline:

```tsx
{line.color && (
  <span style={{
    marginLeft: "6px", fontSize: "10px",
    color: "#92400E", background: "#FEF3C7",
    border: "1px solid #FDE68A", borderRadius: "3px",
    padding: "1px 5px", fontWeight: 600,
  }}>
    {line.color}
  </span>
)}
{line.variant && (
  <span style={{
    marginLeft: "4px", fontSize: "10px",
    color: "#1E40AF", background: "#DBEAFE",
    border: "1px solid #BFDBFE", borderRadius: "3px",
    padding: "1px 5px", fontWeight: 600,
  }}>
    {line.variant}
  </span>
)}
```

Amber for color, blue for variant. Both hidden when null.

### 6.7 Mobile responsiveness (mandatory)

- **Mobile-first design:** design for 375px width, then enhance for desktop
- **Tables:** wrap in `<div style={{ overflowX: "auto" }}>` so they scroll horizontally on narrow screens; for the most-used list pages (Orders, Quotes, Customers), implement a mobile card view that replaces the table below the `sm` breakpoint
- **Dialogs:** use full-screen centered modals on mobile; consider bottom-sheet dialogs via `vaul` (already installed) for mobile-only patterns
- **KPI bars:** hidden on mobile (`hidden lg:flex`) — too cramped
- **Sidebar:** off-canvas slide-in on mobile (hamburger menu in top-left)

### 6.8 Sticky footer (mandatory)

If a page has a footer, it must stick to the bottom of the viewport when content is shorter than one screen, and be pushed down naturally when content overflows. Use:

```tsx
<div className="min-h-screen flex flex-col">
  <TopBar />
  <main className="flex-1">{children}</main>
  <Footer className="mt-auto" />
</div>
```

---

## 7. Workflow priorities (build in this order)

### 7.1 Phase 0 — Foundation (week 1)

1. Next.js 16 + TypeScript 5 (strict) + Tailwind 4 + shadcn/ui setup
2. Prisma + Turso + local SQLite adapter selection (`src/lib/db.ts`)
3. NextAuth.js with three roles (Admin, Staff, Viewer)
4. Migration system (`src/lib/migrations.ts` + Settings page UI + `/api/admin/migrate` endpoint)
5. Audit log wrapper (`src/lib/audit.ts` + `withAudit` HOF)
6. Soft-delete helpers (`src/lib/soft-delete.ts`)
7. Status transition state machine (`src/lib/status-transitions.ts`)
8. Sequential number generator (`src/lib/sequential-number.ts`)
9. Pricing module (`src/lib/pricing.ts` — single source of truth)
10. Seed data script (`scripts/seed.ts` — see §8.1)

**Exit criteria:** a logged-in admin can navigate to `/dashboard` (empty state), visit `/settings` and see migration status, and run `bun run db:push` + `bun run db:seed` successfully.

### 7.2 Phase 1 — Sales pipeline (week 2)

1. Customer CRUD (with soft-delete + ARCO erase flow)
2. SalesDocument (Quote + Order unified) CRUD with version snapshots
3. Quote → Order conversion (status change, not copy)
4. Quote PDF generation (via `pdfmake` — preserve v1.9.4's `src/lib/pdf/quote.ts`)
5. WhatsApp message generation (`src/lib/quote-message.ts`)
6. Payments (with `direction` + `linkedId` to SalesDocument)
7. Quote reminders

**Exit criteria:** can create a customer, create a quote, send it via WhatsApp, convert to order, log a payment, and the audit trail shows every step with structured field changes.

### 7.3 Phase 2 — Procurement + Inventory (week 3)

1. Material CRUD (with `colors` field for autocomplete suggestions)
2. Supplier + SupplierPrice (price list management)
3. PurchaseOrder + PurchaseOrderLine (with `color` + `variant` per line)
4. AdHocPurchase (with nullable `materialSku` + `color` + `variant` — supports no-SKU purchases)
5. StockMovement (every stock change recorded)
6. Loss (with stem-level reporting + capped stock deduction)
7. MissingPurchaseLog (auto-created on stock discrepancy, resolves via ad-hoc purchase or donation)
8. LoanRecord (borrowed items tracker)

**Exit criteria:** can log a Costco ad-hoc purchase with no SKU + color, log an execution that uses it, see the cost basis inherited on the execution line, and the procurement page shows the linked ad-hoc with color badge.

### 7.4 Phase 3 — Execution (week 4)

1. ExecutionLog + ExecutionLogLine (with `color` + `variant` + `costBasis` + `linkedAdhocPurchaseId`)
2. Per-line cost basis dropdown (list / linked-purchase / manual)
3. Link ad-hoc purchases multi-select with auto-match by SKU
4. Time tracking (Start/Stop timer + manual duration input)
5. Editable execution logs (PATCH endpoint with stock delta logic)
6. Paid/Unpaid dropdown (auto-defaults based on linked order)

**Exit criteria:** the Costco scenario works end-to-end — log ad-hoc, link it to execution, see color + cost inherited, edit the execution and verify stock adjusts correctly.

### 7.5 Phase 4 — Custom Bouquet Builder (week 5)

1. CustomBouquetBuilder page (material picker + live preview)
2. Save as Recipe (visible) → creates `Product` with `isCustom=false`
3. Create Order → creates `Product` with `isCustom=true` (hidden) + SalesDocument of type "order"
4. Custom Bouquet History section (shows `isCustom=true` Products with linked order info)

**Exit criteria:** can design a bouquet, save it as visible recipe (appears in Catalogue), or create order (hidden recipe + linked order). Detail dialog shows full material breakdown.

### 7.6 Phase 5 — Reports (week 6)

1. **Waste report** (Dashboard section) — current month + previous month side-by-side, top 5 materials with highest waste, total $ wasted. This is the killer report — see §9.1
2. **Per-color waste** — slice the waste report by color
3. **Vendor damage rate** — derived from Loss records linked to recent POs/AdHocs
4. **PO comments** — per-line `notes` field on PurchaseOrderLine + condition field (`good | partial-damaged | all-damaged | substituted`)

**Exit criteria:** Maria can answer "what's my monthly waste % per color" without manual calculation.

### 7.7 Phase 6 — Bot Assistant (week 7+)

Receipt/price-list photo scanning via VLM. See `BOT_ASSISTANT.md` for the full architecture. This is the highest-leverage future feature but blocked on Phase 1-5 landing first.

---

## 8. Testing + seed data

### 8.1 Seed script (`scripts/seed.ts`)

Generate realistic test data so every feature can be exercised without manual setup:

- 20 customers (mix of one-time + repeat, with phone/email/address)
- 50 SalesDocuments across all pipeline stages (draft → fulfilled)
- 100 AdHocPurchases across the last 30 days (mix of SKU + no-SKU, with colors + variants)
- 30 ExecutionLogs with mixed cost bases (list / linked-purchase / manual)
- 10 Losses (with stem-level reporting)
- 5 PurchaseOrders with line items
- 5 Events with line items
- Realistic timestamps (spread across the last 60 days)

The seed script is idempotent — running it twice doesn't create duplicates. Uses deterministic IDs for test assertions.

### 8.2 Smoke tests (`tests/workflows/`)

End-to-end tests for the critical paths:

- `tests/workflows/quote-to-order.test.ts` — create quote → send → convert to order → log payment
- `tests/workflows/adhoc-to-execution.test.ts` — log ad-hoc with color → log execution linking it → verify cost basis + color inherited
- `tests/workflows/edit-execution.test.ts` — log execution → edit line qty → verify stock adjusted correctly
- `tests/workflows/soft-delete.test.ts` — soft-delete a customer → verify they don't appear in lists → restore
- `tests/workflows/arco-erase.test.ts` — ARCO erase a customer → verify PII replaced, audit log entry written

These run on every PR via GitHub Actions (or Vercel's preview deployment hooks).

### 8.3 No `ignoreBuildErrors`

`next.config.ts` has `typescript.ignoreBuildErrors: false`. Type errors fail the build. No stopgaps, no escape hatches. If a type error appears, fix it before merging.

---

## 9. The killer report: Waste

### 9.1 What it shows

A section on the Dashboard (or separate `/reports` tab) that answers:

> "Of all the flowers I bought this month, how many stems did I actually use, and how many went to waste?"

For each material in the current month:

```
bought = sum of (AdHocPurchase.qtyPacks × Material.unitsPerPack) + (PurchaseOrderLine.qtyPacks × Material.unitsPerPack)
used   = sum of ExecutionLogLine.qtyUsed
wasted = max(0, bought - used)
waste % = wasted / bought
wasted $ = wasted × (Material.packPrice / Material.unitsPerPack)
```

**Display:**
- Current month total waste % + total $ wasted (big KPI at top)
- Top 5 materials with highest waste % (table)
- Per-color breakdown (sub-table) — "Pink roses: 75% wasted, White roses: 10% wasted"

### 9.2 Why this is the killer report

The 30% break-even rule (sell 30% of every pack to break even) means waste % is the single most important number for pricing decisions. Without seeing it, you're flying blind — you might be losing money on small orders and not realize it.

The waste report is the answer to Maria's question from 2026-11-11: "How will we know if the price of sale covers the procurement expense?"

### 9.3 Don't build per-order exactitude

The waste report is aggregate (monthly per material). Don't try to attribute pack costs to specific orders — that creates daily friction for marginal insight. The aggregate tells you 95% of what you need.

---

## 10. Deployment checklist

### 10.1 Local dev setup

```bash
git clone <repo>
cd flor-by-maria-erp
cp .env.example .env
# Edit .env: set DATABASE_URL=file:./db/custom.db
npm install
npx prisma generate
npx prisma db push
npm run db:seed  # generates test data
npm run dev
# Open http://localhost:3000, log in with admin@florbymaria.com / admin
```

### 10.2 Production deployment

1. Push to `main` branch on GitHub
2. Vercel auto-deploys via GitHub integration
3. Set env vars in Vercel dashboard:
   - `DATABASE_URL` = Turso libSQL URL
   - `DATABASE_URL_DEMO` = (optional) separate Turso DB for testing
   - `NEXTAUTH_URL` = `https://florbymaria.vercel.app`
   - `NEXTAUTH_SECRET` = `<openssl rand -base64 32>`
   - Cloudinary vars (already configured)
4. Visit `https://florbymaria.vercel.app/api/admin/migrate` while logged in to apply any pending migrations to Turso
5. Visit `/settings` to verify migration status + DB row counts

### 10.3 Database adapters

`src/lib/db.ts` picks the adapter based on `DATABASE_URL`:

```ts
function createPrismaClient(): PrismaClient {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error("DATABASE_URL is required")

  if (url.startsWith("libsql://") || url.startsWith("https://")) {
    // Turso — production
    const { PrismaLibSQL } = require("@prisma/adapter-libsql")
    return new PrismaClient({ adapter: new PrismaLibSQL({ url }) })
  }

  if (url.startsWith("file:")) {
    // Local SQLite — dev
    const { PrismaBetterSQLite3 } = require("@prisma/adapter-better-sqlite3")
    return new PrismaClient({ adapter: new PrismaBetterSQLite3({ url }) })
  }

  throw new Error(`Unsupported DATABASE_URL scheme: ${url}`)
}
```

**Note:** the `better-sqlite3` native binary is excluded from Vercel function bundles via `outputFileTracingExcludes` in `next.config.ts` (see §2.5). It's only used in local dev.

### 10.4 Vercel function bundle optimization

Strip unused Prisma WASM engines (~36 MB per function) to keep bundle sizes under Vercel Hobby plan limits:

```ts
outputFileTracingExcludes: {
  "/api/**": [
    "./node_modules/better-sqlite3/**/*",
    "./node_modules/@prisma/adapter-better-sqlite3/**/*",
    "./node_modules/@prisma/client/runtime/query_engine_bg.cockroachdb.wasm-base64.*",
    "./node_modules/@prisma/client/runtime/query_engine_bg.postgresql.wasm-base64.*",
    "./node_modules/@prisma/client/runtime/query_engine_bg.mysql.wasm-base64.*",
    "./node_modules/@prisma/client/runtime/query_engine_bg.sqlserver.wasm-base64.*",
  ],
  "/**": [/* same exclusions */],
}
```

This was a v1.9.4 optimization (commit `bdf5026`) that reduced per-function size by ~46% / -3.5 GB total. Preserve it.

---

## 11. Performance, caching & production hardening (Vercel best practices)

§10.4 covers bundle size. This section covers everything else the rebuild must do to run well on Vercel + Turso at $0/month. Each rule is mandatory unless marked optional. These are additive to v1.9.4 — none of them exist there yet.

### 11.1 Caching policy (route by route)

v1.9.4 marks nearly every route `force-dynamic` (via `scripts/add-force-dynamic.py`). Keep dynamic rendering for ERP pages — the data is per-user and changes constantly — but add the layers v1.9.4 lacks:

| Content | Strategy | Why |
|---|---|---|
| ERP pages (`(erp)/**`) | Dynamic render + React `cache()` for request-level dedupe | Data is per-user, changes per second |
| Client list queries | TanStack Query with `staleTime: 30_000` | Instant tab switches without re-hitting the DB |
| Wiki articles, legal templates | ISR with `revalidate = 300` + `revalidateTag` on write | Read often, written rarely |
| Product photos | Cloudinary `f_auto,q_auto` URLs via `next/image` | Offloads image bandwidth to Cloudinary's CDN |
| PDF / Excel responses | `Cache-Control: no-store`, always | Generated per request; a cached PDF is a wrong PDF |

Rules:

- Never set `force-dynamic` on a route that touches neither the DB nor auth cookies — measure before marking, don't blanket-apply.
- GET handlers returning user-scoped data send `Cache-Control: no-store` (correctness first; TanStack Query provides the UX speed).
- Any mutation that affects ISR-cached content calls `revalidateTag(...)` inside the same `withAudit` block that writes the audit entry.

### 11.2 Turso resilience in serverless (retry + backoff)

libSQL-over-HTTP calls can transiently fail (429 rate limit, 5xx, network blip). v1.9.4 does not retry — a single blip surfaces as a 500 to the user. Requirements for `src/lib/db.ts`:

- Reuse ONE libSQL client via a `globalThis` singleton (already the pattern) — never create per-request clients; each one re-handshakes.
- Wrap the adapter with a retry helper: idempotent reads retry up to 3 attempts with exponential backoff (250ms → 1s → 4s) + jitter. Retry writes **only** on clearly transient errors (HTTP 429/502/503), and never wrap `db.$transaction` bodies in the retry helper — Prisma retries transactions itself; double-retrying can double-apply writes.
- Final failures surface through `withAudit` so they land in AuditLog with route + user context, not just a generic 500.
- Keep Vercel region `iad1` and the Turso primary in a nearby region. If Maria reports slow pages, measure function↔DB latency in Vercel logs first; read replicas are optional and only if measurements demand them.

### 11.3 Runtime choice: Node everywhere, no Edge routes

- All API routes: Node.js runtime (default). Prisma, `pdfmake`, and `exceljs` all require Node.
- Middleware stays minimal — cookie existence check only. The HMAC verification uses Node crypto; do NOT set `runtime = "edge"` on middleware unless that check is rewritten with Web Crypto. Middleware runs on every request — a slow middleware slows the whole app, a broken edge middleware breaks it.
- Never force `runtime = "edge"` on DB-touching routes. Edge + `@libsql/client` works but adds cold-start variance for zero benefit at this traffic level.

### 11.4 Security headers (add on day 1)

```ts
// next.config.ts
async headers() {
  return [{
    source: "/(.*)",
    headers: [
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
    ],
  }]
}
```

- HSTS is set automatically by Vercel — don't duplicate it.
- CSP: ship `Content-Security-Policy-Report-Only` first with `img-src` including Cloudinary, review reports for 2 weeks, then switch to enforcing `Content-Security-Policy`.
- `camera=(self)` is deliberate — the planned ticket-photo scanning feature (§7.7, `BOT_ASSISTANT.md`) needs it.

### 11.5 Rate limiting (protect login + write routes)

Vercel has no app-level rate limiting on Hobby. Use `@upstash/ratelimit` + Upstash Redis (free tier), keyed by IP:

| Route class | Limit |
|---|---|
| `/api/auth/*` (login attempts — brute-force protection on the shared password) | 5 per minute |
| Mutating writes (POST/PATCH/DELETE on business routes) | 30 per minute |
| Reads | unlimited |

- Local dev (no Redis): fall back to an in-memory `Map` limiter — single instance, fine for dev.
- Return `429` with a short JSON error; the UI shows "Demasiadas solicitudes, intenta de nuevo en un minuto."

### 11.6 Observability

- Enable Vercel **Speed Insights** + **Analytics** (free on Hobby) on the `(erp)` layout.
- Extend the `withAudit` wrapper (§4.1) to emit one structured JSON log line per request: `{ route, method, userId, status, durationMs, error? }`. Vercel logs are searchable — this is the cheapest possible APM and it lands for free.
- Add `/api/health` (extends the existing `/api/admin/db-status`): DB ping + pending migration count. Wire an external uptime check to it (UptimeRobot free tier) so Maria learns about outages before her customers do.
- If error volume outgrows Vercel logs, add Sentry (free tier). Optional — don't build custom error aggregation.

### 11.7 Cron jobs (Vercel crons)

`vercel.json` ships with `"crons": []`. Add exactly two:

```json
"crons": [
  { "path": "/api/cron/quote-reminders", "schedule": "0 14 * * *" },
  { "path": "/api/cron/turso-snapshot", "schedule": "30 6 * * *" }
]
```

- `0 14 * * *` UTC = 08:00 America/Mexico_City — daily quote-reminder sweep (reuses the existing quote-reminder logic; quotes are generated in the morning, reminders go out the same morning).
- `30 6 * * *` UTC = 00:30 America/Mexico_City — nightly Turso snapshot export (reuses the `scripts/snapshot-turso.ts` logic) so a bad migration or accidental seed never loses more than one day.
- Both routes MUST verify the `Authorization: Bearer ${CRON_SECRET}` header (Vercel injects the `CRON_SECRET` env var) and return 401 otherwise. An unprotected cron route is a free write API for anyone on the internet.
- Hobby plan allows 2 cron jobs with daily precision — these two fit exactly. Needing a third or finer granularity is a Pro-plan signal, not a reason to build a scheduler.

### 11.8 Build & deploy hygiene

- `npx tsc --noEmit` gates every PR (§8.3 bans `ignoreBuildErrors`; this is the enforcement mechanism).
- Check the Vercel preview deployment on every PR before merge — preview URLs are free and catch env-var/adapter problems that only appear outside localhost.
- Deploy before 10:00 AM Mexico City time so verification happens the same working day — never deploy at the end of the day and walk away.
- Keep `maxDuration: 60` only on the 3 heavy routes from §2.3. Don't widen it: a route that needs 60s is a design smell, not a config problem.

### 11.9 Anti-patterns (don't do these)

- Don't add Redis/caching layers "for performance" before measuring — at 5–20 orders/week the DB is never the bottleneck; TanStack Query + Turso is enough.
- Don't split the app into multiple Vercel projects or micro-frontends — one repo, one project, one deployment.
- Don't move PDF generation to a separate service — v1.9.4 measured it well under 2s against a 60s budget.
- Don't add a second database (e.g. Postgres "for reporting") — Turso + the Waste report (§9) covers analytics at this scale.

---

## 12. What to skip (don't build)

### 12.1 Legacy `floristry/*` components

v1.9.4 has `src/components/floristry/*` — a legacy single-page-app shell superseded by the `(erp)/...` route group. ~2,000 lines of dead code with 5 type errors that were silently swallowed by `ignoreBuildErrors: true`. **Don't rebuild it.** Only build the `(erp)/...` route group.

### 12.2 Wire service integration (FTD/Teleflora)

FTD explicitly forbids third-party integration (per FloristWare's FAQ). If you ever need wire orders, switch to a SaaS that has them — don't try to build it.

### 12.3 Custom e-commerce storefront

Shopify + webhook → `/api/orders` is 1 week of work. Building your own storefront is 3+ months of work that will never be as good. Skip it.

### 12.4 Custom delivery routing

Use Routific, Onfleet, or similar. Don't build.

### 12.5 Custom payment processing

Integrate Stripe via webhook. Don't build PCI-compliant flows.

---

## 13. Acceptance criteria

The rebuild is complete when:

1. ✅ A logged-in admin can create a customer, quote, order, payment, ad-hoc purchase, execution log, loss, and loan — each with audit trail entries
2. ✅ Soft-delete works on every entity (deleted records hidden from lists, restorable)
3. ✅ ARCO erase flow works on Customer (PII replaced with `[ERASED per ARCO request]` tokens, audit log entry written)
4. ✅ The Costco scenario works end-to-end:
   - Log ad-hoc purchase with no SKU + color="toffee"
   - Log execution linked to an order, link the ad-hoc purchase
   - Verify cost basis + color inherited on the execution line
   - Edit the execution line qty, verify stock adjusted correctly
5. ✅ The waste report shows current month + previous month per material, with per-color breakdown
6. ✅ The Custom Bouquet Builder can save visible recipes (catalogue) + hidden recipes (CBQ-NNNN with linked orders)
7. ✅ TypeScript: zero errors (no `ignoreBuildErrors` escape hatch)
8. ✅ Smoke tests pass on every PR
9. ✅ Deployed to Vercel + Turso, accessible at `https://florbymaria.vercel.app`
10. ✅ Visit `/api/admin/migrate` to apply migrations — idempotent, safe to re-run
11. ✅ Visit `/settings` to see migration status + DB row counts + Wishlist
12. ✅ Mobile-responsive: every page works on 375px width with hamburger menu + bottom tab bar
13. ✅ Design system preserved: rose primary accent, fmd-* custom classes, status badge color mapping
14. ✅ Security headers present on every response (§11.4); rate limiting active on login + all mutating routes (§11.5)
15. ✅ Two Vercel crons registered and `CRON_SECRET`-protected: daily quote-reminder sweep + nightly Turso snapshot (§11.7)
16. ✅ `/api/health` returns DB ping + migration status; `withAudit` emits one structured JSON log line per request (§11.6)

---

## 14. Migration path from v1.9.4 (if needed)

If the rebuild runs alongside v1.9.4 during a transition period:

1. Export v1.9.4 data via `scripts/generate_backup_excel.py` (already updated for v1.9.4)
2. Write a one-off import script that reads the Excel + writes to the new schema (mapping `Quote` → `SalesDocument` with `type="quote"`, `Order` → `SalesDocument` with `type="order"`, `CustomRecipe` → `Product` with `isCustom=true`, etc.)
3. Run the import on the new Turso DB
4. Switch DNS / Vercel deployment to the new app
5. Keep v1.9.4 read-only for 30 days as a fallback, then decommission

The data mapping is straightforward because the rebuild's entities are supersets of v1.9.4's entities. No data loss.

---

## 15. History

- **2026-11-11:** Brief written based on a design session reviewing v1.9.4 with Maria. The session covered:
  - What the v1.9.4 schema got right (color + variant tracking, ad-hoc no-SKU support, per-line cost basis, time tracking, editable execution logs)
  - What it got wrong (6 separate line-item tables, CustomRecipe + Product duplication, Quote + Order duplication, shared demo password, no audit logging on most routes, `ignoreBuildErrors: true` swallowing type errors)
  - What to skip entirely (legacy floristry components, wire services, custom e-commerce, custom delivery routing)
  - What to build first in the rebuild (waste report — see §9)
- **2026-11-12:** Added §11 (Performance, caching & production hardening — Vercel best practices): caching policy, Turso retry/backoff, runtime choice, security headers, rate limiting, observability, cron jobs, deploy hygiene, anti-patterns. Former §11–§14 renumbered to §12–§15.
- **2026-11-12 onwards:** Rebuild execution begins (Phase 0)

---

## Appendix A — Reference files in v1.9.4

For the dev agent rebuilding this, the v1.9.4 codebase at commit `f306911` is the reference. Key files to study:

| File | Purpose |
|---|---|
| `prisma/schema.prisma` | Current 45-table schema — the rebuild consolidates to ~28 |
| `src/lib/migrations.ts` | Migration system pattern — preserve |
| `src/lib/db.ts` | DB adapter selection — preserve |
| `src/lib/auth.ts` | Demo auth — REPLACE with NextAuth |
| `src/lib/audit.ts` | Audit log helper — REFACTOR into `withAudit` HOF |
| `src/lib/pricing.ts` | (Doesn't exist yet — pricing logic is duplicated in 4 places) |
| `src/lib/soft-delete.ts` | (Doesn't exist yet — see §3.1) |
| `src/lib/status-transitions.ts` | State machine pattern — preserve |
| `src/app/globals.css` | Design system — preserve (§6) |
| `src/app/(erp)/layout.tsx` | Layout pattern — preserve |
| `src/components/sidebar.tsx` | Navigation — preserve (will need role-based filtering) |
| `src/app/api/execution-logs/[id]/route.ts` | PATCH endpoint pattern with stock delta logic — preserve + generalize |
| `src/app/api/ad-hoc-purchases/route.ts` | Ad-hoc purchase with nullable materialSku + color/variant — preserve |
| `src/app/(erp)/execution/log-execution-dialog.tsx` | Execution dialog with cost basis + time tracking — preserve + refactor |
| `src/app/(erp)/custom/bouquet-builder.tsx` | Custom bouquet builder — preserve |
| `BOT_ASSISTANT.md` | Future bot assistant design — see §7.7 |
| `FIXES.md` | v1.9.4 audit of bugs — informs what to do differently |

## Appendix B — Glossary

- **ARCO** — Mexico's LFPDPPP data protection law granting data subjects the right to Acceder, Rectificar, Cancelar y Oponer (Access, Rectify, Cancel, Oppose). "Cancelación" = erasure.
- **AdHocPurchase** — purchase made outside the formal PO process (e.g. Costco run)
- **Cost Basis** — how the unit cost on an execution line was determined: `list` (preferred supplier price), `linked-purchase` (snapshotted from a specific AdHocPurchase), or `manual` (user-typed)
- **SalesDocument** — the unified Quote + Order entity in the rebuild
- **Soft-delete** — setting `deletedAt = now()` instead of hard-deleting; preserves audit trail
- **Waste %** — `(bought_stems - used_stems) / bought_stems` per material per month — the killer metric for pricing decisions
- **30% break-even** — at the ×3.5 pricing multiplier, you need to sell ~30% of every pack to break even; below that, you lose money
