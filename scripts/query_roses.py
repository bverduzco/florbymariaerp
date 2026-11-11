#!/usr/bin/env python3
"""Query the local SQLite DB for all rose materials + their colors."""
import sqlite3
import sys

DB_PATH = "/home/z/my-project/db/custom.db"

conn = sqlite3.connect(DB_PATH)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

# Find all materials whose name contains "ROSA" or "ROSE" or category=flower with rose-like names
cur.execute("""
    SELECT sku, name, category, colors, unit, packPrice, unitsPerPack, currentStockPacks, supplier
    FROM Material
    WHERE UPPER(name) LIKE '%ROSA%'
       OR UPPER(name) LIKE '%ROSE%'
       OR UPPER(name) LIKE '%ROSAS%'
    ORDER BY name ASC
""")

rows = cur.fetchall()

print(f"Found {len(rows)} rose materials\n")
print(f"{'SKU':<25} {'Name':<35} {'Colors':<25} {'Unit':<8} {'Pack$':<8} {'U/P':<5} {'Stock':<6} Supplier")
print("-" * 145)
for r in rows:
    print(f"{r['sku']:<25} {(r['name'] or '')[:34]:<35} {(r['colors'] or '—')[:24]:<25} {(r['unit'] or '—'):<8} {(r['packPrice'] or 0):<8.2f} {(r['unitsPerPack'] or 0):<5} {(r['currentStockPacks'] or 0):<6} {r['supplier'] or '—'}")

print("\n\n=== Distinct colors across all rose materials ===")
cur.execute("""
    SELECT DISTINCT colors
    FROM Material
    WHERE (UPPER(name) LIKE '%ROSA%' OR UPPER(name) LIKE '%ROSE%')
      AND colors IS NOT NULL
      AND colors != ''
    ORDER BY colors
""")
for r in cur.fetchall():
    print(f"  - {r['colors']}")

# Also check: how many rose materials have NULL or empty colors?
cur.execute("""
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN colors IS NULL OR colors = '' THEN 1 ELSE 0 END) as no_color,
      SUM(CASE WHEN colors IS NOT NULL AND colors != '' THEN 1 ELSE 0 END) as has_color
    FROM Material
    WHERE UPPER(name) LIKE '%ROSA%' OR UPPER(name) LIKE '%ROSE%'
""")
stats = cur.fetchone()
print(f"\n=== Color coverage ===")
print(f"Total rose materials: {stats['total']}")
print(f"  With colors set:    {stats['has_color']}")
print(f"  Without colors:     {stats['no_color']}")

# Check the schema for the colors field — is it free text or structured?
print("\n=== Sample color values (first 10 distinct) ===")
cur.execute("""
    SELECT DISTINCT colors FROM Material
    WHERE colors IS NOT NULL AND colors != ''
    LIMIT 10
""")
for r in cur.fetchall():
    print(f"  {r['colors']}")

conn.close()
