"""
Parse the Floristry ERP Excel file into a clean JSON seed file.
Extracts: Suppliers, Materials, Recipes, Products.
Output: /home/z/my-project/src/data/seed.json
"""
import json
import os
from openpyxl import load_workbook

EXCEL_PATH = "/home/z/my-project/upload/Floristry_ERP updated b.xlsx"
OUTPUT_PATH = "/home/z/my-project/src/data/seed.json"


def to_str(v):
    if v is None:
        return ""
    return str(v).strip()


def to_num(v):
    """Try to convert to float; return None if blank or non-numeric."""
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return float(v)
    s = str(v).strip().replace("$", "").replace(",", "")
    if s == "" or s == "*":
        return None
    try:
        return float(s)
    except ValueError:
        return None


def parse_suppliers(ws):
    """Suppliers sheet — header on row 2 (1-indexed). Real data starts at row 3;
       but row 3 may contain placeholder header strings, so we skip any row whose
       Supplier Name equals the column header text."""
    HEADER_NAME = "Supplier Name"
    suppliers = []
    for row in ws.iter_rows(min_row=3, values_only=True):
        name = to_str(row[0])
        if not name or name == HEADER_NAME:
            continue
        suppliers.append({
            "name": name,
            "contactPerson": to_str(row[1]),
            "phone": to_str(row[2]),
            "email": to_str(row[3]),
            "leadTimeDays": to_num(row[4]),
            "paymentTerms": to_str(row[5]),
            "notes": to_str(row[6]),
        })
    return suppliers


def parse_materials(ws):
    """Materials sheet — header on row 2 (1-indexed):
       SKU, Item Name, Category, Unit, Unit Cost, Supplier, Current Stock, Reorder Level, Reorder Qty,
       Stock Value, Status, Pack Price, Units per Pack, Colors Available, Photo, Notes.
    """
    HEADER_SKU = "SKU"
    materials = []
    for row in ws.iter_rows(min_row=3, values_only=True):
        sku = to_str(row[0])
        if not sku or sku == HEADER_SKU:
            continue
        materials.append({
            "sku": sku,
            "name": to_str(row[1]),
            "category": to_str(row[2]).lower() or "other",
            "unit": to_str(row[3]) or "pack",
            "unitCost": to_num(row[4]),
            "supplier": to_str(row[5]),
            "currentStockPacks": to_num(row[6]),
            "reorderLevelPacks": to_num(row[7]),
            "reorderQtyPacks": to_num(row[8]),
            "packPrice": to_num(row[11]),
            "unitsPerPack": to_num(row[12]) if to_num(row[12]) and to_num(row[12]) > 0 else None,
            "colors": to_str(row[13]),
            "notes": to_str(row[15]),
        })
    return materials


def parse_recipes(ws):
    """Recipes sheet — header on row 2:
       Product SKU, Component SKU, Component Name, Qty Used, Unit, Unit Cost, Line Cost, Category, Color, Check, Notes.
    """
    HEADER_PRODUCT_SKU = "Product SKU"
    recipes = []
    for row in ws.iter_rows(min_row=3, values_only=True):
        product_sku = to_str(row[0])
        component_sku = to_str(row[1])
        if not product_sku or not component_sku:
            continue
        if product_sku == HEADER_PRODUCT_SKU:
            continue
        recipes.append({
            "productSku": product_sku,
            "componentSku": component_sku,
            "componentName": to_str(row[2]),
            "qty": to_num(row[3]) or 0,
            "unit": to_str(row[4]) or "stem",
            "unitCost": to_num(row[5]) or 0,
            "lineCost": to_num(row[6]) or 0,
            "category": to_str(row[7]).lower() or "other",
            "color": to_str(row[8]),
            "check": to_str(row[9]),
            "notes": to_str(row[10]),
        })
    return recipes


def parse_products(ws):
    """Products sheet — header on row 2 (two-row header). The actual product rows start at row 4 (1-indexed).
       Columns:
         0: Product SKU
         1: Product Name
         2: Category
         3: Size
         4: Flowers Cost
         5: Other Materials Cost
         6: Labor (min)
         7: Labor Cost
         8: Overhead / Unit
         9: Total Cost
         10: Flowers ×2.5
         11: Other materials ×2
         12: Labor & design +40%
         13: Suggested price (flowers ×2.5) before IVA
         14: Suggested ×2.5 with IVA
         15: Suggested price (flowers ×4) before IVA
         16: Suggested ×4 with IVA
         17: Actual Price (before IVA)
         18: Actual Price with IVA
         19: Margin $
         20: Margin %
         21: Lines to Review
         22: Description
    """
    HEADER_PRODUCT_SKU = "Product SKU"
    products = []
    for row in ws.iter_rows(min_row=4, values_only=True):
        sku = to_str(row[0])
        if not sku or sku == HEADER_PRODUCT_SKU:
            continue
        products.append({
            "sku": sku,
            "name": to_str(row[1]),
            "category": to_str(row[2]) or "Bouquet",
            "size": to_str(row[3]),
            "flowersCost": to_num(row[4]) or 0,
            "otherMaterialsCost": to_num(row[5]) or 0,
            "totalCost": to_num(row[9]) or 0,
            "suggestedPriceBeforeIva": to_num(row[13]) or 0,
            "suggestedPriceWithIva": to_num(row[14]) or 0,
            "actualPriceBeforeIva": to_num(row[17]) or 0,
            "actualPriceWithIva": to_num(row[18]) or 0,
            "marginPct": to_num(row[20]) or 0,
            "linesToReview": int(to_num(row[21]) or 0),
            "description": to_str(row[22]),
        })
    return products


def main():
    if not os.path.exists(EXCEL_PATH):
        raise SystemExit(f"Excel file not found: {EXCEL_PATH}")

    wb = load_workbook(EXCEL_PATH, data_only=True)

    suppliers = parse_suppliers(wb["Suppliers"])
    materials = parse_materials(wb["Materials"])
    recipes = parse_recipes(wb["Recipes"])
    products = parse_products(wb["Products"])

    seed = {
        "suppliers": suppliers,
        "materials": materials,
        "recipes": recipes,
        "products": products,
    }

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(seed, f, ensure_ascii=False, indent=2)

    print(f"Parsed:")
    print(f"  Suppliers:  {len(suppliers)}")
    print(f"  Materials:  {len(materials)}")
    print(f"  Recipes:    {len(recipes)}")
    print(f"  Products:   {len(products)}")
    print(f"Output: {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
