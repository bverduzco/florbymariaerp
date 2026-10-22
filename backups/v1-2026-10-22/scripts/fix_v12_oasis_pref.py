"""
Quick fix: set PKG-OASIS-LADRILLO-STD Preferred Supplier = 'LA FINCA' (per Conflict 42c).
The original SKU (PKG-ESPUMA-FLORAL) had Preferred Supplier = 'OASIS' which carried over
when we consolidated. Per Conflict 42c, default Preferred Supplier for everything should be LA FINCA.
"""

from openpyxl import load_workbook
from openpyxl.styles import Font, PatternFill, Border, Side
import os

V12_PATH = "/home/z/my-project/download/ERP Zai v1.2.xlsx"

INPUT_FONT = Font(name="Arial", size=11, color="FF0000FF")
INPUT_FILL = PatternFill(fill_type="solid", fgColor="FFFFFF00")
THIN = Side(border_style="thin", color="FF000000")
BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)


def main():
    if not os.path.exists(V12_PATH):
        raise SystemExit(f"v1.2 file not found: {V12_PATH}")

    print(f"Loading v1.2: {V12_PATH}")
    wb = load_workbook(V12_PATH)

    ws = wb["Materials"]
    fixed = False
    for r in range(5, ws.max_row + 1):
        sku = ws.cell(row=r, column=1).value
        if sku == "PKG-OASIS-LADRILLO-STD":
            old_val = ws.cell(row=r, column=18).value
            cell = ws.cell(row=r, column=18)
            cell.value = "LA FINCA"
            cell.font = INPUT_FONT
            cell.fill = INPUT_FILL
            cell.border = BORDER
            # Also update col F (legacy Supplier column) for consistency
            ws.cell(row=r, column=6).value = "LA FINCA"
            print(f"  Materials row {r}: PKG-OASIS-LADRILLO-STD Preferred Supplier {old_val!r} → 'LA FINCA' (per Conflict 42c)")
            fixed = True
            break

    if not fixed:
        print("  WARNING: PKG-OASIS-LADRILLO-STD row not found")

    print(f"\nSaving fixed v1.2: {V12_PATH}")
    wb.save(V12_PATH)
    print("Done.")


if __name__ == "__main__":
    main()
