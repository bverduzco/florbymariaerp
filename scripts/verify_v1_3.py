"""Spot-check v1.3 output — verify new columns + new sheets look correct."""
from openpyxl import load_workbook
from openpyxl.utils import get_column_letter

wb = load_workbook("/home/z/my-project/data/ERP Zai v1.3.xlsx", data_only=False)

print("=" * 70)
print("1. Verify new columns on existing sheets (header at row 4 + description in comment)")
print("=" * 70)

NEW_COLS_TO_CHECK = [
    ("Materials", "S"),        # Estimated Lifetime (days)
    ("Customers", "M"),        # External ID
    ("Orders", "O"),           # Source Order ID
    ("Orders", "P"),           # Source Status
    ("Orders", "Q"),           # Legacy Line Key
    ("Orders", "R"),           # Source Row Key
    ("Events", "N"),           # Source Event ID
    ("Events", "O"),           # Source Status
    ("Event Line Items", "I"), # Profit
    ("Event Line Items", "J"), # Legacy Line Key
    ("Event Line Items", "K"), # Source Row Key
    ("Recipes", "N"),          # Source Row Key
    ("Purchase Orders", "K"),  # Source Status
    ("Purchase Orders", "L"),  # Legacy Line Key
    ("Purchase Orders", "M"),  # Source Row Key
    ("Stock Movements", "G"), # Source Row Key
    ("Supplier Prices", "H"), # Source Row Key
    ("Recipe Versions", "F"),  # Source Row Key
]

for sheet_name, col_letter in NEW_COLS_TO_CHECK:
    ws = wb[sheet_name]
    cell = ws[f"{col_letter}4"]
    fill = cell.fill.start_color.rgb if cell.fill and cell.fill.start_color else "none"
    comment_text = cell.comment.text[:80] + "..." if cell.comment else "(no comment)"
    print(f"  {sheet_name:25s} {col_letter}4 = {str(cell.value):40s} fill={fill} comment={comment_text}")

print()
print("=" * 70)
print("2. Verify formulas on Materials sheet still resolve (sample)")
print("=" * 70)

ws = wb["Materials"]
# Check first 3 formulas from row 5
for col_idx in range(4, 14):  # cols D through M
    cell = ws.cell(row=5, column=col_idx)
    if cell.value and isinstance(cell.value, str) and cell.value.startswith("="):
        col_letter = get_column_letter(col_idx)
        formula_preview = str(cell.value)[:80] + "..." if len(str(cell.value)) > 80 else str(cell.value)
        print(f"  {col_letter}5 = {formula_preview}")

print()
print("=" * 70)
print("3. Verify new sheets structure")
print("=" * 70)

for sheet_name in ["Material Availability", "Material Substitution", "Workbook Settings", "Workbook Version History"]:
    ws = wb[sheet_name]
    print(f"\n  --- {sheet_name} ---")
    # Row 1 = title
    print(f"    Row 1 (title): A1 = {ws['A1'].value!r}")
    # Row 2 = description
    print(f"    Row 2 (desc):  A2 = {(ws['A2'].value or '')[:70]!r}...")
    # Row 4 = headers
    headers = []
    for col_idx in range(1, ws.max_column + 1):
        v = ws.cell(row=4, column=col_idx).value
        if v: headers.append(f"{get_column_letter(col_idx)}={v}")
    print(f"    Row 4 (headers): {' | '.join(headers)}")
    # Row 5 = sample row 1
    samples = []
    for col_idx in range(1, ws.max_column + 1):
        v = ws.cell(row=5, column=col_idx).value
        if v is not None: samples.append(f"{get_column_letter(col_idx)}={v!r}")
    print(f"    Row 5 (sample 1): {' | '.join(samples)}")

print()
print("=" * 70)
print("4. Verify v1.3 Schema Changes sheet")
print("=" * 70)
ws = wb["v1.3 Schema Changes"]
print(f"  Title: A1 = {ws['A1'].value!r}")
print(f"  Desc (truncated): A2 = {(ws['A2'].value or '')[:120]!r}...")
print(f"  Headers row 4: A4={ws['A4'].value!r} B4={ws['B4'].value!r} C4={ws['C4'].value!r} D4={ws['D4'].value!r} E4={ws['E4'].value!r}")
print(f"  First data row 5: A5={ws['A5'].value!r} B5={ws['B5'].value!r} C5={ws['C5'].value!r}")
print(f"  Total rows: {ws.max_row} (= {ws.max_row - 4} changelog entries)")

print()
print("=" * 70)
print("5. Verify Version History has v1.3 row")
print("=" * 70)
ws = wb["Version History"]
print(f"  Last 2 rows:")
for r in range(max(1, ws.max_row - 1), ws.max_row + 1):
    vals = [ws.cell(row=r, column=c).value for c in range(1, 6)]
    print(f"    Row {r}: {vals}")
