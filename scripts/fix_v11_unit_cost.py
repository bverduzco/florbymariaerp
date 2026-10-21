"""
Fix regression in v1.1: Materials.E (Unit Cost) formula doesn't handle M=0.

Background: After the Conflict 12 fix, Materials.M (Units per Pack) became a formula
that returns 0 (not "") when the Supplier Prices row has empty units_per_pack. The
existing Materials.E formula `IF($M5="",$L5,$L5/$M5)` only handles M="" but not M=0,
so it tries to divide by 0 and propagates #DIV/0! errors through Recipes and Products.

Fix: Update Materials.E to use IFERROR, which catches both #DIV/0! and #VALUE! errors.
New formula: =IF($A5="","",IF($L5="","",IFERROR($L5/$M5,$L5)))

This is applied to every data row in the Materials tab.
"""

from openpyxl import load_workbook
from openpyxl.styles import Font, PatternFill, Border, Side
import os

V11_PATH = "/home/z/my-project/download/ERP Zai v1.1.xlsx"

FORMULA_FONT = Font(name="Arial", size=10.5, color="FF000000")
THIN = Side(border_style="thin", color="FF000000")
BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)


def fix_unit_cost_formula(wb):
    """Update Materials.E (Unit Cost) formula to use IFERROR instead of IF($M5="",$L5,$L5/$M5).
    New formula handles both M="" and M=0 cases robustly."""
    ws = wb["Materials"]
    updated = 0
    for r in range(5, ws.max_row + 1):
        sku = ws.cell(row=r, column=1).value
        if not sku or str(sku).strip() == "":
            continue
        cell = ws.cell(row=r, column=5)  # col E
        cell.value = f'=IF($A{r}="","",IF($L{r}="","",IFERROR($L{r}/$M{r},$L{r})))'
        cell.font = FORMULA_FONT
        cell.fill = PatternFill(fill_type=None)
        cell.border = BORDER
        cell.number_format = '"$"#,##0.00'
        updated += 1
    print(f"  Materials: updated Unit Cost (col E) formula on {updated} rows to use IFERROR")


def main():
    if not os.path.exists(V11_PATH):
        raise SystemExit(f"v1.1 file not found: {V11_PATH}")

    print(f"Loading v1.1: {V11_PATH}")
    wb = load_workbook(V11_PATH)

    print("\n[1/1] Fixing Materials.E (Unit Cost) formula…")
    fix_unit_cost_formula(wb)

    print(f"\nSaving fixed v1.1: {V11_PATH}")
    wb.save(V11_PATH)
    print("Done.")


if __name__ == "__main__":
    main()
