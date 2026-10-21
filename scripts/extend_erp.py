"""
Extend the Floristry ERP Excel file with:
  - 2 new suppliers (BDF Palacio Floral SA de CV, PRO Flor)
  - 5 new tabs: Version History, Stock Movements, Supplier Prices, Tools & Equipment, Recipe Versions
  - Materials tab: add Type + Preferred Supplier columns, convert Current Stock & Pack Price to formulas
  - Recipes tab: add Version + Effective From columns, stamp existing as v1 effective 2026-10-01
  - README: add explanations of new tabs

Output: /home/z/my-project/download/ERP Zai v1.xlsx
Also copies to /home/z/my-project/upload/Floristry_ERP updated b.xlsx so the prototype app picks it up.
"""

from copy import copy
from datetime import datetime
from openpyxl import load_workbook
from openpyxl.styles import Font, PatternFill, Border, Side, Alignment
from openpyxl.utils import get_column_letter
import json
import os

SRC = "/home/z/my-project/upload/Floristry_ERP updated b.xlsx"
OUT_DIR = "/home/z/my-project/download"
OUT_PATH = os.path.join(OUT_DIR, "ERP Zai v1.xlsx")
APP_PATH = "/home/z/my-project/upload/Floristry_ERP updated b.xlsx"
SEED_JSON = "/home/z/my-project/src/data/seed.json"

TODAY = datetime(2026, 10, 22)
EFFECTIVE_DATE = datetime(2026, 10, 1)  # Backdate recipes to start of month

# Existing style tokens (matched from inspect)
HEADER_FILL = PatternFill(fill_type="solid", fgColor="FF2F5233")
HEADER_FONT = Font(name="Arial", size=10.5, bold=True, color="FFFFFFFF")
HEADER_ALIGN = Alignment(horizontal="center", vertical="center", wrap_text=True)

INPUT_FILL = PatternFill(fill_type="solid", fgColor="FFFFFF00")
INPUT_FONT_TEXT = Font(name="Arial", size=11, color="FF0000FF")  # blue text on yellow
INPUT_FONT_NUM = Font(name="Arial", size=11, color="FF0000FF")
INPUT_FONT_MONEY = Font(name="Arial", size=11, color="FF0000FF")

FORMULA_FONT = Font(name="Arial", size=10.5, color="FF000000")  # black, no fill

THIN = Side(border_style="thin", color="FF000000")
BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)

TITLE_FONT = Font(name="Arial", size=14, bold=True, color="FF1F3B4D")
SUBTITLE_FONT = Font(name="Arial", size=10, italic=True, color="FF6B8E6B")
SECTION_FONT = Font(name="Arial", size=11, bold=True, color="FF1F3B4D")


def set_header(cell, value):
    cell.value = value
    cell.font = HEADER_FONT
    cell.fill = HEADER_FILL
    cell.alignment = HEADER_ALIGN
    cell.border = BORDER


def set_input(cell, value, fmt="General"):
    cell.value = value
    cell.font = INPUT_FONT_TEXT
    cell.fill = INPUT_FILL
    cell.border = BORDER
    cell.number_format = fmt


def set_formula(cell, formula, fmt="General"):
    cell.value = formula
    cell.font = FORMULA_FONT
    cell.border = BORDER
    cell.number_format = fmt


