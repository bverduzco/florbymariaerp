"""
Build ERP Zai v1.1 from v1.

Applies all decisions from Conflicts 1-11:
  - Delete PO-3001 (example row)
  - Add PO-3002 with 6 line items dated 2026-10-19, supplier LA FINCA, status Received
  - Add 6 Stock Movements rows (PO received, +1 pack each)
  - Backdate all 153 existing Stock Movements initial-balance rows from 2026-10-22 → 2026-07-01
  - Backdate all 148 Supplier Prices baseline rows from 2026-10-22 → 2026-07-01
  - Correct megadeco baseline supplier: LA FINCA → OASIS
  - Add 3 new Supplier Prices rows dated 2026-10-19 (megadeco/LF/$48, margarita-ocre-LF/$102, margarita-mufasa-LF/$102)
  - Append 2 new Materials rows: FLR-MARGARITA-OCRE-LF, FLR-MARGARITA-MUFASA-LF
  - Set megadeco Preferred Supplier (col R) to blank (Conflict 9c)
  - Update Materials Pack Price formula to filter by Preferred Supplier
  - Add v1.1 entry to Version History
  - Recipe Versions: leave at 2026-10-01 (Conflict 11b)

Source:  /home/z/my-project/download/ERP Zai v1.xlsx
Output:  /home/z/my-project/download/ERP Zai v1.1.xlsx
"""

from copy import copy
from datetime import datetime
from openpyxl import load_workbook
from openpyxl.styles import Font, PatternFill, Border, Side, Alignment
import os
import shutil

V1_PATH = "/home/z/my-project/download/ERP Zai v1.xlsx"
OUT_PATH = "/home/z/my-project/download/ERP Zai v1.1.xlsx"

BASELINE_DATE = datetime(2026, 7, 1)
PO_DATE = datetime(2026, 10, 19)
V11_DATE = datetime(2026, 10, 22)

# Styles (matching v1)
HEADER_FILL = PatternFill(fill_type="solid", fgColor="FF2F5233")
HEADER_FONT = Font(name="Arial", size=10.5, bold=True, color="FFFFFFFF")
HEADER_ALIGN = Alignment(horizontal="center", vertical="center", wrap_text=True)

INPUT_FILL = PatternFill(fill_type="solid", fgColor="FFFFFF00")
INPUT_FONT = Font(name="Arial", size=11, color="FF0000FF")

FORMULA_FONT = Font(name="Arial", size=10.5, color="FF000000")

THIN = Side(border_style="thin", color="FF000000")
BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)

TITLE_FONT = Font(name="Arial", size=14, bold=True, color="FF1F3B4D")
SUBTITLE_FONT = Font(name="Arial", size=10, italic=True, color="FF6B8E6B")


def set_input(cell, value, fmt="General"):
    cell.value = value
    cell.font = INPUT_FONT
    cell.fill = INPUT_FILL
    cell.border = BORDER
    cell.number_format = fmt


def set_formula(cell, formula, fmt="General"):
    cell.value = formula
    cell.font = FORMULA_FONT
    cell.border = BORDER
    cell.number_format = fmt


