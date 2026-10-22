# Flor by Maria — v1 Backup

**Backup date:** 2026-10-22
**Backup of:** Flor by Maria Weekly Planner (v1 — pre-overhaul)
**Reason for backup:** Snapshot of v1 state before beginning the Order Intake + Payment Pipeline overhaul

---

## What's in this backup

```
v1-2026-10-22/
├── code/                          ← Next.js app source code (1.2 MB)
│   ├── src/                       ← App code (pages, components, lib, API routes)
│   ├── prisma/schema.prisma       ← Database schema
│   ├── scripts/                   ← In-codebase scripts (parse_erp.py, seed.ts)
│   ├── package.json               ← Dependencies
│   ├── bun.lock                   ← Lockfile
│   ├── tsconfig.json, tailwind.config.ts, etc.
│   ├── .env                       ← Environment vars (DATABASE_URL)
│   └── worklog.md                 ← Multi-agent work log
│
├── data/                          ← Data files (756 KB total)
│   ├── ERP Zai v1.xlsx            ← First extended ERP (246 KB)
│   ├── ERP Zai v1.1.xlsx          ← Megadeco experiment (252 KB)
│   ├── ERP Zai v1.2.xlsx          ← Current source of truth (259 KB)
│   └── custom.db                  ← SQLite database (116 KB)
│
├── scripts/                       ← Standalone build/fix scripts (140 KB)
│   ├── extend_erp.py              ← v0 → v1 builder (added 5 new tabs)
│   ├── build_v11.py               ← v1 → v1.1 builder (megadeco experiment)
│   ├── build_v12.py               ← v1.1 → v1.2 builder (7 POs, 24 new SKUs)
│   ├── fix_v11_megadeco.py        ← v1.1 fix (Conflict 12: per-piece pricing)
│   ├── fix_v11_megadeco_pref.py   ← v1.1 fix (Conflict 9c → B)
│   ├── fix_v11_unit_cost.py       ← v1.1 fix (IFERROR formula)
│   ├── fix_v12_oasis_pref.py      ← v1.2 fix (Preferred Supplier)
│   ├── fix_v12_recipes_rename.py  ← v1.2 fix (Recipes tab SKU rename)
│   ├── parse_erp.py               ← Excel → JSON parser
│   ├── seed.ts                    ← JSON → SQLite seeder
│   ├── recalc_xlsx.py             ← LibreOffice formula recalc helper
│   ├── inspect_erp.py             ← Inspection utility
│   ├── inspect_formulas.py        ← Formula inspection utility
│   └── inspect_for_po_experiment.py ← PO experiment inspection
│
├── worklog.md                     ← Full session work log
└── README.md                      ← This file
```

---

## v1 system state at backup time

### Excel ERP (current source of truth: v1.2)

- **19 tabs:** Dashboard, README, Assumptions, Materials, Suppliers, Recipes, Products, Menu,
  Customers (Excel), Orders (Excel), Events, Event Line Items, Invoice, Purchase Orders,
  Stock Movements, Supplier Prices, Tools & Equipment, Recipe Versions, Version History
- **4 suppliers:** LA FINCA, OASIS, BDF Palacio Floral SA de CV, PRO FLOR
- **179 materials** (153 original + 24 new SKUs added across 7 purchase orders + 2 renames)
- **29 recipe lines** across 4 products
- **4 products:** Peachy Bouquet (L/M/S), Colores de Otoño (Large)
- **7 purchase orders** (PO-3001 through PO-3007), all dated between 2026-07-06 and 2026-10-19
- **0 formula errors** across 11,402 formulas (validated with xlsx.py audit)

### App database (SQLite)

- **4 suppliers** (synced from Excel)
- **179 materials** (synced from Excel)
- **4 products** (synced from Excel)
- **29 recipe lines** (synced from Excel)
- **2 customers** (added through the UI):
  - María González Updated | 55 1234 5678 | maria@example.com | added 2026-10-22
  - Pedro Martínez | 55 9876 5432 | pedro@example.com | added 2026-10-22

### App UI state (browser localStorage — NOT in this backup)

- Plan items (with delivery dates + customer names) — ephemeral, per-browser
- Discount amounts entered in Moneys section — ephemeral, per-browser
- These are NOT backed up. They are test data only.

### App UI features (v1)

1. **Catalogue tab** — browse 4 products, each with thumbnail placeholder (128×128),
   customer name autocomplete, delivery date picker, Add button
