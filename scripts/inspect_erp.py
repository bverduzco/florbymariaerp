"""Inspect the existing ERP Excel file: structure, styles, formulas."""
from openpyxl import load_workbook
from openpyxl.utils import get_column_letter

SRC = "/home/z/my-project/upload/Floristry_ERP updated b.xlsx"

wb = load_workbook(SRC)
print("=" * 70)
print("EXISTING ERP FILE STRUCTURE")
print("=" * 70)
print(f"Sheet names (in order): {wb.sheetnames}")
print()

for name in wb.sheetnames:
    ws = wb[name]
    print(f"\n--- {name} ---")
    print(f"  Dimensions: {ws.dimensions}  | max_row={ws.max_row}  max_col={ws.max_column}")

# Inspect Materials tab in detail
print("\n" + "=" * 70)
print("MATERIALS TAB — header rows + first data row")
print("=" * 70)
ws = wb["Materials"]
for r in range(1, 5):
    for c in range(1, ws.max_column + 1):
        cell = ws.cell(row=r, column=c)
        if cell.value is not None:
            fill = cell.fill.fgColor.rgb if cell.fill and cell.fill.fgColor else None
            print(f"  R{r} {get_column_letter(c)}{r}: val={cell.value!r:50s} font_color={cell.font.color.rgb if cell.font.color else None} fill={fill}")

# Inspect Materials formulas — what does Status (col K) and Unit Cost (col E) look like?
print("\n--- MATERIALS formulas on row 3 (first data row) ---")
for col_letter in ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P"]:
    cell = ws[f"{col_letter}3"]
    if cell.value is not None:
        print(f"  {col_letter}3: {cell.value!r}")

# Inspect Suppliers tab
print("\n" + "=" * 70)
print("SUPPLIERS TAB")
print("=" * 70)
ws = wb["Suppliers"]
for r in range(1, ws.max_row + 1):
    row_vals = []
    for c in range(1, ws.max_column + 1):
        v = ws.cell(row=r, column=c).value
        if v is not None:
            row_vals.append(f"{get_column_letter(c)}={v!r}")
    if row_vals:
        print(f"  R{r}: {row_vals}")

# Inspect Recipes tab — first 3 data rows
print("\n" + "=" * 70)
print("RECIPES TAB — header + first 3 rows")
print("=" * 70)
ws = wb["Recipes"]
for r in range(1, 5):
    row_vals = []
    for c in range(1, ws.max_column + 1):
        v = ws.cell(row=r, column=c).value
        if v is not None:
            row_vals.append(f"{get_column_letter(c)}={v!r}")
    if row_vals:
        print(f"  R{r}: {row_vals}")

# Inspect README last 5 rows for context
print("\n" + "=" * 70)
print("README TAB — last 5 rows")
print("=" * 70)
ws = wb["README"]
for r in range(max(1, ws.max_row - 5), ws.max_row + 1):
    for c in range(1, ws.max_column + 1):
        v = ws.cell(row=r, column=c).value
        if v is not None:
            print(f"  R{r} {get_column_letter(c)}{r}: {v!r}")
