"""
Apply manual fixes to the El Gato ↔ ERP SKU matches, then re-seed the DB.

Updates the matched Excel at /home/z/my-project/download/El Gato matched to ERP.xlsx
in place, then re-runs scripts/seed_custom_materials.py to refresh the database.

Fixes (from manual review of LOW/VERY_LOW confidence matches):

  Perrito Amarillo (boca de dragón)   FLR-CODORNIZ-AMARILLO   → FLR-PERRITO
  Perrito Blanco (boca de dragón)     FLR-CRISANTEMO-BLANCO-CAMPO-LF → FLR-PERRITO
  Orquídeas                            FLR-ALQUILEA             → FLR-ORQUIDEA-DENDROBIU-CHI
  Yin Yang Chrisanthemums             FLR-AMARANTHUS           → FLR-CRISANTEMO-BLANCO-CAMPO-LF
  Girasol Shushine                    FLR-GIRASOL-CHICO        → FLR-GIRASOL-FULL-SUN
  Rosa Hermosa                         FLR-ROSA-CORTA           → FLR-ROSA-MEDIANA

For the 3 "no perfect match" items, the matched ERP SKU is cleared and confidence
is set to NO_MATCH:

  Argentina Máxima (Blanca)            FLR-ALELI-BLANCO         → (cleared — closest is FLR-LIMONIUM but too uncertain)
  Pins Diamante                       FOL-HOJA-PINANONA-GRANDE → (cleared — mechanical, not in ERP)
  Margaritas Brandy                    FLR-MARGARITA-ROXANA    → FLR-MARGARITA (generic, better than Roxana)
"""

import os
import sys
from openpyxl import load_workbook

MATCHED_PATH = "/home/z/my-project/download/El Gato matched to ERP.xlsx"

# (El Gato name, new erp_sku, new erp_name, new match_confidence, notes)
FIXES = [
    (
        "Perrito Amarillo (boca de dragón)",
        "FLR-PERRITO",
        "PERRITO",
        "HIGH",
        "Manual fix: snapdragon species — Codorniz was wrong.",
    ),
    (
        "Perrito Blanco (boca de dragón)",
        "FLR-PERRITO",
        "PERRITO",
        "HIGH",
        "Manual fix: snapdragon species — Crisantemo Blanco was wrong (color coincidence only).",
    ),
    (
        "Orquídeas",
        "FLR-ORQUIDEA-DENDROBIU-CHI",
        "ORQUIDEA DENDROBIU CHILTEPEC",
        "MEDIUM",
        "Manual fix: orchid species — Alquilea was completely wrong.",
    ),
    (
        "Yin Yang Chrisanthemums",
        "FLR-CRISANTEMO-BLANCO-CAMPO-LF",
        "CRISANTEMO BLANCO DE CAMPO",
        "MEDIUM",
        "Manual fix: Yin Yang is a white chrysanthemum variety — Amarantus was wrong.",
    ),
    (
        "Girasol Shushine",
        "FLR-GIRASOL-FULL-SUN",
        "GIRASOL FULL SUN",
        "HIGH",
        "Manual fix: 'Shushine' is a sunflower variety — Full Sun is closer than Chico.",
    ),
    (
        "Rosa Hermosa",
        "FLR-ROSA-MEDIANA",
        "ROSA MEDIANA",
        "MEDIUM",
        "Manual fix: 'Hermosa' suggests a mid-grade rose — Mediana better than Corta.",
    ),
    (
        "Argentina Máxima (Blanca)",
        "",
        "",
        "NO_MATCH",
        "Manual fix: no confident ERP match. Argentina Máxima is a statice/limonium variety — FLR-LIMONIUM is closest but unconfirmed.",
    ),
    (
        "Pins Diamante",
        "",
        "",
        "NO_MATCH",
        "Manual fix: floral pins are mechanicals, not in flower/foliage ERP. No match.",
    ),
    (
        "Margaritas Brandy",
        "FLR-MARGARITA",
        "MARGARITA",
        "MEDIUM",
        "Manual fix: 'Brandy' is an orange/copper margarita variety — generic MARGARITA is better than Roxana.",
    ),
]

# Read the existing ERP material names from seed.json so we can also look up the
# correct erp_pack_price and erp_unit_cost for the new SKUs.
import json
SEED_PATH = "/home/z/my-project/src/data/seed.json"
with open(SEED_PATH, encoding="utf-8") as f:
    seed = json.load(f)
erp_by_sku = {m["sku"]: m for m in seed["materials"]}


def main():
    if not os.path.exists(MATCHED_PATH):
        print(f"ERROR: matched Excel not found at {MATCHED_PATH}")
        print("Run: python3 scripts/match_el_gato.py first")
        sys.exit(1)

    wb = load_workbook(MATCHED_PATH)
    ws = wb.active

    # Build a name → row-index map (column A holds the El Gato name)
    name_to_row = {}
    for r in range(5, ws.max_row + 1):
        name = ws.cell(row=r, column=1).value
        if name:
            name_to_row[str(name).strip()] = r

    applied = 0
    not_found = []

    for el_gato_name, new_sku, new_name, new_confidence, notes in FIXES:
        row = name_to_row.get(el_gato_name)
        if row is None:
            not_found.append(el_gato_name)
            continue

        old_sku = ws.cell(row=row, column=5).value or ""
        old_name = ws.cell(row=row, column=6).value or ""

        # Update column E (erp_sku), F (erp_name), J (confidence), K (notes)
        ws.cell(row=row, column=5).value = new_sku
        ws.cell(row=row, column=6).value = new_name
        ws.cell(row=row, column=10).value = new_confidence

        # Update the erp_pack_price (col G) and erp_unit_cost (col H) if SKU is set
        if new_sku and new_sku in erp_by_sku:
            m = erp_by_sku[new_sku]
            ws.cell(row=row, column=7).value = m.get("packPrice")
            ws.cell(row=row, column=8).value = m.get("unitCost")
        else:
            ws.cell(row=row, column=7).value = None
            ws.cell(row=row, column=8).value = None

        # Set match score: HIGH=0.1, MEDIUM=0.4, NO_MATCH=1.0
        score_map = {"HIGH": 0.1, "MEDIUM": 0.4, "LOW": 0.55, "VERY_LOW": 0.8, "NO_MATCH": 1.0}
        ws.cell(row=row, column=9).value = score_map.get(new_confidence, 0.5)

        # Notes column (K)
        ws.cell(row=row, column=11).value = notes

        print(f"  ✓ {el_gato_name}")
        print(f"      was: {old_sku} ({old_name})")
        print(f"      now: {new_sku or '(cleared)'} ({new_name or '—'}) [{new_confidence}]")
        applied += 1

    wb.save(MATCHED_PATH)
    print()
    print(f"Applied {applied} fixes to {MATCHED_PATH}")
    if not_found:
        print(f"WARNING: {len(not_found)} items not found in Excel:")
        for n in not_found:
            print(f"  - {n}")

    # Re-run the seeder to refresh the database
    print()
    print("--- Re-seeding database ---")
    import subprocess
    result = subprocess.run(
        ["python3", "/home/z/my-project/scripts/seed_custom_materials.py"],
        capture_output=True, text=True,
    )
    print(result.stdout)
    if result.stderr:
        print("STDERR:", result.stderr, file=sys.stderr)

    print("Done.")


if __name__ == "__main__":
    main()