# ============================================================
# 1. PURCHASE ORDERS — delete PO-3001, add 6 rows for PO-3002
# ============================================================
def update_purchase_orders(wb):
    ws = wb["Purchase Orders"]

    # Find PO-3001 row(s) and delete them
    rows_to_delete = []
    for r in range(5, ws.max_row + 1):
        if ws.cell(row=r, column=1).value == "PO-3001":
            rows_to_delete.append(r)
    # Delete from bottom to top so row indices stay valid
    for r in reversed(rows_to_delete):
        ws.delete_rows(r, 1)

    # Find first empty row after header
    row = 5
    while ws.cell(row=row, column=1).value:
        row += 1

    # 6 line items for PO-3002
    # SKU, Material Name, Qty, Cost per Pack
    items = [
        ("PKG-MEGADECO-FLORAL",    "ESPUMA FLORAL",                          1, 48),
        ("FLR-MARGARITA-OCRE-LF",  "MARGARITA OCRE",                        1, 102),
        ("FLR-MARGARITA-MUFASA-LF","MARGARITA MUFASA (BOTÓN NARANJA)",      1, 102),
        ("FOL-RUSCUS-LARGO",        "RUSCUS LARGO 56-75 cm",                 1, 46),
        ("FLR-MARGARITA-OCRE-LF",  "MARGARITA OCRE",                        1, 102),  # margarita mufasa second variant — wait, this is wrong
    ]
    # Correction: the user's input was 6 items, let me re-list them correctly:
    items = [
        ("PKG-MEGADECO-FLORAL",     "ESPUMA FLORAL",                          1, 48),    # megadeco
        ("FLR-MARGARITA-OCRE-LF",   "MARGARITA OCRE",                         1, 102),   # margarita orange ocre
        ("FOL-RUSCUS-LARGO",         "RUSCUS LARGO 56-75 cm",                  1, 46),    # ruscus
        ("FLR-MARGARITA-MUFASA-LF", "MARGARITA MUFASA (BOTÓN NARANJA)",       1, 102),   # margarita mufasa
        ("FOL-EUCALIPTO-MONEDA",    "EUCALIPTO MONEDA",                       1, 95),    # eucalipto moneda
        ("FLR-CEMPAZUCHIL-BQT",     "CEMPAZUCHIL BQT",                        1, 85),    # cempasuchil bouquet
    ]

    for sku, name, qty, cost in items:
        set_input(ws.cell(row=row, column=1), "PO-3002")
        set_input(ws.cell(row=row, column=2), PO_DATE, fmt="yyyy-mm-dd")
        set_input(ws.cell(row=row, column=3), "LA FINCA")
        set_input(ws.cell(row=row, column=4), sku)
        set_input(ws.cell(row=row, column=5), name)
        set_input(ws.cell(row=row, column=6), qty, fmt="#,##0")
        set_input(ws.cell(row=row, column=7), cost, fmt='"$"#,##0.00')
        # Total = Qty * Cost per Pack (formula)
        set_formula(ws.cell(row=row, column=8), f"=F{row}*G{row}", fmt='"$"#,##0.00')
        # Expected Delivery — blank (already received)
        set_input(ws.cell(row=row, column=9), "")
        set_input(ws.cell(row=row, column=10), "Received")
        row += 1

    print(f"  Purchase Orders: deleted PO-3001, added 6 rows for PO-3002")


# ============================================================
# 2. STOCK MOVEMENTS — backdate initial balance, add 6 PO rows
# ============================================================
def update_stock_movements(wb):
    ws = wb["Stock Movements"]

    # Backdate all "Initial balance" rows from 2026-10-22 → 2026-07-01
    backdated = 0
    for r in range(5, ws.max_row + 1):
        reason = ws.cell(row=r, column=4).value
        if reason == "Initial balance":
            ws.cell(row=r, column=1).value = BASELINE_DATE
            backdated += 1
    print(f"  Stock Movements: backdated {backdated} initial-balance rows to 2026-07-01")

    # Find first empty row
    row = 5
    while ws.cell(row=row, column=1).value:
        row += 1

    # Add 6 PO-received rows dated 2026-10-19, ref PO-3002, +1 pack each
    items = [
        ("PKG-MEGADECO-FLORAL",     "ESPUMA FLORAL", 1),
        ("FLR-MARGARITA-OCRE-LF",   "MARGARITA OCRE", 1),
        ("FOL-RUSCUS-LARGO",         "RUSCUS LARGO", 1),
        ("FLR-MARGARITA-MUFASA-LF", "MARGARITA MUFASA", 1),
        ("FOL-EUCALIPTO-MONEDA",    "EUCALIPTO MONEDA", 1),
        ("FLR-CEMPAZUCHIL-BQT",     "CEMPAZUCHIL BQT", 1),
    ]
    for sku, name, packs in items:
        set_input(ws.cell(row=row, column=1), PO_DATE, fmt="yyyy-mm-dd")
        set_input(ws.cell(row=row, column=2), sku)
        set_input(ws.cell(row=row, column=3), packs, fmt="#,##0")
        set_input(ws.cell(row=row, column=4), "PO received")
        set_input(ws.cell(row=row, column=5), "PO-3002")
        set_input(ws.cell(row=row, column=6), f"Received from LA FINCA — {name}")
        row += 1
    print(f"  Stock Movements: added 6 PO-received rows (ref PO-3002, +1 pack each)")


