# session_handoff2.md — Flor by Maria ERP: Full Project Handoff

> **Purpose:** This document is written so that ANY agent or developer (Deepseek, Kimi, Copilot, or a human) can clone, run, understand, and continue developing this project with zero prior context. Everything below was verified directly against the repository. Latest revision: 2026-11-12 (adds Excel workbook policy + Vercel best-practices pointers).

---

## 1. What this project is

**Flor by Maria** ("Flor by Maria — Floristry ERP + Weekly Planner") is a web application for a solo florist business in Monterrey, Mexico. It manages the full business cycle:

- **Catalogue** — bouquets/arrangements with costs, prices, margins, recipe breakdowns, per-line color/variant tracking
- **Quotes → Orders → Payments pipeline** — quotes (cotizaciones), conversion to orders, payment recording and rules
- **Procurement** — purchase orders to suppliers (LA FINCA, OASIS, BDF, PRO FLOR), ad-hoc purchases, missing-purchase logs, supplier price lists
- **Inventory** — perishable materials with 5–7 day shelf life, stock adjustments, stock movements ledger, losses
- **Production** — recipes (bill of materials), custom bouquet builder, execution logs with time tracking
- **Planning** — weekly plan, shopping list (per-supplier aggregation, SL-NNNN identifiers), PDF generation
- **Finance** — expenses, moneys summary, payment rules, recibo (receipt) PDFs
- **Scheduling** — delivery calendar, blocked dates, capacity days, season markers, events (weddings/corporate)
- **Admin** — staff, loans, audit log, knowledge wiki, legal templates, settings, backup

**The system of record is the SQLite/Turso database.** The Excel workbook lineage is a first-class *output product* — see §7 for the workbook policy.

---

## 2. Exact repository identity

| Item | Value |
|---|---|
| GitHub repo | `https://github.com/bverduzco/florbymariaerp.git` |
| Current branch | `main` |
| Other branches | `v1.9-new-ui`, `origin/v1.8-vercel-turso` |
| Tags | `v1`, `v1-demo`, `v1.5`, `v1.6`, `v1.7`, `v1.8`, `v1.9` |
| Baseline feature version | **v1.9.4** (commit `f306911`, pushed 2026-11-11 — "Per-line color + variant tracking (Option A2)") |
| Recent work (2026-11-12) | REBUILD_BRIEF.md §11 added (Vercel best practices); `scripts/generate_erp_workbook.py` written; workbook lineage restored as `data/ERP Zai v1.9.5.xlsx`; DB backup output renamed |
| Deployment | **Vercel** (`vercel.json`, region `iad1`, build `npx prisma generate && next build`) |
| Production DB | **Turso** (libSQL over HTTP); local dev uses a SQLite file |

---

## 3. Tech stack (exact)

- **Framework:** Next.js **16** (App Router, TypeScript 5), React 19
- **UI:** Tailwind CSS **4**, **shadcn/ui** (Radix primitives under `src/components/ui/`), lucide-react, sonner, framer-motion
- **ORM:** Prisma **6.19** with `previewFeatures = ["driverAdapters"]`
  - Local: `@prisma/adapter-better-sqlite3` (better-sqlite3)
  - Remote: `@prisma/adapter-libsql` (`@libsql/client` → Turso)
- **DB:** SQLite (provider `"sqlite"`) — local file **or** Turso (wire-compatible)
- **PDF:** `pdfmake`; **Excel:** `exceljs` (in-app exports) + `openpyxl` (Python workbook tooling)
- **State:** Zustand (localStorage persist) + TanStack Query installed
- **Auth:** custom demo auth — shared `DEMO_PASSWORD`, HMAC-SHA256 signed cookie via `AUTH_SECRET` (`src/lib/auth.ts`)
- **Runtime:** Bun preferred (`bun.lock`); npm works (`package-lock.json`); Node 18+

---

## 4. Clone & run — step by step

```bash
git clone https://github.com/bverduzco/florbymariaerp.git
cd florbymariaerp && git checkout main
bun install        # or: npm install
cp .env.example .env
```

`.env` for **local dev**:

```ini
DATABASE_URL=file:/ABSOLUTE/PATH/TO/PROJECT/db/custom.db
DEMO_PASSWORD=flor2026demo
AUTH_SECRET=<run: openssl rand -hex 32>   # REQUIRED — without it every API route returns 500
```

