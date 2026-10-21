"""
Fix ERP Zai v1.1 in place — correct Conflict 12 (megadeco per-piece vs per-pack).

Two changes:
  1. Supplier Prices: change LA FINCA megadeco row's Units per Pack from 15 → 1
  2. Materials: change Units per Pack (col M) from manual input to a FORMULA that reads
     from Supplier Prices based on Preferred Supplier (same pattern as Pack Price col L).
     This way, switching Preferred Supplier updates both Pack Price AND Units per Pack
     consistently, and Unit Cost (col E) always reflects the right per-unit cost.

  3. Update v1.1 Version History entry to note the corrective fix.

Source / Output: /home/z/my-project/download/ERP Zai v1.1.xlsx (modified in place)
"""

from datetime import datetime
from openpyxl import load_workbook
from openpyxl.styles import Font, PatternFill, Border, Side, Alignment
import os

V11_PATH = "/home/z/my-project/download/ERP Zai v1.1.xlsx"

# Styles (matching v1/v1.1)
INPUT_FILL = PatternFill(fill_type="solid", fgColor="FFFFFF00")
INPUT_FONT = Font(name="Arial", size=11, color="FF0000FF")
FORMULA_FONT = Font(name="Arial", size=10.5, color="FF000000")
THIN = Side(border_style="thin", color="FF000000")
BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)


def set_formula(cell, formula, fmt="General"):
    cell.value = formula
    cell.font = FORMULA_FONT
    cell.border = BORDER
    cell.number_format = fmt


def fix_supplier_prices_megadeco(wb):
    """Change LA FINCA megadeco row's Units per Pack from 15 → 1."""
    ws = wb["Supplier Prices"]
    fixed = False
    for r in range(5, ws.max_row + 1):
        sku = ws.cell(row=r, column=2).value
        supplier = ws.cell(row=r, column=3).value
        date = ws.cell(row=r, column=1).value
        if (
            sku == "PKG-MEGADECO-FLORAL"
            and supplier == "LA FINCA"
            and date
            and str(date).startswith("2026-10-19")
        ):
            old_val = ws.cell(row=r, column=5).value
            ws.cell(row=r, column=5).value = 1
            # Update notes
            existing_notes = ws.cell(row=r, column=7).value or ""
            ws.cell(row=r, column=7).value = (
                "Purchased at LA FINCA — Conflict 5A: per-supplier latest. "
                "Conflict 12 fix: LA FINCA sells per PIECE (Units per Pack = 1), "
                "OASIS sells per PACK of 15 (Units per Pack = 15). Original v1.1 "
                "build incorrectly had Units per Pack = 15 for LA FINCA. Corrected."
            )
            print(f"  Supplier Prices row {r}: megadeco/LA FINCA Units per Pack {old_val} → 1")
            fixed = True
            break
    if not fixed:
        print("  WARNING: did not find megadeco/LA FINCA row to fix")
    return fixed


