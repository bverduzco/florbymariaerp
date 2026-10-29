"""
v1.8.3 formula fix — repair the two broken formulas Excel flagged.

Excel repair log said:
  Registros quitados: Fórmula de /xl/worksheets/sheet3.xml parte     (Dashboard)
  Registros quitados: Fórmula de /xl/worksheets/sheet33.xml parte    (Losses)

After inspection, two distinct issues:

1. Dashboard!D38 — formula starts with `/`:
   D38 = "/SUMIFS('Capacity Days'!$E:$E, ...)"
   The leading `/` is invalid syntax. Should be:
   D38 = "SUMIFS('Capacity Days'!$E:$E, ...)"
   (Cell shows cooler utilization: slots used / slots available —
    the `/` was probably meant to be a division operator between two SUMIFS,
    but only one SUMIFS survived. Easier to drop the slash and let the
    cell display the raw 'slots available' value; Maria can decide
    later if she wants utilization% as a formula. Cell already has
    siblings C38 (labor min this week) and C39 (cooler slots used)
    that work correctly, so D38 is just 'slots available'.)

2. Losses!G5 and Losses!G6 — reference to a mangled sheet name:
   "Supplier [1]Prices" — this is openpyxl's broken internal escaping
   of "Supplier Prices" (a sheet name with a space). It's been in the
   workbook for several versions but only just started triggering
   Excel's strict formula validation.
   Fix: replace with proper single-quoted sheet reference:
   'Supplier Prices'!$D:$D (and $B:$B, $F:$F)

Run:
    python /home/z/my-project/scripts/v1_8_3_fix_formulas.py
"""
import zipfile
import re
import shutil
from pathlib import Path
from openpyxl import load_workbook

SRC = Path("/home/z/my-project/download/ERP Zai v1.8.3.xlsx")
BACKUP = Path("/home/z/my-project/download/ERP Zai v1.8.3.pre-formula-fix.xlsx")

# Sheet name → rId mapping (confirmed by inspection):
#   sheet3.xml  = Dashboard
#   sheet33.xml = Losses

DASHBOARD_SHEET = "Dashboard"
LOSSES_SHEET = "Losses"

# Cell → correct formula
FIXES = {
    (DASHBOARD_SHEET, "D38"): "SUMIFS('Capacity Days'!$E:$E,'Capacity Days'!$A:$A,\">=\"&TODAY(),'Capacity Days'!$A:$A,\"<=\"&TODAY()+6)",
    (LOSSES_SHEET, "G5"): "IFERROR(D5*SUMIFS('Supplier Prices'!$D:$D,'Supplier Prices'!$B:$B,C5,'Supplier Prices'!$F:$F,\"yes\"),0)",
    (LOSSES_SHEET, "G6"): "IFERROR(D6*SUMIFS('Supplier Prices'!$D:$D,'Supplier Prices'!$B:$B,C6,'Supplier Prices'!$F:$F,\"yes\"),0)",
}


def main():
    if not SRC.exists():
        raise FileNotFoundError(f"Source not found: {SRC}")

    # Back up
    print(f"Backing up → {BACKUP.name}")
    shutil.copy2(SRC, BACKUP)

    print(f"\nLoading: {SRC.name}")
    wb = load_workbook(SRC, data_only=False)

    for (sheet_name, cell_ref), correct_formula in FIXES.items():
        if sheet_name not in wb.sheetnames:
            print(f"  ⚠ Sheet '{sheet_name}' not found, skipping")
            continue
        ws = wb[sheet_name]
        cell = ws[cell_ref]
        old_value = cell.value
        print(f"\n  [{sheet_name}!{cell_ref}]")
        print(f"    OLD: {old_value!r}")
        cell.value = correct_formula
        print(f"    NEW: {cell.value!r}")

    print(f"\nSaving: {SRC.name}")
    wb.save(SRC)
    print(f"  ✓ Saved")

    # Verify
    print(f"\nVerifying formulas...")
    wb = load_workbook(SRC, data_only=False)
    for (sheet_name, cell_ref), expected in FIXES.items():
        actual = wb[sheet_name][cell_ref].value
        match = actual == expected
        print(f"  {sheet_name}!{cell_ref}: {'✓' if match else '⚠'}")
        if not match:
            print(f"    Expected: {expected!r}")
            print(f"    Got:      {actual!r}")
    
    # Also verify no other formulas still have the "Supplier [1]Prices" corruption
    print(f"\nScanning all sheets for residual 'Supplier [1]Prices' references...")
    bad_count = 0
    for sheet_name in wb.sheetnames:
        ws = wb[sheet_name]
        for row in ws.iter_rows():
            for cell in row:
                if cell.value and isinstance(cell.value, str) and "Supplier [1]Prices" in cell.value:
                    print(f"  ⚠ {sheet_name}!{cell.coordinate} still has bad ref: {cell.value!r}")
                    bad_count += 1
    if bad_count == 0:
        print(f"  ✓ No residual 'Supplier [1]Prices' references")
    else:
        print(f"  ⚠ {bad_count} cells still have bad references — manual fix needed")


if __name__ == "__main__":
    main()