# ============================================================
# 3. SUPPLIER PRICES — backdate baseline, fix megadeco supplier, add 3 new rows
# ============================================================
def update_supplier_prices(wb):
    ws = wb["Supplier Prices"]

    # Backdate all v1 baseline rows from 2026-10-22 → 2026-07-01, fix megadeco supplier
    backdated = 0
    megadeco_fixed = False
    for r in range(5, ws.max_row + 1):
        sku = ws.cell(row=r, column=2).value
        notes = ws.cell(row=r, column=7).value or ""

        # Backdate baseline rows
        if "Baseline from Oct 2026" in notes or "seeded by Z.ai" in notes:
            ws.cell(row=r, column=1).value = BASELINE_DATE
            backdated += 1

            # Fix megadeco supplier: LA FINCA → OASIS
            if sku == "PKG-MEGADECO-FLORAL":
                ws.cell(row=r, column=3).value = "OASIS"
                ws.cell(row=r, column=7).value = "Baseline from Oct 2026 OASIS list (corrected in v1.1 — original seed attributed to LA FINCA in error)."
                megadeco_fixed = True

    print(f"  Supplier Prices: backdated {backdated} baseline rows to 2026-07-01; megadeco supplier corrected: {megadeco_fixed}")

    # Find first empty row
    row = 5
    while ws.cell(row=row, column=1).value:
        row += 1

    # Add 3 new rows dated 2026-10-19 (Is Latest = yes for each)
    # Per Conflict 5A, Is Latest is per (SKU, Supplier) — so all 3 new rows can be "yes"
    # alongside the existing OASIS megadeco row (which stays "yes" as the latest OASIS price).
    new_rows = [
        # date, sku, supplier, pack_price, units_per_pack, is_latest, notes
        (PO_DATE, "PKG-MEGADECO-FLORAL",    "LA FINCA", 48,  15, "yes", "Purchased at LA FINCA — Conflict 5A: per-supplier latest. Existing OASIS $43.07 baseline stays as the latest OASIS quote."),
        (PO_DATE, "FLR-MARGARITA-OCRE-LF",  "LA FINCA", 102, "", "yes", "New SKU — orange/ocre color variant of FLR-MARGARITA. First quote from LA FINCA."),
        (PO_DATE, "FLR-MARGARITA-MUFASA-LF","LA FINCA", 102, "", "yes", "New SKU — botón naranja (mufasa) color variant. First quote from LA FINCA."),
    ]
    for date, sku, supplier, price, units, is_latest, notes in new_rows:
        set_input(ws.cell(row=row, column=1), date, fmt="yyyy-mm-dd")
        set_input(ws.cell(row=row, column=2), sku)
        set_input(ws.cell(row=row, column=3), supplier)
        set_input(ws.cell(row=row, column=4), price, fmt='"$"#,##0.00')
        set_input(ws.cell(row=row, column=5), units if units else "", fmt="#,##0")
        set_input(ws.cell(row=row, column=6), is_latest)
        set_input(ws.cell(row=row, column=7), notes)
        row += 1
    print(f"  Supplier Prices: added 3 new rows (megadeco/LF/$48, margarita-ocre-LF/$102, margarita-mufasa-LF/$102)")


