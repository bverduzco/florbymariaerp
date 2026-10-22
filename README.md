# Flor by Maria — Floristry ERP + Weekly Planner

A Next.js web app for managing a floristry business, built around an Excel-based ERP.

## What it does

- 🛍️ **Catalogue** — browse bouquets/arrangements with costs, prices, margins, recipe breakdowns
- 📋 **Weekly Plan** — pick bouquets for the week, assign customers + delivery dates
- 👥 **Customers** — full CRUD for customer records with order history
- 📅 **Delivery View** — monthly calendar showing all upcoming deliveries
- 🛒 **Shopping List** — auto-aggregates plan items into per-supplier procurement list (with pack quantities)
- 💰 **Moneys** — financial summary (Subtotal, Est. Cost, Delivery fee, Discount, Profit)
- 📊 **ERP integration** — read materials, recipes, products, suppliers, stock movements, supplier prices from Excel

## Quick start

```bash
git clone https://github.com/bverduzco/florbymariaerp.git
cd florbymariaerp
bash setup.sh
bun run dev
```

Then open http://localhost:3000.

## Prerequisites

- **[Bun](https://bun.sh)** (or Node.js 18+)
- **Python 3.10+** with `openpyxl` (for Excel parsing)
  - Install: `pip3 install openpyxl`
- **LibreOffice** (optional — only needed if you want to re-edit the Excel and recalc formulas)

The `setup.sh` script checks all of these and guides you if anything is missing.

## What's in this repo

```
.
├── src/                          ← Next.js app source
│   ├── app/                      ← Pages + API routes
│   │   ├── page.tsx              ← Main UI (tabbed: Catalogue / Plan / Customers / Delivery)
│   │   └── api/                  ← REST endpoints (catalogue, customers, plan, materials, upload)
│   ├── components/floristry/     ← UI components
│   ├── lib/                      ← Zustand stores, Prisma client, utilities
│   └── data/seed.json            ← Auto-generated from Excel by parse_erp.py
│
├── prisma/schema.prisma          ← Database schema (SQLite via Prisma ORM)
├── db/custom.db                  ← SQLite database (auto-created by setup.sh)
│
├── data/
│   └── ERP Zai v1.2.xlsx         ← Source-of-truth Excel ERP (19 tabs)
│
├── scripts/
│   ├── parse_erp.py              ← Excel → JSON parser (portable, relative paths)
│   ├── seed.ts                   ← JSON → SQLite loader
│   └── recalc_xlsx.py            ← LibreOffice formula recalc helper (optional)
│
├── setup.sh                      ← One-command setup script
├── package.json                  ← Node.js dependencies
└── README.md                     ← This file
```

## How data flows

```
┌─────────────────────┐
│ ERP Zai v1.2.xlsx   │  ← Excel workbook (19 tabs: Materials, Recipes, Products,
│  (source of truth)  │     Suppliers, Stock Movements, Supplier Prices, etc.)
└──────────┬──────────┘
           │
           ▼  python3 scripts/parse_erp.py
┌─────────────────────┐
│ src/data/seed.json  │  ← Intermediate JSON (parsed data)
└──────────┬──────────┘
           │
           ▼  bun run scripts/seed.ts
┌─────────────────────┐
│  db/custom.db       │  ← SQLite database (what the app actually reads)
└──────────┬──────────┘
           │
           ▼  bun run dev
┌─────────────────────┐
│  Next.js app        │  ← http://localhost:3000
│  (4 tabs + APIs)    │
└─────────────────────┘
```

The app **never writes back to the Excel file**. Excel is read-only source of truth. Changes you make through the UI (adding customers, planning orders, etc.) live only in the SQLite database (and browser localStorage for plan items).

## Updating the Excel ERP

If you edit `data/ERP Zai v1.2.xlsx` (e.g. add a new material, change a price), refresh the database:

```bash
python3 scripts/parse_erp.py    # re-parses Excel → seed.json
bun run scripts/seed.ts         # reloads seed.json → SQLite (overwrites existing data)
```

Then restart `bun run dev`.

**⚠️ Warning:** Re-running `seed.ts` will overwrite any customers you've added through the UI. If you want to preserve UI-added customers, back up `db/custom.db` first.

## App tabs

### Catalogue
- Browse all 4 products with full-width cards (thumbnail placeholder reserved for future bouquet photos)
- Each card shows: price, cost, margin, recipe component count
- Add to weekly plan with customer name (autocomplete from DB) + delivery date picker
- Moneys section at the bottom (vertical layout): Bouquets, Est. Cost, Subtotal, Delivery, Discount, Est. Profit

### Weekly Plan
- Week date range display (e.g. "26-10-2026 to 01-11-2026")
- Edit quantities, customer names, delivery dates inline
- Totals: Bouquets, Revenue, Cost, Profit
- "Shopping List" button opens the per-supplier procurement panel

### Customers
- List of all customers (cards with phone, email, address, notes)
- Click any customer to see detail view with order history (derived from plan items matching customer name)
- Add / Edit / Delete customers via dialog forms

### Delivery View
- Monthly calendar grid (Mon-Sun, weekends shaded, today highlighted)
- Each day shows deliveries with product + customer + qty
- Month stats: Deliveries, Bouquets, Customers, Revenue
- Prev / Today / Next navigation

## Excel ERP structure (v1.2)

19 tabs total:

| Tab | Purpose |
|---|---|
| Version History | Logs every workbook version |
| Dashboard | Live totals (revenue, profit, low stock) |
| README | How the workbook flows |
| Assumptions | Pricing rules (flowers ×2.5, materials ×2, +40% labor, IVA 16%) |
| Materials | 179 items with SKU, pack price, units/pack, colors, stock |
| Suppliers | 4 suppliers (LA FINCA, OASIS, BDF, PRO FLOR) |
| Recipes | Bill of materials per product (29 lines) |
| Products | 4 products (Peachy Bouquet L/M/S, Colores de Otoño Large) |
| Menu | Customer-facing price list |
| Customers | Customer records (Excel side — separate from app's DB) |
| Orders | Order log (Excel side — separate from app) |
| Events | Weddings & corporate jobs |
| Event Line Items | Products within each event |
| Invoice | Auto-generated invoice (type an Order ID) |
| Purchase Orders | 7 POs (PO-3001 through PO-3007) |
| Stock Movements | Ledger of all stock in/out events |
| Supplier Prices | Per-supplier price history (per-supplier "latest" model) |
| Tools & Equipment | Durable tools (scissors, buckets, vases) |
| Recipe Versions | Version log per product |

## Tech stack

- **Framework:** Next.js 16 (App Router, TypeScript)
- **UI:** Tailwind CSS 4 + shadcn/ui component library
- **Database:** SQLite via Prisma ORM
- **State:** Zustand (with persist middleware for localStorage)
- **Excel parsing:** Python + openpyxl
- **Icons:** lucide-react

## Versioning

This repo is tagged:
- `v1` — Clean code-only snapshot (no Excel, no scripts)
- `v1-demo` — Self-contained demo (includes Excel + scripts + setup.sh)

Future versions (`v2`, `v3`, ...) will add the planned overhaul:
- Order model (replacing localStorage plan items)
- Sales pipeline + payment tracking
- Order Intake form
- PDF invoice export
- Excel export of pending orders

See `git tag -l` for all available versions.

## License

Private. © Flor by Maria.