```bash
npx prisma generate
npm run db:push          # only for a fresh DB — repo ships db/custom.db with data
bun run dev              # → http://localhost:3000
```

Login at `/login` with `DEMO_PASSWORD`. One shared password, HMAC-signed cookie — no multi-user yet (NextAuth multi-user is planned; see REBUILD_BRIEF §5).

**Optional (regenerate Excel products):** Python 3.10+ with `openpyxl` (`pip3 install openpyxl`). `bash setup.sh` checks prerequisites.

---

## 5. Database — how it is wired

`src/lib/db.ts` picks the adapter at runtime from `DATABASE_URL` (`file:` → better-sqlite3; `libsql://` → Turso). `src/lib/db-target.ts` renders a LOCAL/PROD/DEMO/SANDBOX badge by hostname pattern.

**Schema:** `prisma/schema.prisma` — **44 models**: Supplier, Material, Product, RecipeLine, Customer, Order, OrderLineItem, CustomMaterial, CustomRecipe, CustomRecipeLine, StockAdjustment, PurchaseOrder, PurchaseOrderLine, ShoppingList, Event, BlockedDate, CapacityDay, SeasonMarker, Quote, QuoteLine, EventLineItem, Payment, Expense, SupplierPrice, StockMovement, Loss, AdHocPurchase, ExecutionLog, ExecutionLogLine, Staff, Tool, RecipeVersion, MaterialAvailability, MaterialSubstitution, RibbonProperty, PaperProperty, WorkbookSetting, LegalTemplate, TemplateVariable, WikiArticle, CustomerNote, QuoteReminder, AuditLog, MissingPurchaseLog, LoanRecord.

**Turso migrations** are hand-written additive SQL in `prisma/turso-migrations/` (4 files, latest `20261111_add_color_variant_tracking.sql` — color/variant exist ONLY on AdHocPurchase + ExecutionLogLine). Apply with `npm run db:migrate:turso`; tracked in `__turso_migrations`; safe to re-run.

**⚠️ Never run seed scripts against prod/demo Turso.** Back up first (`scripts/snapshot-turso.ts`).

**Date storage quirk (verified):** dates are stored BOTH as epoch-ms integers (Quote.quoteDate, Order.createdAt, …) and ISO-8601 strings (SupplierPrice.date, …) depending on table. Any DB→Excel/report code must handle both.

---

## 6. Project structure map

```
├── src/
│   ├── app/(erp)/            ← ALL ERP pages (layout.tsx = sidebar shell)
│   │   ├── catalogue/ quotes/[id]/ orders/ customers/ payments/
│   │   ├── procurement/ materials/ products/ suppliers/ recipes/ custom/
│   │   ├── execution/[id]/ calendar/ events/ seasons/ shoppinglist/
│   │   ├── expenses/ losses/ loans/ staff/ audit/ knowledge/ legal/ settings/
│   ├── app/api/              ← REST routes per resource (+ auth/login|logout, admin/migrate, admin/db-status, backup)
│   ├── components/ui|floristry/
│   ├── lib/                  ← db.ts (adapter select), db-target.ts (badge), auth.ts, payment-rules.ts,
│   │                          quote-totals.ts, status-transitions.ts, sequential-number.ts,
│   │                          pdf/{recibo,quote,shopping-list,draft,utils}.ts (pdfmake)
├── prisma/schema.prisma + turso-migrations/*.sql
├── db/custom.db              ← local SQLite (system of record)
├── data/ERP Zai v1.2 … v1.9.5.xlsx  ← operational workbook lineage
├── public/erp-zai-*.xlsx     ← served by the /download page (v1_7 … v1_9_4 are LEGACY naming)
├── scripts/                  ← ~55 utilities; key ones in §8
├── vercel.json / next.config.ts / Caddyfile / setup.sh
├── README.md                 ← v1–v1.5 era (data-flow diagram, Excel tab map)
├── MIGRATION_GUIDE.md        ← v1.7→v1.8 Vercel+Turso migration (completed)
├── REBUILD_BRIEF.md          ← ⭐ 1,183-line from-scratch rebuild spec. §11 = Vercel
│                                performance/caching/hardening best practices (added 2026-11-12)
├── BOT_ASSISTANT.md          ← future bot assistant design
└── FIXES.md                  ← bug-audit log; Classes 1–9 all RESOLVED as of 2026-11-07
```