# ============================================================
# 4. MATERIALS — append 2 new SKUs, fix megadeco Preferred Supplier, update Pack Price formula
# ============================================================
def update_materials(wb):
    ws = wb["Materials"]

    # Find first empty row
    row = 5
    while ws.cell(row=row, column=1).value:
        row += 1
    new_rows_start = row

    # 2 new SKU rows
    # SKU, Name, Category, Unit, Unit Cost (formula), Supplier, Stock (formula), Reorder, Reorder Qty,
    # Stock Value (formula), Status (formula), Pack Price (formula), Units per Pack (blank for now),
    # Colors, Photo, Notes, Type, Preferred Supplier
    new_materials = [
        {
            "sku": "FLR-MARGARITA-OCRE-LF",
            "name": "MARGARITA OCRE",
            "category": "Flower",
            "colors": "Orange, Ocre",
            "notes": "New SKU added in v1.1 — orange/ocre color variant of FLR-MARGARITA. First purchased from LA FINCA on 2026-10-19 (PO-3002).",
            "preferred_supplier": "LA FINCA",
        },
        {
            "sku": "FLR-MARGARITA-MUFASA-LF",
            "name": "MARGARITA MUFASA (BOTÓN NARANJA)",
            "category": "Flower",
            "colors": "Orange",
            "notes": "New SKU added in v1.1 — botón naranja (mufasa) color variant. First purchased from LA FINCA on 2026-10-19 (PO-3002).",
            "preferred_supplier": "LA FINCA",
        },
    ]

    for m in new_materials:
        r = row
        set_input(ws.cell(row=r, column=1), m["sku"])
        set_input(ws.cell(row=r, column=2), m["name"])
        set_input(ws.cell(row=r, column=3), m["category"])
        # D (Unit) = formula like existing rows
        set_formula(ws.cell(row=r, column=4), f'=IF($A{r}="","",IF($M{r}="","pack","stem"))')
        # E (Unit Cost) = formula
        set_formula(ws.cell(row=r, column=5), f'=IF($A{r}="","",IF($L{r}="","",IF($M{r}="",$L{r},$L{r}/$M{r})))')
        # F (Supplier) — leave blank, will be derived from Preferred Supplier
        set_input(ws.cell(row=r, column=6), "")
        # G (Current Stock) = formula reading from Stock Movements
        set_formula(ws.cell(row=r, column=7), f"=SUMIFS('Stock Movements'!$C:$C,'Stock Movements'!$B:$B,$A{r})", fmt="#,##0")
        # H, I — blank reorder fields (yellow input)
        set_input(ws.cell(row=r, column=8), "", fmt="#,##0")
        set_input(ws.cell(row=r, column=9), "", fmt="#,##0")
        # J (Stock Value) = formula
        set_formula(ws.cell(row=r, column=10), f'=IF($A{r}="","",IFERROR($G{r}*$L{r},0))', fmt='"$"#,##0.00')
        # K (Status) = formula
        set_formula(ws.cell(row=r, column=11), f'=IF($A{r}="","",IF($H{r}="","NOT TRACKED",IF($G{r}<=$H{r},"REORDER","OK")))')
        # L (Pack Price) = NEW formula: filter by Preferred Supplier (col R)
        set_formula(
            ws.cell(row=r, column=12),
            f'=IF(COUNTIFS(\'Supplier Prices\'!$B:$B,$A{r},\'Supplier Prices\'!$C:$C,$R{r},\'Supplier Prices\'!$F:$F,"yes")=0,"",'
            f'SUMIFS(\'Supplier Prices\'!$D:$D,\'Supplier Prices\'!$B:$B,$A{r},\'Supplier Prices\'!$C:$C,$R{r},\'Supplier Prices\'!$F:$F,"yes"))',
            fmt='"$"#,##0.00',
        )
        # M (Units per Pack) — yellow input, blank for now
        set_input(ws.cell(row=r, column=13), "", fmt="#,##0")
        # N (Colors)
        set_input(ws.cell(row=r, column=14), m["colors"])
        # O (Photo)
        set_input(ws.cell(row=r, column=15), "View photos")
        # P (Notes)
        set_input(ws.cell(row=r, column=16), m["notes"])
        # Q (Type)
        set_input(ws.cell(row=r, column=17), "perishable")
        # R (Preferred Supplier)
        set_input(ws.cell(row=r, column=18), m["preferred_supplier"])
        row += 1

    print(f"  Materials: appended 2 new SKU rows at rows {new_rows_start}-{new_rows_start + 1}")

    # Update ALL Materials Pack Price formulas (col L) to filter by Preferred Supplier (col R)
    # Walk every data row that has a SKU
    updated = 0
    for r in range(5, ws.max_row + 1):
        sku = ws.cell(row=r, column=1).value
        if not sku or str(sku).strip() == "":
            continue
        # Skip the new rows we just added — they already have the new formula
        if new_rows_start <= r <= new_rows_start + 1:
            updated += 1
            continue
        # Update existing rows to use the new formula
        cell = ws.cell(row=r, column=12)
        cell.value = (
            f'=IF(COUNTIFS(\'Supplier Prices\'!$B:$B,$A{r},\'Supplier Prices\'!$C:$C,$R{r},\'Supplier Prices\'!$F:$F,"yes")=0,"",'
            f'SUMIFS(\'Supplier Prices\'!$D:$D,\'Supplier Prices\'!$B:$B,$A{r},\'Supplier Prices\'!$C:$C,$R{r},\'Supplier Prices\'!$F:$F,"yes"))'
        )
        updated += 1
    print(f"  Materials: updated Pack Price formula on {updated} rows to use Preferred Supplier (Conflict 5A)")

    # Set megadeco's Preferred Supplier (col R) to blank (Conflict 9c)
    for r in range(5, ws.max_row + 1):
        sku = ws.cell(row=r, column=1).value
        if sku == "PKG-MEGADECO-FLORAL":
            ws.cell(row=r, column=18).value = ""
            # Add a note explaining why
            existing_notes = ws.cell(row=r, column=16).value or ""
            ws.cell(row=r, column=16).value = (
                f"{existing_notes}\n[v1.1] Preferred Supplier left blank per Conflict 9c — both OASIS ($43.07) and LA FINCA ($48) are valid sources. Materials.Pack Price will show empty until you choose one."
            ).strip()
            print(f"  Materials: PKG-MEGADECO-FLORAL Preferred Supplier set to blank (Conflict 9c)")
            break