2. **Weekly Plan tab** — list of plan items, week date range display,
   edit qty / customer / delivery date inline, totals (Bouquets, Revenue, Cost, Profit)
3. **Customers tab** — list of customers with detail view,
   Add Customer dialog, Edit Customer dialog, Delete Customer dialog (with confirmation),
   customer order history (derived from plan items matching customer name)
4. **Delivery View tab** — monthly calendar grid (Mon-Sun, weekends shaded),
   today highlighted, each day shows deliveries with customer name + product + qty,
   month stats (Deliveries, Bouquets, Customers, Revenue), Prev/Today/Next navigation
5. **Shopping List slide-over** — accessible from header and Weekly Plan tab,
   aggregates plan items into per-supplier shopping list with pack quantities,
   CSV export with customer + delivery date annotations
6. **Moneys section** (bottom of Catalogue tab) — vertical layout showing
   Bouquets / Est. Cost / Subtotal / Delivery ($100/address) / Discount (editable) / Est. profit

---

## How to restore from this backup

### To restore the code

```bash
# 1. Copy code back to the project directory
cp -r /home/z/my-project/backups/v1-2026-10-22/code/* /home/z/my-project/

# 2. Reinstall dependencies
cd /home/z/my-project
bun install

# 3. Regenerate Prisma client
bun run db:generate

# 4. Start the dev server
bun run dev
```

### To restore the Excel ERP

```bash
# Copy v1.2 back to the upload folder (the app reads from here)
cp /home/z/my-project/backups/v1-2026-10-22/data/ERP\ Zai\ v1.2.xlsx \
   /home/z/my-project/upload/Floristry_ERP\ updated\ b.xlsx

# Re-run the parser + seeder to refresh the database
python /home/z/my-project/scripts/parse_erp.py
bun run /home/z/my-project/scripts/seed.ts
```

### To restore the SQLite database (without re-seeding from Excel)

```bash
# Stop the dev server first, then:
cp /home/z/my-project/backups/v1-2026-10-22/data/custom.db \
   /home/z/my-project/db/custom.db

# Restart the dev server
```

This preserves the 2 customers added through the UI that are NOT in the Excel file.

---

## Version history (summary)

| Version | Date | What changed |
|---|---|---|
| v0 (original) | 2026-10-21 | Initial Floristry_ERP updated b.xlsx — 14 tabs, basic ERP |
| v1 | 2026-10-22 | Added 5 new tabs (Version History, Stock Movements, Supplier Prices, Tools & Equipment, Recipe Versions), 2 new suppliers (BDF, PRO FLOR), Materials tab extended with Type + Preferred Supplier columns, Recipes tab extended with Version + Effective From columns |
| v1.1 | 2026-10-22 | Megadeco experiment: 1 real Purchase Order (PO-3002, 6 items), corrected supplier attribution (OASIS not LA FINCA for megadeco baseline), added 2 new margarita SKUs, backdated all baselines to 2026-07-01, applied Conflict 5A (per-supplier latest) model |
| v1.2 | 2026-10-22 | Added 6 more Purchase Orders (PO-3001 through PO-3006) spanning Jul-Oct 2026, renumbered existing PO-3002 → PO-3007 chronologically, added 24 new SKUs, consolidated PKG-ESPUMA-FLORAL into PKG-OASIS-LADRILLO-STD, renamed PKG-MEGADECO-FLORAL → PKG-MEGADECO |

See `worklog.md` for the full session log with all conflict resolutions.

---

## What's coming in v2 (the overhaul)

Per the planned overhaul, v2 will add:

1. **Order model** in Prisma (replacing the localStorage-based plan store)
2. **Orders tab** with status filters (draft / quote_sent / awaiting_payment / payment_confirmed / procuring / producing / delivered / fulfilled / cancelled)
3. **Order Intake form** (customer at top, qty per bouquet, card message, delivery notes, internal notes)
4. **Sales pipeline + payment tracking panel** in each order (quote sent, payment options sent, payment method, payment status, payment confirmed trigger)
5. **"Ready to Buy" view** — shopping list aggregated from confirmed orders
6. **Moneys section moves** into Order Intake (per-order totals, not global)
7. **Excel export** (shopping list per procurement batch)
8. **PDF export** (invoice per order)
9. **Migration** of existing plan items to Orders

v1 stays as the reference point during this transition.