def add_version_history(wb):
    """First tab: Version History."""
    ws = wb.create_sheet("Version History", 0)  # insert at position 0
    ws.column_dimensions["A"].width = 10
    ws.column_dimensions["B"].width = 14
    ws.column_dimensions["C"].width = 16
    ws.column_dimensions["D"].width = 80
    ws.column_dimensions["E"].width = 30

    ws["B2"] = "ERP Zai — Version History"
    ws["B2"].font = TITLE_FONT
    ws["B3"] = "Each version of this workbook is logged here. Save new versions as 'ERP Zai vN.xlsx'."
    ws["B3"].font = SUBTITLE_FONT

    headers = ["Version", "Date", "Author", "Summary of changes", "File name"]
    for i, h in enumerate(headers, start=1):
        set_header(ws.cell(row=5, column=i), h)

    v1_summary = (
        "Initial structure extended from Floristry_ERP updated b.xlsx.\n"
        "Added tabs: Version History (this tab), Stock Movements, Supplier Prices, Tools & Equipment, Recipe Versions.\n"
        "Added suppliers: BDF Palacio Floral SA de CV, PRO Flor.\n"
        "Materials tab: added Type and Preferred Supplier columns; converted Current Stock and Pack Price to formulas (read from Stock Movements and Supplier Prices tabs).\n"
        "Recipes tab: added Version (col L) and Effective From (col M); all existing recipes stamped v1 effective 2026-10-01.\n"
        "Stock Movements seeded with one 'initial balance' row per material (0 packs) — overwrite with actual counts at first stocktake.\n"
        "Supplier Prices seeded with today's prices as the baseline quote for each material that has a pack price."
    )
    row = [
        "v1",
        TODAY.strftime("%Y-%m-%d"),
        "Z.ai",
        v1_summary,
        "ERP Zai v1.xlsx",
    ]
    for i, v in enumerate(row, start=1):
        cell = ws.cell(row=6, column=i)
        cell.value = v
        cell.font = Font(name="Arial", size=10.5, color="FF000000")
        cell.alignment = Alignment(vertical="top", wrap_text=True)
        cell.border = BORDER
    ws.row_dimensions[6].height = 130


def add_stock_movements(wb, materials):
    """Ledger for all stock in/out events."""
    ws = wb.create_sheet("Stock Movements")
    ws.column_dimensions["A"].width = 12
    ws.column_dimensions["B"].width = 18
    ws.column_dimensions["C"].width = 10
    ws.column_dimensions["D"].width = 22
    ws.column_dimensions["E"].width = 16
    ws.column_dimensions["F"].width = 50

    ws["A1"] = "Stock Movements"
    ws["A1"].font = TITLE_FONT
    ws["A2"] = (
        "Append-only ledger of every stock in/out event. NEVER edit a past row — add a new row instead.\n"
        "Packs column is SIGNED: use +N for receipts, -N for shipments/waste. "
        "Materials tab > Current Stock reads from here automatically."
    )
    ws["A2"].font = SUBTITLE_FONT
    ws["A2"].alignment = Alignment(wrap_text=True, vertical="top")
    ws.row_dimensions[2].height = 30

    headers = ["Date", "Material SKU", "Packs", "Reason", "Reference", "Notes"]
    for i, h in enumerate(headers, start=1):
        set_header(ws.cell(row=4, column=i), h)

    ws.freeze_panes = "A5"

    # Seed: one 'initial balance' row per material dated today, 0 packs
    row = 5
    for m in materials:
        set_input(ws.cell(row=row, column=1), TODAY.strftime("%Y-%m-%d"), fmt="yyyy-mm-dd")
        set_input(ws.cell(row=row, column=2), m["sku"])
        set_input(ws.cell(row=row, column=3), 0, fmt="#,##0")
        set_input(ws.cell(row=row, column=4), "Initial balance")
        set_input(ws.cell(row=row, column=5), "")
        set_input(
            ws.cell(row=row, column=6),
            "Initial stock placeholder — overwrite with actual count at first stocktake.",
        )
        row += 1


def add_supplier_prices(wb, materials):
    """Historical price log per material per supplier."""
    ws = wb.create_sheet("Supplier Prices")
    ws.column_dimensions["A"].width = 12
    ws.column_dimensions["B"].width = 18
    ws.column_dimensions["C"].width = 26
    ws.column_dimensions["D"].width = 14
    ws.column_dimensions["E"].width = 14
    ws.column_dimensions["F"].width = 10
    ws.column_dimensions["G"].width = 50

    ws["A1"] = "Supplier Prices"
    ws["A1"].font = TITLE_FONT
    ws["A2"] = (
        "Every price quote, ever. Add a new row when you get a new quote (don't edit old rows).\n"
        "Mark only the LATEST row for each material as 'yes' in the Is Latest column. "
        "Materials tab > Pack Price reads from here automatically."
    )
    ws["A2"].font = SUBTITLE_FONT
    ws["A2"].alignment = Alignment(wrap_text=True, vertical="top")
    ws.row_dimensions[2].height = 30

    headers = ["Date", "Material SKU", "Supplier", "Pack Price (MXN)", "Units per Pack", "Is Latest", "Notes"]
    for i, h in enumerate(headers, start=1):
        set_header(ws.cell(row=4, column=i), h)

    ws.freeze_panes = "A5"

    # Seed: one row per material with a packPrice
    row = 5
    seeded = 0
    for m in materials:
        pack_price = m.get("packPrice")
        if pack_price is None or pack_price == 0:
            continue
        set_input(ws.cell(row=row, column=1), TODAY.strftime("%Y-%m-%d"), fmt="yyyy-mm-dd")
        set_input(ws.cell(row=row, column=2), m["sku"])
        set_input(ws.cell(row=row, column=3), m.get("supplier") or "LA FINCA")
        set_input(ws.cell(row=row, column=4), pack_price, fmt='"$"#,##0.00')
        units_per_pack = m.get("unitsPerPack")
        set_input(ws.cell(row=row, column=5), units_per_pack if units_per_pack else "", fmt="#,##0")
        set_input(ws.cell(row=row, column=6), "yes")
        set_input(ws.cell(row=row, column=7), "Baseline from Oct 2026 LA FINCA list (seeded by Z.ai).")
        row += 1
        seeded += 1

    print(f"  Supplier Prices: seeded {seeded} baseline rows")


