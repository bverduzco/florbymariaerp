"""Verify v1.4 workbook contents — spot-check all the changes."""
from openpyxl import load_workbook
from openpyxl.utils import get_column_letter

wb = load_workbook("/home/z/my-project/data/ERP Zai v1.4.xlsx", data_only=False)

print("=" * 70)
print("1. Materials sheet — verify 19 new rows added")
print("=" * 70)
ws = wb["Materials"]
new_skus = [
    "PKG-LISTON-D01-20MM", "PKG-LISTON-D03-15MM", "PKG-LISTON-D03-20MM",
    "PKG-LISTON-D03-25MM", "PKG-LISTON-D06-20MM", "PKG-LISTON-D06-25MM",
    "PKG-LISTON-D21-15MM", "PKG-LISTON-D25-25MM", "PKG-LISTON-D28-15MM",
    "PKG-LISTON-D29-20MM", "PKG-LISTON-D30-10MM", "PKG-LISTON-D30-40MM",
    "PKG-LISTON-D31-20MM", "PKG-LISTON-D31-40MM",
    "PKG-WRAP-BUR-60", "PKG-WRAP-GRN-60", "PKG-WRAP-PNK-56",
    "PKG-WRAP-PUR-60", "PKG-WRAP-WHT-56",
]
found_rows = {}
for row_idx in range(5, ws.max_row + 1):
    sku = ws.cell(row=row_idx, column=1).value
    if sku and str(sku) in new_skus:
        found_rows[str(sku)] = row_idx

print(f"  Found {len(found_rows)} of {len(new_skus)} new SKUs")
missing = set(new_skus) - set(found_rows.keys())
if missing:
    print(f"  ❌ Missing: {missing}")
else:
    print(f"  ✓ All 19 new SKUs present")

# Show 2 sample rows with formulas
print("\n  Sample row (PKG-LISTON-D30-40MM, the one bought twice):")
if "PKG-LISTON-D30-40MM" in found_rows:
    r = found_rows["PKG-LISTON-D30-40MM"]
    for col in range(1, 20):
        v = ws.cell(row=r, column=col).value
        if v is not None:
            print(f"    {get_column_letter(col)} = {str(v)[:90]}")

print()
print("=" * 70)
print("2. Stock Movements sheet — verify 20 new rows")
print("=" * 70)
ws = wb["Stock Movements"]
adhoc_count = 0
for row_idx in range(5, ws.max_row + 1):
    reason = ws.cell(row=row_idx, column=4).value
    if reason == "Ad-hoc purchase":
        adhoc_count += 1
        if adhoc_count <= 3:  # show first 3
            print(f"  Row {row_idx}: date={ws.cell(row=row_idx, column=1).value}, "
                  f"sku={ws.cell(row=row_idx, column=2).value}, "
                  f"packs={ws.cell(row=row_idx, column=3).value}, "
                  f"ref={ws.cell(row=row_idx, column=5).value}")
print(f"  ... total ad-hoc rows: {adhoc_count}")
if adhoc_count == 20:
    print(f"  ✓ All 20 stock movement rows added")
else:
    print(f"  ❌ Expected 20, got {adhoc_count}")

print()
print("=" * 70)
print("3. Supplier Prices sheet — verify 20 new rows with is latest logic")
print("=" * 70)
ws = wb["Supplier Prices"]
adhoc_sp = []
for row_idx in range(5, ws.max_row + 1):
    notes = ws.cell(row=row_idx, column=7).value
    if notes and "Ad-hoc purchase" in str(notes):
        adhoc_sp.append({
            "row": row_idx,
            "sku": ws.cell(row=row_idx, column=2).value,
            "supplier": ws.cell(row=row_idx, column=3).value,
            "price": ws.cell(row=row_idx, column=4).value,
            "is_latest": ws.cell(row=row_idx, column=6).value,
            "notes": str(notes)[:60],
        })
print(f"  Found {len(adhoc_sp)} ad-hoc-related Supplier Prices rows")
print(f"  ✓ Expected 20" if len(adhoc_sp) == 20 else f"  ❌ Expected 20, got {len(adhoc_sp)}")

# Show D31-40MM rows (the one bought twice — should have is latest=yes on Oct 25)
print("\n  PKG-LISTON-D31-40MM rows (bought twice — should have is latest=yes on Oct 25):")
for r in adhoc_sp:
    if r["sku"] == "PKG-LISTON-D31-40MM":
        print(f"    Row {r['row']}: price=${r['price']}, is_latest={r['is_latest']}, notes={r['notes']}")

print()
print("=" * 70)
print("4. Ad-hoc Purchases sheet — verify all 20 rows + total")
print("=" * 70)
ws = wb["Ad-hoc Purchases"]
print(f"  Sheet max_row: {ws.max_row}")
print(f"  Title (A1): {ws['A1'].value}")
print(f"  Headers (row 4):")
for col in range(1, 12):
    v = ws.cell(row=4, column=col).value
    if v: print(f"    {get_column_letter(col)} = {v}")

