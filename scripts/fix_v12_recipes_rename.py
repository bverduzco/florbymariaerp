"""
Fix v1.2: update Recipes tab component SKU references for renamed materials.
The original rename script (build_v12.py) updated Materials, Supplier Prices, and Stock Movements
but missed the Recipes tab. Recipe lines that referenced PKG-MEGADECO-FLORAL still have the old
SKU, so the INDEX/MATCH formula in Recipes.C (Component Name) returns '?' — and the parser drops
these recipe lines.

Apply the same SKU renames to Recipes.column B (Component SKU).
"""

from openpyxl import load_workbook
import os

V12_PATH = "/home/z/my-project/download/ERP Zai v1.2.xlsx"

SKU_RENAMES = {
    "PKG-MEGADECO-FLORAL": "PKG-MEGADECO",
    "PKG-ESPUMA-FLORAL":   "PKG-OASIS-LADRILLO-STD",
}


def main():
    if not os.path.exists(V12_PATH):
        raise SystemExit(f"v1.2 file not found: {V12_PATH}")

    print(f"Loading v1.2: {V12_PATH}")
    wb = load_workbook(V12_PATH)

    ws = wb["Recipes"]
    renamed = 0
    for r in range(5, ws.max_row + 1):
        component_sku = ws.cell(row=r, column=2).value
        if component_sku in SKU_RENAMES:
            old = component_sku
            new = SKU_RENAMES[component_sku]
            ws.cell(row=r, column=2).value = new
            print(f"  Row {r}: Recipes component SKU {old} → {new}")
            renamed += 1

    print(f"\nTotal recipe lines renamed: {renamed}")
    print(f"\nSaving fixed v1.2: {V12_PATH}")
    wb.save(V12_PATH)
    print("Done.")


if __name__ == "__main__":
    main()