def add_tools_equipment(wb):
    """Durable tools + equipment inventory."""
    ws = wb.create_sheet("Tools & Equipment")
    widths = [22, 30, 16, 8, 16, 18, 14, 26, 14, 14, 40]
    for i, w in enumerate(widths, start=1):
        ws.column_dimensions[get_column_letter(i)].width = w

    ws["A1"] = "Tools & Equipment"
    ws["A1"].font = TITLE_FONT
    ws["A2"] = (
        "Durable items you reuse: scissors, buckets, vases, knives, ribbon spools, cool-room shelves, etc.\n"
        "These are NOT in recipes and NOT in the shopping list. Track them here separately.\n"
        "Use SKU prefixes: TOOL- (durable tools), HARD- (consumable hardgoods like wire, tape)."
    )
    ws["A2"].font = SUBTITLE_FONT
    ws["A2"].alignment = Alignment(wrap_text=True, vertical="top")
    ws.row_dimensions[2].height = 45

    headers = [
        "SKU",
        "Item Name",
        "Category",
        "Qty",
        "Condition",
        "Location",
        "Date Purchased",
        "Purchased From",
        "Purchase Cost (MXN)",
        "Last Serviced",
        "Notes",
    ]
    for i, h in enumerate(headers, start=1):
        set_header(ws.cell(row=4, column=i), h)

    ws.freeze_panes = "A5"

    # Example row (in italics, gray fill to mark as example)
    example = [
        "TOOL-TIJERAS-001",
        "Tijeras profesionales",
        "Cutting",
        2,
        "Good",
        "Workshop",
        "2026-09-01",
        "BDF Palacio Floral SA de CV",
        450,
        "2026-10-15",
        "Sharpened in October — replace when blades dull.",
    ]
    for i, v in enumerate(example, start=1):
        cell = ws.cell(row=5, column=i)
        cell.value = v
        cell.font = Font(name="Arial", size=10.5, italic=True, color="FF808080")
        cell.fill = PatternFill(fill_type="solid", fgColor="FFF5F5F5")
        cell.border = BORDER
        if i in (4, 9):
            cell.number_format = "#,##0"
        elif i in (7, 10):
            cell.number_format = "yyyy-mm-dd"
    ws.cell(row=5, column=12).value = "← example row, delete or overwrite"
    ws.cell(row=5, column=12).font = Font(name="Arial", size=9, italic=True, color="FF808080")

    # Empty input rows with styling for the next 30 rows
    for r in range(6, 36):
        for c in range(1, 12):
            cell = ws.cell(row=r, column=c)
            cell.font = INPUT_FONT_TEXT
            cell.fill = INPUT_FILL
            cell.border = BORDER
            if c in (4, 9):
                cell.number_format = "#,##0"
            elif c in (7, 10):
                cell.number_format = "yyyy-mm-dd"


