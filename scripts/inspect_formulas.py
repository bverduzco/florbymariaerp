"""Inspect formulas in Materials and Recipes tabs to understand dependencies."""
from openpyxl import load_workbook
from openpyxl.utils import get_column_letter

SRC = "/home/z/my-project/upload/Floristry_ERP updated b.xlsx"
wb = load_workbook(SRC)

print("MATERIALS — formulas on row 5 (first data row):")
ws = wb["Materials"]
for c in range(1, ws.max_column + 1):
    cell = ws.cell(row=5, column=c)
    if cell.value is not None:
        col = get_column_letter(c)
        header = ws.cell(row=4, column=c).value
        print(f"  {col}5 ({header!r}): {cell.value!r}")

print("\nMATERIALS — row 6 formulas (second data row, packs example):")
for c in range(1, ws.max_column + 1):
    cell = ws.cell(row=6, column=c)
    if cell.value is not None:
        col = get_column_letter(c)
        header = ws.cell(row=4, column=c).value
        print(f"  {col}6 ({header!r}): {cell.value!r}")

print("\nRECIPES — formulas on row 5 (first data row):")
ws = wb["Recipes"]
for c in range(1, ws.max_column + 1):
    cell = ws.cell(row=5, column=c)
    if cell.value is not None:
        col = get_column_letter(c)
        header = ws.cell(row=4, column=c).value
        print(f"  {col}5 ({header!r}): {cell.value!r}")

print("\nSUPPLIERS — all rows:")
ws = wb["Suppliers"]
for r in range(1, 10):
    for c in range(1, ws.max_column + 1):
        v = ws.cell(row=r, column=c).value
        if v is not None:
            print(f"  {get_column_letter(c)}{r}: {v!r}")
