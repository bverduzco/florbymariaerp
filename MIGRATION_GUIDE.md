# v1.8 Migration Guide — Vercel + Turso + JS PDF rewrite

This document walks you through migrating the Flor by Maria ERP from v1.7 (Render/Fly.io-ready, Python PDFs, SQLite) to v1.8 (Vercel + Turso + Node PDFs, no filesystem dependency).

**Goal**: a deployment that is **truly free forever** and **never sleeps** (no cold starts for the main UI).

**Time estimate**: 6–8 hours of focused work, split across 2–3 sessions.

**Branch strategy**: all work goes on a new branch `v1.8-vercel-turso`. The `v1.7` tag is preserved untouched as backup.

---

## What changes between v1.7 and v1.8

| Area | v1.7 | v1.8 |
|---|---|---|
| Database | Local SQLite file at `db/custom.db` | Turso (libSQL over HTTP) — `libsql://…` URL |
| PDF generation | Python (`generate_invoice_pdf.py`, `generate_shopping_list_pdf.py`) called via `execFile` | Node (`pdfmake`) — direct in-process call |
| Excel generation | Python (`generate_draft.py`) via `execFile` | Node (`exceljs`) — direct in-process call |
| File storage | Writes to `/home/z/my-project/download/`, served via `/download/[...path]` route | **No files stored** — PDFs/Excel streamed directly as HTTP response |
| Hosting | Render (paid) or Fly.io (free with cold starts) | Vercel (free, no cold starts for static pages) |
| Build output | `output: "standalone"` for self-contained server | Default Next.js output (Vercel handles natively) |

---

## Phase 1 — Branch setup (5 min)

From your v1.7 clone:

```bash
git checkout main
git pull origin main
git checkout -b v1.8-vercel-turso
```

Verify v1.7 tag still exists and is untouched:

```bash
git tag --list | grep v1.7
# should show: v1.7
```

---

## Phase 2 — Install new dependencies (5 min)

```bash
npm install @prisma/adapter-libsql @libsql/client pdfmake exceljs
```

Verify in `package.json`:

```json
"dependencies": {
  "@libsql/client": "^0.x",
  "@prisma/adapter-libsql": "^6.x",
  "exceljs": "^4.x",
  "pdfmake": "^0.2.x",
  ...
}
```

No need to remove `@prisma/client`, `prisma`, or anything else — we're adding to the existing stack.

---

## Phase 3 — Database migration to Turso (1h)

### 3.1 — Create a Turso database

1. Sign up at https://turso.tech (free, no credit card)
2. Create a new database: `florbymaria`
3. Pick region `ams1` or `nrt1` (closest to your users — Turso replicates globally anyway)
4. Get the connection string + auth token:
   - DB URL: `libsql://florbymaria-<your-org>.turso.io`
   - Auth token: a long string starting with `eyJ...`

### 3.2 — Update `prisma/schema.prisma`

Replace the **generator block** at the top to enable the driver adapter preview feature:

```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["driverAdapters"]
}
```

The `datasource` block stays the same:

```prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}
```

Note: `provider = "sqlite"` is correct — Turso is wire-compatible with SQLite. The Prisma libsql adapter handles the protocol translation.

### 3.3 — Update `src/lib/db.ts`

Replace the entire file with the new Turso adapter setup (file included in `v1.8/src/lib/db/db.ts` of this folder).

### 3.4 — Regenerate the Prisma client

```bash
npx prisma generate
```

This regenerates `@prisma/client` with the driver adapter enabled.

### 3.5 — Push schema to Turso

```bash
npx prisma db push
```

This creates all your tables in the Turso database. Run this once per environment (production, preview, etc.).

### 3.6 — Seed initial data

If you have a `scripts/seed.ts`, run it against Turso:

```bash
npm run db:seed   # if you have this script
# or
npx tsx scripts/seed.ts
```

### 3.7 — Migrate existing data from local SQLite

If you have orders/customers/inventory in your local `db/custom.db` that you want to preserve, write a one-off migration script:

