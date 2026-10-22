#!/usr/bin/env bash
# setup.sh — One-command setup for the Flor by Maria ERP demo.
#
# Usage:
#   git clone https://github.com/bverduzco/florbymariaerp.git
#   cd florbymariaerp
#   bash setup.sh
#
# What it does:
#   1. Verifies prerequisites (bun, python, openpyxl)
#   2. Installs Node.js dependencies via `bun install`
#   3. Creates the SQLite database from the Prisma schema
#   4. Parses the Excel ERP (data/ERP Zai v1.2.xlsx) into seed.json
#   5. Loads seed.json into the SQLite database
#   6. Prints next steps (start dev server)
#
# After setup completes, run `bun run dev` to start the app at http://localhost:3000

set -e  # exit on any error

# Always run from the repo root (regardless of where the script was called from)
cd "$(dirname "$0")"

echo "═══════════════════════════════════════════════════════════════"
echo "  Flor by Maria — ERP demo setup"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# ─── 1. Check prerequisites ────────────────────────────────────
echo "▶ Checking prerequisites..."

if ! command -v bun &> /dev/null; then
  echo "❌ Bun is not installed. Install it from https://bun.sh"
  exit 1
fi
echo "  ✓ bun: $(bun --version)"

if ! command -v python3 &> /dev/null; then
  echo "❌ Python 3 is not installed. Install from https://python.org"
  exit 1
fi
echo "  ✓ python3: $(python3 --version)"

# Check openpyxl
if ! python3 -c "import openpyxl" &> /dev/null; then
  echo "  ⚠ openpyxl not installed. Attempting to install..."
  pip3 install openpyxl --break-system-packages 2> /dev/null || pip3 install openpyxl --user
  if ! python3 -c "import openpyxl" &> /dev/null; then
    echo "❌ Failed to install openpyxl. Please run: pip3 install openpyxl"
    exit 1
  fi
fi
echo "  ✓ openpyxl: $(python3 -c 'import openpyxl; print(openpyxl.__version__)')"

# Check that the Excel file exists
if [ ! -f "data/ERP Zai v1.2.xlsx" ]; then
  echo "❌ Excel file not found at data/ERP Zai v1.2.xlsx"
  echo "  Make sure you cloned the repo with all its files."
  exit 1
fi
echo "  ✓ Excel file: data/ERP Zai v1.2.xlsx ($(du -h data/ERP\ Zai\ v1.2.xlsx | cut -f1))"
echo ""

# ─── 2. Install Node.js dependencies ────────────────────────────
echo "▶ Installing dependencies (bun install)..."
bun install --silent
echo "  ✓ Dependencies installed"
echo ""

# ─── 3. Create the SQLite database from Prisma schema ───────────
echo "▶ Creating database schema (prisma db push)..."
mkdir -p db
# Create .env if it doesn't exist (Prisma needs DATABASE_URL)
if [ ! -f ".env" ]; then
  echo 'DATABASE_URL="file:./db/custom.db"' > .env
fi
bun run db:push 2>&1 | tail -3
echo "  ✓ Database schema created"
echo ""

# ─── 4. Parse the Excel ERP into seed.json ──────────────────────
echo "▶ Parsing Excel ERP (scripts/parse_erp.py)..."
python3 scripts/parse_erp.py 2>&1 | grep -v "UserWarning" | grep -v "warn(msg)"
echo "  ✓ seed.json generated"
echo ""

# ─── 5. Load seed.json into the database ─────────────────────────
echo "▶ Loading data into database (scripts/seed.ts)..."
bun run scripts/seed.ts 2>&1 | grep -v "prisma:query" | tail -10
echo "  ✓ Database populated"
echo ""

# ─── 6. Done — print next steps ─────────────────────────────────
echo "═══════════════════════════════════════════════════════════════"
echo "  ✅ Setup complete!"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "  Database summary:"
echo "    - 4 suppliers (LA FINCA, OASIS, BDF, PRO FLOR)"
echo "    - 179 materials (flowers, foliage, packaging)"
echo "    - 4 products (Peachy Bouquet L/M/S, Colores de Otoño)"
echo "    - 29 recipe lines"
echo ""
echo "  Next step:"
echo "    bun run dev"
echo ""
echo "  Then open http://localhost:3000 in your browser."
echo ""
echo "  To refresh the database after editing the Excel:"
echo "    python3 scripts/parse_erp.py"
echo "    bun run scripts/seed.ts"
echo ""