def add_recipe_versions(wb, products):
    """Version log per product."""
    ws = wb.create_sheet("Recipe Versions")
    widths = [18, 10, 14, 14, 70]
    for i, w in enumerate(widths, start=1):
        ws.column_dimensions[get_column_letter(i)].width = w

    ws["A1"] = "Recipe Versions"
    ws["A1"].font = TITLE_FONT
    ws["A2"] = (
        "One row per (product, version). When you change a recipe, bump the version number, "
        "set Effective From = today, mark the new row 'active' and the old one 'superseded'.\n"
        "Recipes tab > Version column should match the active version here."
    )
    ws["A2"].font = SUBTITLE_FONT
    ws["A2"].alignment = Alignment(wrap_text=True, vertical="top")
    ws.row_dimensions[2].height = 45

    headers = ["Product SKU", "Version", "Effective From", "Status", "Notes"]
    for i, h in enumerate(headers, start=1):
        set_header(ws.cell(row=4, column=i), h)

    ws.freeze_panes = "A5"

    # Seed: v1 for each existing product, effective 2026-10-01
    row = 5
    for p in products:
        set_input(ws.cell(row=row, column=1), p["sku"])
        set_input(ws.cell(row=row, column=2), "v1")
        set_input(ws.cell(row=row, column=3), EFFECTIVE_DATE.strftime("%Y-%m-%d"), fmt="yyyy-mm-dd")
        set_input(ws.cell(row=row, column=4), "active")
        set_input(
            ws.cell(row=row, column=5),
            "Original recipe — seeded by Z.ai from Floristry_ERP updated b.xlsx (backdated to start of month).",
        )
        row += 1


def add_suppliers(wb):
    """Append 2 new suppliers to the existing Suppliers tab."""
    ws = wb["Suppliers"]
    # Find first empty row after row 5
    row = 5
    while ws.cell(row=row, column=1).value:
        row += 1
    # Append the new suppliers
    new_suppliers = [
        ("BDF Palacio Floral SA de CV", "", "", "", None, "", "Added 2026-10-22. Fill contact, lead time, payment terms."),
        ("PRO Flor", "", "", "", None, "", "Added 2026-10-22. Fill contact, lead time, payment terms."),
    ]
    for s in new_suppliers:
        for c, val in enumerate(s, start=1):
            cell = ws.cell(row=row, column=c)
            cell.value = val
            cell.font = INPUT_FONT_TEXT
            cell.fill = INPUT_FILL
            cell.border = BORDER
            if c == 5:  # Lead time (days) — number
                cell.number_format = "0"
        row += 1


def modify_materials_tab(wb, materials):
    """Add Type and Preferred Supplier columns; convert Current Stock and Pack Price to formulas."""
    ws = wb["Materials"]

    # 1. Add new header columns Q (Type) and R (Preferred Supplier)
    set_header(ws.cell(row=4, column=17), "Type")  # col Q
    set_header(ws.cell(row=4, column=18), "Preferred Supplier")  # col R
    ws.column_dimensions["Q"].width = 14
    ws.column_dimensions["R"].width = 22

    # 2. For each data row, update formulas and add new column values
    for r in range(5, 5 + len(materials)):
        sku = ws.cell(row=r, column=1).value  # col A
        if not sku:
            continue

        # Convert G (Current Stock) from yellow input → formula
        # =SUMIFS('Stock Movements'!$C:$C, 'Stock Movements'!$B:$B, $A5)
        cell_g = ws.cell(row=r, column=7)
        cell_g.value = f"=SUMIFS('Stock Movements'!$C:$C,'Stock Movements'!$B:$B,$A{r})"
        cell_g.font = FORMULA_FONT
        cell_g.fill = PatternFill(fill_type=None)
        cell_g.border = BORDER
        cell_g.number_format = "#,##0"

        # Convert L (Pack Price) from yellow input → formula reading from Supplier Prices
        # =IF(COUNTIFS('Supplier Prices'!$B:$B,$A5,'Supplier Prices'!$F:$F,"yes")=0,"",SUMIFS('Supplier Prices'!$D:$D,'Supplier Prices'!$B:$B,$A5,'Supplier Prices'!$F:$F,"yes"))
        cell_l = ws.cell(row=r, column=12)
        cell_l.value = (
            f"=IF(COUNTIFS('Supplier Prices'!$B:$B,$A{r},'Supplier Prices'!$F:$F,\"yes\")=0,\"\","
            f"SUMIFS('Supplier Prices'!$D:$D,'Supplier Prices'!$B:$B,$A{r},'Supplier Prices'!$F:$F,\"yes\"))"
        )
        cell_l.font = FORMULA_FONT
        cell_l.fill = PatternFill(fill_type=None)
        cell_l.border = BORDER
        cell_l.number_format = '"$"#,##0.00'

        # Update K (Status) formula — no longer check G5="" since G5 is now a formula
        # =IF($A5="","",IF($H5="","NOT TRACKED",IF($G5<=$H5,"REORDER","OK")))
        cell_k = ws.cell(row=r, column=11)
        cell_k.value = f'=IF($A{r}="","",IF($H{r}="","NOT TRACKED",IF($G{r}<=$H{r},"REORDER","OK")))'

        # Add Q (Type) — manual input, default based on SKU prefix
        sku_str = str(sku)
        if sku_str.startswith("FLR-") or sku_str.startswith("FOL-"):
            default_type = "perishable"
        elif sku_str.startswith("PKG-") or sku_str.startswith("HARD-"):
            default_type = "consumable"
        elif sku_str.startswith("TOOL-"):
            default_type = "tool"
        else:
            default_type = "perishable"
        set_input(ws.cell(row=r, column=17), default_type)

        # Add R (Preferred Supplier) — default to existing Supplier (col F)
        existing_supplier = ws.cell(row=r, column=6).value or ""
        set_input(ws.cell(row=r, column=18), existing_supplier)