---

## 7. Excel workbook policy (decided 2026-11-12 — do not undo)

There are TWO distinct Excel artifacts. Never confuse them again:

1. **Operational workbook — `ERP Zai vX.Y.xlsx`** (lineage in `data/`, currently **v1.9.5**). A formula-driven working spreadsheet (Dashboard, Assumptions, Invoice, cross-sheet SUMIFS, 42+ tabs). It is **generated FROM the database** by `scripts/generate_erp_workbook.py` and is a full working product alongside the UI. The DB is authoritative; the workbook is never edited back into the DB.
2. **DB backup dump — `Flor by Maria DB Backup YYYYMMDDHHMM.xlsx`** (renamed from the misleading "Flor by Maria ERP …"). Plain per-table export by `scripts/generate_backup_excel.py` for backup/migration only.

**How the generator works** (`scripts/generate_erp_workbook.py`, run via `npm run erp:workbook`):
- Loads the last committed workbook (`public/erp-zai-v1_8_2.xlsx` by default, `--template` to override) with openpyxl, formulas intact.
- Per sheet, classifies columns into: **INPUT** (written from DB), **FORMULA** (re-emitted row-by-row with translated references — never values), **PRESERVE** (Excel-only typed data like Materials "Type", Products "Labor (min)", carried over by key), and trailing **SUM total rows** (re-pointed to the new data extent).
- **MERGE mode:** template rows missing from the DB (e.g. 221 supplier-price history rows, 225 stock movements, 63 blocked dates — the DB import only captured subsets) are appended after the DB rows so nothing is lost. Rows at/after the first total row and prose-note rows are excluded from merging.
- DB tables newer than the template (Custom Materials/Recipes, Audit Log, Loan Records, Wiki, Shopping Lists, …) become **new tabs** in the same house style. **Future features (e.g. the Waste Log) are added to `NEW_SHEETS` in that script** — one entry, done.
- Appends a Version History entry; default output `data/ERP Zai v1.9.5.xlsx` (`--version` to bump).
- Sheet write limits inherited from the template: Materials ≤250 rows, Products ≤60, Orders ≤500, Customers/Quotes ≤300.

Verified 2026-11-12: LibreOffice opens + recalculates the v1.9.5 output cleanly (payments total, product costs/margins, cross-sheet lookups all compute).

---

## 8. Scripts inventory (only what matters)

**Excel products:**
- `scripts/generate_erp_workbook.py` — **the operational workbook generator** (§7). `npm run erp:workbook`
- `scripts/generate_backup_excel.py` — plain DB backup dump → "Flor by Maria DB Backup …xlsx". `npm run erp:backup`
- `scripts/parse_erp.py` — legacy Excel → seed.json parser (Python + openpyxl)

**Seeding / migration:**
- `seed-turso.ts`, `seed-turso-from-local.ts`, `apply-turso-schema.ts`, `apply-turso-expansion.ts`, `apply-base-schema-to-turso.ts`, `snapshot-turso.ts`, `fix-spellings-turso.ts` (+`--dry-run`), `import-erp-workbook.ts`, `backfill-quote-orderid.ts`, `seed-v1-9-{reference,batch3,batch4,batch5}-data.ts`, `seed-v1-9-demo-data.ts`, `seed-wiki-starter.ts`

**Smoke tests** (`npx tsx scripts/<name>.ts`): `new-quote-api-smoke-test.ts`, `quote-orderid-fk-smoke-test.ts`, `smoke-test-quote-totals.ts`, `execution-log-smoke-test.ts`, `execution-log-order-smoke-test.ts`, `payment-rules-api-smoke-test.ts`, `payment-rules-sanity-test.ts`, `wiki-api-smoke-test.ts`, `clean-smoke-tests.ts`

**One-off workbook archaeology (v1.8.x era):** `v1_8*_upgrade.py`, `v1_8_3_fix_formulas.py`, `v1_8_3_fix_external_link.py`, `verify_v1_*.py`, `recalc_xlsx.py` (LibreOffice), `inspect_workbook_v182.py`, `inspect_workbook_deep.py`, `inspect_db_and_headers.py`, `verify_workbook_v195.py`