print(f"\n  First 3 purchase rows:")
for r in [5, 6, 7]:
    print(f"    R{r}: id={ws.cell(row=r, column=1).value}, "
          f"date={ws.cell(row=r, column=2).value}, "
          f"sku={ws.cell(row=r, column=4).value}, "
          f"qty={ws.cell(row=r, column=5).value}, "
          f"cost=${ws.cell(row=r, column=6).value}, "
          f"total={ws.cell(row=r, column=7).value}")

print(f"\n  Last purchase row (row 24):")
r = 24
print(f"    R{r}: id={ws.cell(row=r, column=1).value}, "
      f"date={ws.cell(row=r, column=2).value}, "
      f"sku={ws.cell(row=r, column=4).value}, "
      f"cost=${ws.cell(row=r, column=6).value}")

# Find total row
for r in range(25, 30):
    if ws.cell(row=r, column=1).value == "Total":
        print(f"\n  Total row {r}: qty_sum={ws.cell(row=r, column=5).value}, total_formula={ws.cell(row=r, column=7).value}")
        break

print()
print("=" * 70)
print("5. Ribbon Properties sheet — verify 14 rows")
print("=" * 70)
ws = wb["Ribbon Properties"]
print(f"  Title (A1): {ws['A1'].value}")
print(f"  Headers: ", end="")
headers = []
for col in range(1, 8):
    v = ws.cell(row=4, column=col).value
    if v: headers.append(v)
print(" | ".join(headers))
ribbon_count = 0
for r in range(5, ws.max_row + 1):
    if ws.cell(row=r, column=1).value:
        ribbon_count += 1
print(f"  Total ribbon rows: {ribbon_count}")
print(f"  ✓ Expected 14" if ribbon_count == 14 else f"  ❌ Expected 14, got {ribbon_count}")

# Show one sample
print(f"\n  Sample (PKG-LISTON-D30-40MM):")
for r in range(5, ws.max_row + 1):
    if ws.cell(row=r, column=1).value == "PKG-LISTON-D30-40MM":
        for col in range(1, 8):
            v = ws.cell(row=r, column=col).value
            print(f"    {get_column_letter(col)} = {v}")
        break

print()
print("=" * 70)
print("6. Paper Properties sheet — verify 5 rows")
print("=" * 70)
ws = wb["Paper Properties"]
print(f"  Title (A1): {ws['A1'].value}")
print(f"  Headers: ", end="")
headers = []
for col in range(1, 12):
    v = ws.cell(row=4, column=col).value
    if v: headers.append(v)
print(" | ".join(headers))
paper_count = 0
for r in range(5, ws.max_row + 1):
    if ws.cell(row=r, column=1).value:
        paper_count += 1
print(f"  Total paper rows: {paper_count}")
print(f"  ✓ Expected 5" if paper_count == 5 else f"  ❌ Expected 5, got {paper_count}")

# Show one sample
print(f"\n  Sample (PKG-WRAP-WHT-56 — the translucent white):")
for r in range(5, ws.max_row + 1):
    if ws.cell(row=r, column=1).value == "PKG-WRAP-WHT-56":
        for col in range(1, 12):
            v = ws.cell(row=r, column=col).value
            if v: print(f"    {get_column_letter(col)} = {v}")
        break

print()
print("=" * 70)
print("7. Dashboard — Money Out section")
print("=" * 70)
ws = wb["Dashboard"]
# Find the Money Out heading
for r in range(15, ws.max_row + 1):
    v = ws.cell(row=r, column=2).value
    if v and "Money Out" in str(v):
        print(f"  Found 'Money Out' at row {r}:")
        for offset in range(0, 5):
            label = ws.cell(row=r + offset, column=2).value
            formula = ws.cell(row=r + offset, column=3).value
            note = ws.cell(row=r + offset, column=4).value
            if label or formula:
                print(f"    R{r + offset}: {label!r:45s} | {str(formula)[:60]!r:62s} | {str(note)[:50]!r}")
        break

print()
print("=" * 70)
print("8. Version History — v1.4 row")
print("=" * 70)
ws = wb["Version History"]
# Find last row with data
for r in range(ws.max_row, 5, -1):
    if ws.cell(row=r, column=1).value:
        print(f"  Last row {r}:")
        print(f"    Version: {ws.cell(row=r, column=1).value}")
        print(f"    Date:    {ws.cell(row=r, column=2).value}")
        print(f"    Author:  {ws.cell(row=r, column=3).value}")
        print(f"    File:    {ws.cell(row=r, column=5).value}")
        summary = ws.cell(row=r, column=4).value
        if summary:
            print(f"    Summary (first 200 chars): {str(summary)[:200]}...")
        break

print()
print("=" * 70)
print("9. Final sheet count")
print("=" * 70)
print(f"  Total sheets: {len(wb.sheetnames)} (was 24 in v1.3)")
print(f"  New sheets added:")
for name in ["Ad-hoc Purchases", "Ribbon Properties", "Paper Properties"]:
    if name in wb.sheetnames:
        idx = wb.sheetnames.index(name) + 1
        print(f"    {idx}. {name}")