def modify_recipes_tab(wb, recipes):
    """Add Version and Effective From columns; stamp existing recipes as v1 effective 2026-10-01."""
    ws = wb["Recipes"]

    # Add headers L (Version) and M (Effective From)
    set_header(ws.cell(row=4, column=12), "Version")  # col L
    set_header(ws.cell(row=4, column=13), "Effective From")  # col M
    ws.column_dimensions["L"].width = 10
    ws.column_dimensions["M"].width = 14

    # Stamp each recipe row with v1 + effective date 2026-10-01
    for r in range(5, 5 + len(recipes)):
        product_sku = ws.cell(row=r, column=1).value
        if not product_sku:
            continue
        set_input(ws.cell(row=r, column=12), "v1")
        set_input(ws.cell(row=r, column=13), EFFECTIVE_DATE.strftime("%Y-%m-%d"), fmt="yyyy-mm-dd")


def modify_readme(wb):
    """Add explanations of the new tabs to the README."""
    ws = wb["README"]
    # Find the last row with content
    row = ws.max_row + 2
    ws.cell(row=row, column=2).value = "NEW TABS ADDED IN ERP ZAI v1 (2026-10-22)"
    ws.cell(row=row, column=2).font = SECTION_FONT
    row += 1
    new_sections = [
        ("Version History", "Logs every version of this workbook. Each new version should add a row."),
        ("Stock Movements", "Append-only ledger of every stock in/out event. Materials > Current Stock reads from here. Packs column is signed (+N for receipts, -N for shipments/waste)."),
        ("Supplier Prices", "Historical log of every price quote per material per supplier. Mark only the latest row 'yes' in the Is Latest column. Materials > Pack Price reads from here."),
        ("Tools & Equipment", "Durable items you reuse (scissors, buckets, vases). NOT in recipes. Track purchase date, purchase location, purchase cost here."),
        ("Recipe Versions", "Version log per product. When you change a recipe, bump the version, set Effective From = today, mark new row 'active' and old one 'superseded'."),
    ]
    for tab_name, desc in new_sections:
        ws.cell(row=row, column=2).value = tab_name
        ws.cell(row=row, column=2).font = Font(name="Arial", size=11, bold=True, color="FF1F3B4D")
        ws.cell(row=row, column=3).value = desc
        ws.cell(row=row, column=3).font = Font(name="Arial", size=10, color="FF000000")
        ws.cell(row=row, column=3).alignment = Alignment(wrap_text=True, vertical="top")
        ws.row_dimensions[row].height = 30
        row += 1

    row += 1
    ws.cell(row=row, column=2).value = "MATERIALS TAB — NEW COLUMNS & FORMULAS"
    ws.cell(row=row, column=2).font = SECTION_FONT
    row += 1
    materials_changes = [
        ("Col Q: Type", "perishable | consumable | tool. Auto-filled based on SKU prefix; overwrite as needed."),
        ("Col R: Preferred Supplier", "Which supplier you buy this material from by default. Used for grouping the shopping list."),
        ("Col G: Current Stock (packs)", "NOW A FORMULA. Reads from Stock Movements tab. Stop typing here — log a movement instead."),
        ("Col L: Pack Price", "NOW A FORMULA. Reads from Supplier Prices tab (latest row marked 'yes'). Stop typing here — add a row to Supplier Prices instead."),
        ("Col K: Status", "Updated formula: shows NOT TRACKED when reorder level is blank, REORDER when stock <= reorder level, OK otherwise."),
    ]
    for label, desc in materials_changes:
        ws.cell(row=row, column=2).value = label
        ws.cell(row=row, column=2).font = Font(name="Arial", size=11, bold=True, color="FF1F3B4D")
        ws.cell(row=row, column=3).value = desc
        ws.cell(row=row, column=3).font = Font(name="Arial", size=10, color="FF000000")
        ws.cell(row=row, column=3).alignment = Alignment(wrap_text=True, vertical="top")
        ws.row_dimensions[row].height = 30
        row += 1

    row += 1
    ws.cell(row=row, column=2).value = "RECIPES TAB — NEW COLUMNS"
    ws.cell(row=row, column=2).font = SECTION_FONT
    row += 1
    recipes_changes = [
        ("Col L: Version", "v1, v2, v3... Matches the active version in Recipe Versions tab."),
        ("Col M: Effective From", "Date this version became active. Existing recipes backdated to 2026-10-01."),
    ]
    for label, desc in recipes_changes:
        ws.cell(row=row, column=2).value = label
        ws.cell(row=row, column=2).font = Font(name="Arial", size=11, bold=True, color="FF1F3B4D")
        ws.cell(row=row, column=3).value = desc
        ws.cell(row=row, column=3).font = Font(name="Arial", size=10, color="FF000000")
        ws.cell(row=row, column=3).alignment = Alignment(wrap_text=True, vertical="top")
        ws.row_dimensions[row].height = 30
        row += 1


