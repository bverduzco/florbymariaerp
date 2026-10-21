"""
Parse the Floristry ERP Excel file into a clean JSON seed file.
Extracts: Suppliers, Materials, Recipes, Products.
For ERP Zai v1+: also reads Supplier Prices (latest row) and Stock Movements (sum)
to compute Pack Price and Current Stock — because those cells on the Materials tab
are now formulas, not values.
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


def parse_supplier_prices(ws):
    """Supplier Prices tab — header on row 4: Date | Material SKU | Supplier | Pack Price | Units per Pack | Is Latest | Notes.

    For v1.1+ (Conflict 5A: per-supplier latest), Is Latest is per (SKU, Supplier) — multiple
    rows can have Is Latest="yes" for the same SKU if they're for different suppliers.

    Returns TWO maps:
      - latest_per_supplier: { (sku, supplier): {packPrice, unitsPerPack, date} }
        (the latest "yes" row for each (sku, supplier) combination)
      - latest_any_supplier: { sku: {packPrice, unitsPerPack, supplier, date} }
        (the most recent "yes" row for the SKU, regardless of supplier — used as fallback
        when Materials.Preferred Supplier is blank)
    """
    latest_per_supplier = {}  # keyed by (sku, supplier)
    latest_any_supplier = {}  # keyed by sku, with date tracked

    for row in ws.iter_rows(min_row=5, values_only=True):
        if not row or not row[0] or not row[1]:
            continue
        sku = to_str(row[1])
        if not sku or sku == "Material SKU":
            continue
        is_latest = to_str(row[5]).lower() == "yes"
        if not is_latest:
            continue

        pack_price = to_num(row[3])
        units_per_pack = to_num(row[4])
        supplier = to_str(row[2])
        date = row[0]

        # Track per (sku, supplier)
        key = (sku, supplier)
        latest_per_supplier[key] = {
            "packPrice": pack_price,
            "unitsPerPack": units_per_pack,
            "supplier": supplier,
            "date": date,
        }

        # Track latest across all suppliers for this SKU
        existing = latest_any_supplier.get(sku)
        if existing is None or (date and (existing.get("date") is None or str(date) > str(existing.get("date")))):
            latest_any_supplier[sku] = {
                "packPrice": pack_price,
                "unitsPerPack": units_per_pack,
                "supplier": supplier,
                "date": date,
            }

    return latest_per_supplier, latest_any_supplier


def parse_stock_movements(ws):
    """Stock Movements tab — header on row 4: Date | Material SKU | Packs | Reason | Ref | Notes.
    Returns a map: { material_sku: sum_of_packs }.
    """
    stock_by_sku = {}
    for row in ws.iter_rows(min_row=5, values_only=True):
        if not row or not row[0] or not row[1]:
            continue
        sku = to_str(row[1])
        if not sku or sku == "Material SKU":
            continue
        packs = to_num(row[2]) or 0
        stock_by_sku[sku] = stock_by_sku.get(sku, 0) + packs
    return stock_by_sku


def parse_suppliers(ws):
    """Suppliers sheet — header on row 4. Real data starts at row 5."""
    HEADER_NAME = "Supplier Name"
    suppliers = []
    for row in ws.iter_rows(min_row=5, values_only=True):
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


def parse_materials(ws, latest_per_supplier, latest_any_supplier, stock_sums):
    """Materials sheet — header on row 4 (1-indexed):
       SKU, Item Name, Category, Unit, Unit Cost, Supplier, Current Stock, Reorder Level, Reorder Qty,
       Stock Value, Status, Pack Price, Units per Pack, Colors Available, Photo, Notes,
       Type, Preferred Supplier (cols Q, R added in v1).

    For v1.1+ (Conflict 5A):
      - If Preferred Supplier (col R) is set, look up Supplier Prices by (sku, preferred_supplier)
      - If Preferred Supplier is blank, fall back to the most recent price (any supplier)
    """
    HEADER_SKU = "SKU"
    materials = []
    for row in ws.iter_rows(min_row=5, values_only=True):
        sku = to_str(row[0])
        if not sku or sku == HEADER_SKU:
            continue

        preferred_supplier = to_str(row[17]) if len(row) > 17 and row[17] else ""

        # Try preferred supplier first, then fall back to most recent
        price_info = None
        if preferred_supplier and latest_per_supplier:
            price_info = latest_per_supplier.get((sku, preferred_supplier))
        if price_info is None and latest_any_supplier:
            price_info = latest_any_supplier.get(sku)

        # Fall back to direct cell value (pre-v1 files)
        pack_price = price_info.get("packPrice") if price_info else None
        if pack_price is None:
            pack_price = to_num(row[11])  # col L value (pre-v1: number, v1+: formula string → None)
        units_per_pack = price_info.get("unitsPerPack") if price_info else None
        if units_per_pack is None:
            units_per_pack = to_num(row[12])  # col M
        # Supplier: prefer the resolved price_info's supplier (which = preferred supplier if set);
        # fall back to col F
        supplier_resolved = price_info.get("supplier") if price_info else None
        if not supplier_resolved:
            supplier_resolved = to_str(row[5])

        current_stock = stock_sums.get(sku) if stock_sums else None
        if current_stock is None:
            current_stock = to_num(row[6])  # col G (pre-v1: number, v1+: formula string → None)

        # Compute unit cost
        unit_cost = None
        if pack_price is not None:
            if units_per_pack and units_per_pack > 0:
                unit_cost = pack_price / units_per_pack
            else:
                unit_cost = pack_price

        materials.append({
            "sku": sku,
            "name": to_str(row[1]),
            "category": to_str(row[2]).lower() or "other",
            "unit": to_str(row[3]) or "pack",
            "unitCost": unit_cost,
            "supplier": supplier_resolved,
            "currentStockPacks": current_stock,
            "reorderLevelPacks": to_num(row[7]),
            "reorderQtyPacks": to_num(row[8]),
            "packPrice": pack_price,
            "unitsPerPack": units_per_pack,
            "colors": to_str(row[13]),
            "type": to_str(row[16]) if len(row) > 16 and row[16] else _default_type(sku),
            "preferredSupplier": preferred_supplier,
            "notes": to_str(row[15]),
        })
    return materials


def _default_type(sku):
    """Default Type based on SKU prefix (for pre-v1 files)."""
    s = str(sku)
    if s.startswith("FLR-") or s.startswith("FOL-"):
        return "perishable"
    if s.startswith("PKG-") or s.startswith("HARD-"):
        return "consumable"
    if s.startswith("TOOL-"):
        return "tool"
    return "perishable"


def parse_recipes(ws):
    """Recipes sheet — header on row 4. v1 adds Version (L) and Effective From (M) cols."""
    HEADER_PRODUCT_SKU = "Product SKU"
    recipes = []
    for row in ws.iter_rows(min_row=5, values_only=True):
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
            "version": to_str(row[11]) if len(row) > 11 and row[11] else "v1",
            "effectiveFrom": to_str(row[12]) if len(row) > 12 and row[12] else "",
        })
    return recipes


def parse_products(ws):
    """Products sheet — header on row 4 (two-row header). Data starts at row 5 in v1 (was row 4 pre-v1)."""
    HEADER_PRODUCT_SKU = "Product SKU"
    products = []
    # Try row 5 first (v1+); if empty, fall back to row 4
    start_row = 5
    if ws.cell(row=5, column=1).value is None or ws.cell(row=5, column=1).value == HEADER_PRODUCT_SKU:
        start_row = 6 if ws.cell(row=6, column=1).value else 4
    for row in ws.iter_rows(min_row=start_row, values_only=True):
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

    # Use data_only=True to read cached formula values (file must have been
    # opened by LibreOffice/Excel first to cache the values).
    # If a formula has no cached value (None), fall back to the formula string.
    wb = load_workbook(EXCEL_PATH, data_only=True)
    wb_formulas = load_workbook(EXCEL_PATH, data_only=False)  # for fallback only

    # Read the new v1+ tabs if they exist; otherwise pass empty dicts
    latest_per_supplier = {}
    latest_any_supplier = {}
    stock_sums = {}
    if "Supplier Prices" in wb.sheetnames:
        latest_per_supplier, latest_any_supplier = parse_supplier_prices(wb["Supplier Prices"])
        print(f"  Read {len(latest_per_supplier)} per-supplier latest prices ({len(latest_any_supplier)} distinct SKUs)")
    if "Stock Movements" in wb.sheetnames:
        stock_sums = parse_stock_movements(wb["Stock Movements"])
        print(f"  Read {len(stock_sums)} stock balances from Stock Movements tab")

    suppliers = parse_suppliers(wb["Suppliers"])
    materials = parse_materials(wb["Materials"], latest_per_supplier, latest_any_supplier, stock_sums)
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
