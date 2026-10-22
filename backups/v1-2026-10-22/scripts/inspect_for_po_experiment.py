"""Inspect ERP Zai v1.xlsx: PO tab structure, Materials tab sample, Suppliers tab."""
from openpyxl import load_workbook
from openpyxl.utils import get_column_letter

SRC = "/home/z/my-project/download/ERP Zai v1.xlsx"
wb = load_workbook(SRC, data_only=True)

print("=== PURCHASE ORDERS TAB ===")
ws = wb["Purchase Orders"]
print(f"max_row={ws.max_row}, max_col={ws.max_column}")
# Print headers (rows 1-4) and first 3 data rows
for r in range(1, 8):
    row_vals = []
    for c in range(1, ws.max_column + 1):
        v = ws.cell(row=r, column=c).value
        if v is not None:
            row_vals.append(f"{get_column_letter(c)}{r}={v!r}")
    if row_vals:
        print(f"  R{r}: {row_vals}")

print("\n=== SAMPLE MATERIALS (first 10) ===")
ws = wb["Materials"]
print(f"Headers (row 4):")
headers = []
for c in range(1, ws.max_column + 1):
    v = ws.cell(row=4, column=c).value
    if v:
        print(f"  {get_column_letter(c)}4: {v!r}")
print(f"\nFirst 10 data rows:")
for r in range(5, 15):
    sku = ws.cell(row=r, column=1).value
    name = ws.cell(row=r, column=2).value
    cat = ws.cell(row=r, column=3).value
    unit = ws.cell(row=r, column=4).value
    supplier = ws.cell(row=r, column=6).value
    pack_price = ws.cell(row=r, column=12).value
    units_per_pack = ws.cell(row=r, column=13).value
    print(f"  R{r}: {sku:25s} | {name:30s} | {cat:10s} | unit={unit:6s} | supplier={supplier:10s} | pack=${pack_price} | units/pack={units_per_pack}")

print("\n=== SEARCH: megadeco / margarita / ruscus / eucalipto / cempasuchil ===")
# Search Materials for any item whose name contains these keywords
keywords = ["megadeco", "margarita", "ruscus", "eucalipto", "cempasuchil"]
for kw in keywords:
    print(f"\n  '{kw}' matches:")
    for r in range(5, ws.max_row + 1):
        name = ws.cell(row=r, column=2).value
        sku = ws.cell(row=r, column=1).value
        if name and kw.lower() in str(name).lower():
            unit = ws.cell(row=r, column=4).value
            pack_price = ws.cell(row=r, column=12).value
            units_per_pack = ws.cell(row=r, column=13).value
            colors = ws.cell(row=r, column=14).value
            print(f"    R{r}: {sku:25s} | {name:35s} | unit={unit:6s} | pack=${pack_price} | units/pack={units_per_pack} | colors={colors}")

print("\n=== SUPPLIERS TAB ===")
ws = wb["Suppliers"]
for r in range(4, 10):
    row_vals = []
    for c in range(1, ws.max_column + 1):
        v = ws.cell(row=r, column=c).value
        if v is not None:
            row_vals.append(f"{get_column_letter(c)}{r}={v!r}")
    if row_vals:
        print(f"  R{r}: {row_vals}")

print("\n=== SUPPLIER PRICES TAB (first 5 rows + structure) ===")
ws = wb["Supplier Prices"]
for r in range(4, 9):
    row_vals = []
    for c in range(1, ws.max_column + 1):
        v = ws.cell(row=r, column=c).value
        if v is not None:
            row_vals.append(f"{get_column_letter(c)}{r}={v!r}")
    if row_vals:
        print(f"  R{r}: {row_vals}")

print("\n=== STOCK MOVEMENTS TAB (first 5 rows) ===")
ws = wb["Stock Movements"]
for r in range(4, 9):
    row_vals = []
    for c in range(1, ws.max_column + 1):
        v = ws.cell(row=r, column=c).value
        if v is not None:
            row_vals.append(f"{get_column_letter(c)}{r}={v!r}")
    if row_vals:
        print(f"  R{r}: {row_vals}")