**Helper:** `add-force-dynamic.py` (many API routes need `export const dynamic = "force-dynamic"`).

---

## 9. Domain logic you must know before editing

1. **Status state machines** — Orders: Draft → Awaiting payment → Ready to buy → In production → Out for delivery → Fulfilled / Cancelled. POs: Draft → Approved → Pending → Procured → Received. Enforced in `src/lib/status-transitions.ts`.
2. **Quotes → Orders** — `POST /api/quotes/[id]/convert-to-order`; discount tiers via `src/lib/quote-totals.ts`.
3. **Payments** — `src/lib/payment-rules.ts` rules engine; billing correctness is the historically highest-severity bug class (FIXES.md).
4. **Multi-write operations MUST use `db.$transaction`** (audit Class 1, fixed in `84f055d`).
5. **Timezone GMT-6 (America/Mexico_City)** everywhere — `src/lib/date-helpers.ts`, `src/lib/pdf/utils.ts`.
6. **UI language is Spanish**; brand colors rose `#BE185D`, stone `#44403C`.
7. **Sequential document numbers** via `src/lib/sequential-number.ts` (ORD/QTE/PO/SL-NNNN…).
8. **Perishable inventory** with stem-level loss tracking (v1.9.2); **color/variant** per-line on ad-hoc purchases + execution log lines only (v1.9.4).
9. **Waste reporting** is the "killer report" — spec in REBUILD_BRIEF §9; will be built next and must land in both the UI and the workbook generator (`NEW_SHEETS`).

---

## 10. Known state, done work, next steps

- **FIXES.md:** bug Classes 1–9 all resolved as of 2026-11-07. Read it to avoid reintroducing them.
- **REBUILD_BRIEF.md** (1,183 lines) is THE next-step spec: from-scratch rebuild on the same stack. §10.4 = function bundle optimization; **§11 (added 2026-11-12) = Vercel best practices**: caching policy per route class, Turso retry/backoff (never double-retry `$transaction`), Node-only runtime (no Edge), security headers config, Upstash rate limits (5/min login, 30/min writes), observability (`withAudit` structured logs + `/api/health`), two `CRON_SECRET`-protected Vercel crons (daily quote reminders `0 14 * * *`, nightly Turso snapshot `30 6 * * *`), deploy hygiene, anti-patterns. Acceptance criteria 14–16 enforce it.
- **Workbook continuity restored** (2026-11-12): see §7. `data/ERP Zai v1.9.5.xlsx` generated + verified.
- **Wishlist** tracked in-app (Settings → System Information), incl. ticket-photo scanning concept (needs `camera=(self)` permission — see REBUILD_BRIEF §11.4).

---

## 11. Fresh-clone verification checklist

1. `bun run dev` → http://localhost:3000 redirects to `/login`
2. Login works; sidebar renders; DB badge shows LOCAL
3. Catalogue lists products; create a customer (DB write works)
4. Create a quote → generate its PDF (pdfmake works)
5. `npm run erp:workbook` → regenerates `data/ERP Zai v1.9.5.xlsx` without errors
6. `npx tsc --noEmit` — know the baseline before changing code

## 12. Conventions & gotchas (read twice)

- `AUTH_SECRET` missing ⇒ **every** API route returns 500.
- Never seed prod/demo Turso; `db:push` uses `--accept-data-loss`.
- Turso migrations are SQL files in `prisma/turso-migrations/` + `MIGRATIONS` array in `src/lib/migrations.ts` (inlined because Vercel serverless can't `readFileSync` arbitrary files).
- Dates in DB are mixed epoch-ms ints and ISO strings — always normalize (see `to_xl()` in `generate_erp_workbook.py` for a reference implementation).
- Wrap multi-write logic in `db.$transaction`; add `force-dynamic` to DB-touching routes.
- Two Excel lineages (§7) — operational workbook vs DB backup; don't mix names or formats.
- `next build` does NOT fail on TS errors; `tsc --noEmit` is the gate.

---

*Every claim above was verified against the repository on 2026-11-12. If the repo has moved on, trust the files over this document.*