def update_materials_units_per_pack_formula(wb):
    """Change Materials.M (Units per Pack) from manual input to a formula reading
    from Supplier Prices based on Preferred Supplier (same pattern as col L).
    """
    ws = wb["Materials"]
    updated = 0
    for r in range(5, ws.max_row + 1):
        sku = ws.cell(row=r, column=1).value
        if not sku or str(sku).strip() == "":
            continue
        # New formula: look up units_per_pack from Supplier Prices
        # where SKU matches AND Supplier matches Preferred Supplier (col R) AND Is Latest = "yes"
        # Fallback to most recent (any supplier) if no Preferred Supplier match —
        # we use MAXIFS-like logic by checking if Preferred Supplier match exists, then falling back.
        # Simpler: just look up by (sku, preferred_supplier, is_latest=yes); if blank, return "".
        # The user can manually set Preferred Supplier if they want a value.
        formula = (
            f'=IF(COUNTIFS(\'Supplier Prices\'!$B:$B,$A{r},\'Supplier Prices\'!$C:$C,$R{r},\'Supplier Prices\'!$F:$F,"yes")=0,'
            f'IF(COUNTIFS(\'Supplier Prices\'!$B:$B,$A{r},\'Supplier Prices\'!$F:$F,"yes")=0,"",'
            f'INDEX(\'Supplier Prices\'!$E:$E,MATCH(1,(\'Supplier Prices\'!$B:$B=$A{r})*(\'Supplier Prices\'!$F:$F="yes"),0))),'
            f'SUMIFS(\'Supplier Prices\'!$E:$E,\'Supplier Prices\'!$B:$B,$A{r},\'Supplier Prices\'!$C:$C,$R{r},\'Supplier Prices\'!$F:$F,"yes"))'
        )
        # The INDEX/MATCH array formula above may not work in all spreadsheets without Ctrl+Shift+Enter.
        # Use a simpler approach: if no preferred supplier match, return "" (force user to pick).
        # This is consistent with how Pack Price works.
        formula = (
            f'=IF($R{r}="","",'
            f'IF(COUNTIFS(\'Supplier Prices\'!$B:$B,$A{r},\'Supplier Prices\'!$C:$C,$R{r},\'Supplier Prices\'!$F:$F,"yes")=0,"",'
            f'SUMIFS(\'Supplier Prices\'!$E:$E,\'Supplier Prices\'!$B:$B,$A{r},\'Supplier Prices\'!$C:$C,$R{r},\'Supplier Prices\'!$F:$F,"yes")))'
        )
        cell = ws.cell(row=r, column=13)  # col M
        cell.value = formula
        cell.font = FORMULA_FONT
        # Remove yellow fill — formula cells have no fill
        cell.fill = PatternFill(fill_type=None)
        cell.border = BORDER
        cell.number_format = "#,##0"
        updated += 1
    print(f"  Materials: updated Units per Pack (col M) to formula on {updated} rows")


def update_version_history(wb):
    """Append a note to the v1.1 entry about the corrective fix."""
    ws = wb["Version History"]
    for r in range(5, ws.max_row + 1):
        v = ws.cell(row=r, column=1).value
        if v == "v1.1":
            existing_summary = ws.cell(row=r, column=4).value or ""
            fix_note = (
                "\n\n--- CORRECTIVE FIX (same v1.1, applied after initial build) ---\n"
                "Conflict 12 resolution: megadeco (PKG-MEGADECO-FLORAL) — LA FINCA sells "
                "per PIECE ($48/piece, Units per Pack = 1), OASIS sells per PACK of 15 pieces "
                "($646/pack, Units per Pack = 15). Original v1.1 build incorrectly set LA FINCA's "
                "Units per Pack = 15. Fixed in place.\n\n"
                "Structural fix: Materials.M (Units per Pack) converted from manual input to "
                "formula reading from Supplier Prices based on Preferred Supplier — matches how "
                "Pack Price (col L) already works. This ensures Unit Cost (col E) always computes "
                "the correct per-piece cost regardless of which supplier is preferred.\n"
                "Note: when Preferred Supplier (col R) is blank, Units per Pack shows blank — "
                "forcing the user to choose a supplier (consistent with Conflict 9c intent)."
            )
            ws.cell(row=r, column=4).value = existing_summary + fix_note
            # Increase row height to fit the longer summary
            ws.row_dimensions[r].height = 380
            print(f"  Version History: appended corrective fix note to v1.1 entry (row {r})")
            break


def main():
    if not os.path.exists(V11_PATH):
        raise SystemExit(f"v1.1 file not found: {V11_PATH}")

    print(f"Loading v1.1: {V11_PATH}")
    wb = load_workbook(V11_PATH)

    print("\n[1/3] Fixing megadeco LA FINCA Supplier Prices row…")
    fix_supplier_prices_megadeco(wb)

    print("\n[2/3] Updating Materials Units per Pack (col M) to formula…")
    update_materials_units_per_pack_formula(wb)

    print("\n[3/3] Updating Version History with corrective fix note…")
    update_version_history(wb)

    print(f"\nSaving fixed v1.1: {V11_PATH}")
    wb.save(V11_PATH)
    print("Done.")


if __name__ == "__main__":
    main()