# ============================================================
# 5. VERSION HISTORY — add v1.1 entry
# ============================================================
def update_version_history(wb):
    ws = wb["Version History"]
    # Find first empty row after row 5
    row = 5
    while ws.cell(row=row, column=1).value:
        row += 1

    v11_summary = (
        "Iterative update from v1 — added a real Purchase Order (PO-3002) and refined the data model based on first use.\n\n"
        "CHANGES:\n"
        "1. Purchase Orders: deleted the PO-3001 example row. Added 6 line items for PO-3002 dated 2026-10-19, supplier LA FINCA, status Received. Items: megadeco ($48), margarita ocre ($102), ruscus ($46), margarita mufasa ($102), eucalipto moneda ($95), cempasuchil bouquet ($85).\n\n"
        "2. Stock Movements: backdated all 153 initial-balance rows from 2026-10-22 to 2026-07-01 (cleaner chronology baseline). Added 6 PO-received rows dated 2026-10-19, ref PO-3002, +1 pack each.\n\n"
        "3. Supplier Prices: data model changed to per-supplier latest (Conflict 5A). Backdated all 148 baseline rows from 2026-10-22 to 2026-07-01. Corrected megadeco baseline supplier from LA FINCA → OASIS (the $43.07 was an OASIS quote, not LA FINCA). Added 3 new rows dated 2026-10-19 with Is Latest = yes (per-supplier): megadeco/LF/$48, margarita-ocre-LF/$102, margarita-mufasa-LF/$102.\n\n"
        "4. Materials: appended 2 new SKU rows (FLR-MARGARITA-OCRE-LF, FLR-MARGARITA-MUFASA-LF) for color-specific daisy variants purchased from LA FINCA. Updated Pack Price formula on every row to filter by Preferred Supplier (col R) instead of just by SKU. Set megadeco Preferred Supplier to blank (Conflict 9c) — Materials.Pack Price for megadeco will show empty until you decide which supplier to use as default.\n\n"
        "5. Recipe Versions: unchanged (stays at 2026-10-01 per Conflict 11b).\n\n"
        "Open issues for next iteration:\n"
        "- Preferred Supplier is set to LA FINCA for all flower/foliage items inherited from v1 (default). Verify each one is actually your preferred supplier.\n"
        "- For materials without a Preferred Supplier (e.g. megadeco), Materials.Pack Price will be empty — set a Preferred Supplier when you decide."
    )
    row_data = [
        "v1.1",
        V11_DATE.strftime("%Y-%m-%d"),
        "Z.ai",
        v11_summary,
        "ERP Zai v1.1.xlsx",
    ]
    for i, v in enumerate(row_data, start=1):
        cell = ws.cell(row=row, column=i)
        cell.value = v
        cell.font = Font(name="Arial", size=10.5, color="FF000000")
        cell.alignment = Alignment(vertical="top", wrap_text=True)
        cell.border = BORDER
    ws.row_dimensions[row].height = 280

    print(f"  Version History: added v1.1 entry at row {row}")


# ============================================================
# MAIN
# ============================================================
def main():
    if not os.path.exists(V1_PATH):
        raise SystemExit(f"v1 file not found: {V1_PATH}")

    print(f"Loading v1: {V1_PATH}")
    wb = load_workbook(V1_PATH)

    print("\n[1/5] Purchase Orders…")
    update_purchase_orders(wb)

    print("[2/5] Stock Movements…")
    update_stock_movements(wb)

    print("[3/5] Supplier Prices…")
    update_supplier_prices(wb)

    print("[4/5] Materials…")
    update_materials(wb)

    print("[5/5] Version History…")
    update_version_history(wb)

    # Set workbook properties
    wb.properties.title = "ERP Zai v1.1"
    wb.properties.description = (
        "Flor by Maria — Floristry ERP v1.1. Iterative update from v1: added PO-3002, "
        "refined supplier-prices data model to per-supplier latest (Conflict 5A), "
        "added 2 new color-specific margarita SKUs."
    )

    print(f"\nSaving v1.1: {OUT_PATH}")
    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    wb.save(OUT_PATH)

    print("\nFinal sheet list:")
    final_wb = load_workbook(OUT_PATH)
    for i, name in enumerate(final_wb.sheetnames, start=1):
        ws = final_wb[name]
        print(f"  {i:2d}. {name:25s} ({ws.max_row} rows × {ws.max_column} cols)")

    print("\nDone. v1 left untouched at /home/z/my-project/download/ERP Zai v1.xlsx")


if __name__ == "__main__":
    main()