```typescript
// scripts/migrate-sqlite-to-turso.ts
import { PrismaClient } from '@prisma/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'
import { createClient } from '@libsql/client'
import Database from 'better-sqlite3'

// Source: local SQLite
const localDb = new Database('./db/custom.db')

// Destination: Turso
const tursoClient = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
})
const adapter = new PrismaLibSQL(tursoClient)
const turso = new PrismaClient({ adapter })

// Copy each table — example for materials
const materials = localDb.prepare('SELECT * FROM Material').all()
for (const m of materials) {
  await turso.material.create({ data: m })
}

// ... repeat for each model
console.log('Done')
```

Run it once:
```bash
npx tsx scripts/migrate-sqlite-to-turso.ts
```

---

## Phase 4 — PDF rewrite (4–5h)

This is the bulk of the work. Three Python scripts are replaced with three TypeScript modules.

### File mapping

| Python file (delete) | TypeScript replacement (create) |
|---|---|
| `scripts/generate_invoice_pdf.py` | `src/lib/pdf/recibo.ts` |
| `scripts/generate_shopping_list_pdf.py` | `src/lib/pdf/shopping-list.ts` |
| `scripts/generate_draft.py` | `src/lib/pdf/draft.ts` |

All three are included in `v1.8/src/lib/pdf/` of this folder.

### Design choices

- **Library**: `pdfmake` — JSON-based document description, closest match to ReportLab's mental model, built-in tables/spans/colors/fonts.
- **Fonts**: Helvetica family (built into pdfmake) — same as ReportLab defaults.
- **Colors**: exact same hex values as the Python versions (`#BE185D` rose, `#44403C` stone, etc.).
- **Layout**: 1:1 match with the Python PDFs — same margins, table column widths, status badges, checkbox prefixes, substitutes SPAN rows.
- **Spanish text**: preserved exactly — `RECIBO`, `Fecha de emisión`, `Para`, `Entregar en`, `Producto`, `Cant.`, `Págo:`, etc.
- **GMT-6 timestamps**: handled via a shared utility (see `src/lib/pdf/utils.ts`).

---

## Phase 5 — API route updates (1h)

Each PDF/Excel API route was:

```typescript
// OLD (v1.7)
await fs.writeFile(tmpJsonPath, JSON.stringify(payload))
await execFileAsync('python3', [scriptPath, tmpJsonPath, outputPath])
return NextResponse.json({ fileName, downloadPath: outputPath })
// Browser then fetches /download/[...path]
```

Each route becomes:

```typescript
// NEW (v1.8)
const pdfBuffer = await generateReciboPdf(payload)
return new Response(pdfBuffer, {
  headers: {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="Recibo ${orderNumber}.pdf"`,
  },
})
// Browser downloads immediately — no server-side file
```

### Routes to update

1. `src/app/api/orders/[id]/pdf/route.ts` — Recibo PDF (uses `src/lib/pdf/recibo.ts`)
2. `src/app/api/plan/pdf/route.ts` — Shopping List PDF (uses `src/lib/pdf/shopping-list.ts`)
3. `src/app/api/orders/draft/route.ts` — Draft Excel (uses `src/lib/pdf/draft.ts`)

All three updated route files are in `v1.8/src/app/api/...` of this folder.

### Route to delete

Delete entirely:
```
src/app/download/[...path]/route.ts
```

The `/download/[...]` static file server route is no longer needed — PDFs/Excel are streamed directly from the API route that generates them.

---

## Phase 6 — Cleanup (15 min)

### 6.1 — Update `next.config.ts`

Remove `output: "standalone"` — Vercel doesn't need it and it can cause issues:

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // No `output: "standalone"` — Vercel handles this natively
  typescript: {
    ignoreBuildErrors: true,  // keep for now — clean up later
  },
  reactStrictMode: false,
};

export default nextConfig;
```

### 6.2 — Update `package.json` scripts