def main():
    if not os.path.exists(SRC):
        raise SystemExit(f"Source file not found: {SRC}")

    with open(SEED_JSON, encoding="utf-8") as f:
        seed = json.load(f)

    materials = seed["materials"]
    products = seed["products"]
    recipes = seed["recipes"]

    print(f"Loading: {SRC}")
    wb = load_workbook(SRC)
    print(f"  Original sheets: {wb.sheetnames}")

    # 1. Add new tabs
    print("\n[1/7] Adding Version History tab…")
    add_version_history(wb)

    print("[2/7] Adding Stock Movements tab…")
    add_stock_movements(wb, materials)

    print("[3/7] Adding Supplier Prices tab…")
    add_supplier_prices(wb, materials)

    print("[4/7] Adding Tools & Equipment tab…")
    add_tools_equipment(wb)

    print("[5/7] Adding Recipe Versions tab…")
    add_recipe_versions(wb, products)

    # 2. Modify existing tabs
    print("[6/7] Modifying existing tabs (Suppliers, Materials, Recipes, README)…")
    add_suppliers(wb)
    modify_materials_tab(wb, materials)
    modify_recipes_tab(wb, recipes)
    modify_readme(wb)

    # 3. Set workbook properties
    wb.properties.creator = "Z.ai"
    wb.properties.title = "ERP Zai v1"
    wb.properties.description = "Flor by Maria — Floristry ERP extended with versioning, stock movements, supplier prices, tools & equipment, recipe versions."

    # 4. Save
    print(f"[7/7] Saving to: {OUT_PATH}")
    os.makedirs(OUT_DIR, exist_ok=True)
    wb.save(OUT_PATH)
    print(f"  Also copying to: {APP_PATH}")
    # Copy to upload folder so the prototype app can re-seed from it
    import shutil
    shutil.copy(OUT_PATH, APP_PATH)

    print("\nFinal sheet order:")
    final_wb = load_workbook(OUT_PATH)
    for i, name in enumerate(final_wb.sheetnames, start=1):
        ws = final_wb[name]
        print(f"  {i:2d}. {name:25s} ({ws.max_row} rows × {ws.max_column} cols)")

    print("\nDone.")


if __name__ == "__main__":
    main()