Remove the `bun`-based start script (Bun isn't needed on Vercel):

```json
{
  "scripts": {
    "dev": "next dev -p 3000",
    "build": "next build",
    "start": "next start -p 3000",
    "lint": "eslint .",
    "db:push": "prisma db push --accept-data-loss",
    "db:generate": "prisma generate",
    "db:migrate": "prisma migrate dev",
    "db:reset": "prisma migrate reset"
  }
}
```

### 6.3 — Delete unused Python scripts

```bash
rm scripts/generate_invoice_pdf.py
rm scripts/generate_shopping_list_pdf.py
rm scripts/generate_draft.py
rm scripts/seed.ts   # if it depends on local SQLite — replace with Turso-compatible version
```

Keep the other Python scripts in `scripts/` (build_v11.py, parse_erp.py, etc.) — those are one-off data tools, not runtime deps.

### 6.4 — Update `.gitignore`

Add:
```
# Turso local cache (if any)
.turso/

# Vercel
.vercel
```

---

## Phase 7 — Vercel deploy (30 min)

### 7.1 — Push the v1.8 branch to GitHub

```bash
git add .
git commit -m "v1.8: migrate to Vercel + Turso + Node PDFs"
git push origin v1.8-vercel-turso
```

### 7.2 — Create the Vercel project

1. Go to https://vercel.com → "Add New..." → "Project"
2. Import `bverduzco/florbymariaerp`
3. Set **Production Branch**: `v1.8-vercel-turso` (NOT main — keeps v1.7 on main as backup)
4. **Framework Preset**: Next.js (auto-detected)
5. **Build Command**: `npx prisma generate && next build`
6. **Install Command**: `npm install` (default)
7. Set **Environment Variables** (all environments: Production, Preview, Development):

| Name | Value |
|---|---|
| `DATABASE_URL` | `libsql://florbymaria-<your-org>.turso.io?authToken=<your-token>` |
| `TURSO_DATABASE_URL` | `libsql://florbymaria-<your-org>.turso.io` (same as above but without `?authToken=`) |
| `TURSO_AUTH_TOKEN` | `eyJ...` (your Turso auth token) |
| `TZ` | `America/Mexico_City` |

8. Click **Deploy**

### 7.3 — Verify

After deploy (~3 min), visit `https://florbymariaerp.vercel.app` and check:

- [ ] Home page loads (UI works)
- [ ] Catalogue tab shows products (DB read works)
- [ ] Orders tab loads
- [ ] Create a new order (DB write works — confirms Turso connection)
- [ ] Generate a Recibo PDF (Node PDF generation works)
- [ ] Generate a Shopping List PDF (Node PDF generation works)
- [ ] Generate a Draft Excel (Node Excel generation works)

### 7.4 — Set up auto-deploy

Every push to `v1.8-vercel-turso` branch will now auto-deploy. To make it production:

1. Render dashboard → your project → Settings → Domains
2. Add `florbymaria.mx` (or your domain)
3. Update DNS at your registrar (CNAME to `cname.vercel-dns.com`)
4. Wait for SSL provisioning (~5 min)

---

## Phase 8 — Merge to main (when ready)

Once v1.8 has been running stable for a week or two:

```bash
git checkout main
git merge v1.8-vercel-turso
git push origin main
git tag v1.8 -m "v1.8 — Vercel + Turso + Node PDFs (no filesystem dependency)"
git push origin v1.8
```

Then update Vercel's Production Branch from `v1.8-vercel-turso` back to `main`.

Keep `v1.7` tag forever as a rollback point:
```bash
# If v1.8 ever breaks catastrophically:
git checkout v1.7
# Re-deploy somewhere — Render/Fly.io still works with that code
```

---

## Cost summary

| Service | Free tier | Your usage | Monthly cost |
|---|---|---|---|
| Vercel Hobby | 100GB bandwidth, unlimited static, 1M function invocations | ~1GB, ~100 inv/day | $0 |
| Turso Free | 9GB storage, 1B row reads/mo, 25M row writes/mo | ~100MB, ~10K reads/mo | $0 |
| GitHub | Public repos free | 1 repo | $0 |
| **Total** | | | **$0/mo forever** |

---

## Rollback plan

If v1.8 has issues and you need to revert:

1. **Code rollback**: `git checkout v1.7` — restores the Python-based code
2. **Database rollback**: not needed — Turso and SQLite use the same Prisma schema, your data is the same
3. **Hosting rollback**: deploy v1.7 code to Render Starter or Fly.io (use the v1.7 deployment files I prepared earlier)
4. **Vercel rollback**: in Vercel dashboard, click "Redeploy" on any previous deploy

---

## Common issues during migration

### Issue: `PrismaClientInitializationError: Unknown PRISMA_ENGINE_PROTOCOL`

You forgot to add `previewFeatures = ["driverAdapters"]` to the generator block. Re-run `npx prisma generate`.

### Issue: `Cannot find module '@prisma/adapter-libsql'`

Install deps: `npm install @prisma/adapter-libsql @libsql/client`.

### Issue: PDF generation exceeds Vercel's 10s function timeout on free tier

The Recibo PDF should be fast (<500ms). The Shopping List PDF with many suppliers could take 1-2s. The Draft Excel with many orders could take 2-3s.

If you hit the 10s limit:
1. Move to Vercel Pro ($20/mo) — 60s timeout
2. Or optimize the PDF generation (cache fonts, reduce table complexity)
3. Or move the heavy PDF endpoint to a separate Fly.io VM (sidecar pattern)

### Issue: `pdfmake` bundle is too large for serverless function

`pdfmake` is ~700KB minified. If Vercel complains about function size:
1. Use dynamic import: `const pdfmake = await import('pdfmake')`
2. Or switch to `pdfkit` (smaller, lower-level)

### Issue: Turso rate limit (429)

You've exceeded 25M writes/month (very unlikely for a single florist). Wait for the limit reset, or upgrade to Turso's Scaler plan ($29/mo) for 100M writes/month.

---

## What you keep from v1.7

These don't change in v1.8:
- ✅ All UI components (`src/components/floristry/*`)
- ✅ All non-PDF/Excel API routes (`src/app/api/orders/*`, `customers`, `inventory`, etc.)
- ✅ Prisma schema (just adds preview feature flag)
- ✅ Plan store, catalogue store (Zustand)
- ✅ PO workflow (Draft → Approved → Pending → Procured → Received)
- ✅ Shopping List SL-NNNN identifier system
- ✅ Inventory "Incoming POs" + per-row PO status
- ✅ Spanish translations everywhere
- ✅ GMT-6 timestamps everywhere
- ✅ Tab order, badges, layout — everything visible to the user

The migration is **infrastructure-only**. From the user's perspective, v1.8 should look and behave identically to v1.7 — just hosted on Vercel instead of running locally.

---

## Quick reference — files in this folder

```
v1.8/
├── MIGRATION_GUIDE.md                    ← you are here
├── prisma/
│   └── schema.prisma                     ← patched schema (previewFeatures)
├── src/
│   ├── lib/
│   │   ├── db/
│   │   │   └── db.ts                      ← Turso adapter setup
│   │   └── pdf/
│   │       ├── utils.ts                  ← shared GMT-6 + Spanish date helpers
│   │       ├── recibo.ts                 ← Recibo PDF generator (pdfmake)
│   │       ├── shopping-list.ts          ← Shopping List PDF generator (pdfmake)
│   │       └── draft.ts                  ← Draft Excel generator (exceljs)
│   └── app/api/
│       ├── orders/[id]/pdf/route.ts      ← streams Recibo PDF
│       ├── plan/pdf/route.ts             ← streams Shopping List PDF
│       └── orders/draft/route.ts         ← streams Excel
├── package.json.patch                    ← deps + scripts changes
├── next.config.ts                        ← Vercel-friendly config
├── .env.example                          ← env vars reference
└── vercel.json                           ← optional Vercel config
```

Apply each file to the corresponding path in your v1.8 branch, commit, push, deploy.
