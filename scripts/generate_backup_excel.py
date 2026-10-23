"""
Generate a full backup Excel from the app's SQLite database.
Creates a new .xlsx with all DB tables as separate tabs, reflecting everything
done through the UI (orders, customers, custom recipes, etc.) PLUS the
ERP-sourced data (materials, products, suppliers, recipes).

Usage:
    python3 generate_backup_excel.py <output.xlsx>

The output file is named: "Flor by Maria ERP YYYYMMDDHHMM.xlsx"
"""

import json
import os
import sqlite3
import sys
from datetime import datetime

from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Border, Side, Alignment
from openpyxl.utils import get_column_letter

DB_PATH = "/home/z/my-project/db/custom.db"


HEADER_FILL = PatternFill(fill_type="solid", fgColor="FF2F5233")
HEADER_FONT = Font(name="Arial", size=10.5, bold=True, color="FFFFFFFF")
HEADER_ALIGN = Alignment(horizontal="center", vertical="center", wrap_text=True)
THIN = Side(border_style="thin", color="FF000000")
BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)
DATA_FONT = Font(name="Arial", size=10.5, color="FF000000")
TITLE_FONT = Font(name="Arial", size=14, bold=True, color="FF1F3B4D")
SUBTITLE_FONT = Font(name="Arial", size=10, italic=True, color="FF6B8E6B")


def style_header(cell, value):
    cell.value = value
    cell.font = HEADER_FONT
    cell.fill = HEADER_FILL
    cell.alignment = HEADER_ALIGN
    cell.border = BORDER


def style_data(cell, fmt="General"):
    cell.font = DATA_FONT
    cell.border = BORDER
    if fmt != "General":
        cell.number_format = fmt


def write_table(ws, title, subtitle, columns, rows, money_cols=None, date_cols=None):
    """Write a titled table to a worksheet."""
    money_cols = money_cols or set()
    date_cols = date_cols or set()

    # Title
    ws["A1"] = title
    ws["A1"].font = TITLE_FONT
    ws["A2"] = subtitle
    ws["A2"].font = SUBTITLE_FONT

    # Headers
    for i, col in enumerate(columns, start=1):
        style_header(ws.cell(row=4, column=i), col)

    # Data
    for r_idx, row in enumerate(rows, start=5):
        for c_idx, val in enumerate(row, start=1):
            cell = ws.cell(row=r_idx, column=c_idx, value=val)
            col_name = columns[c_idx - 1] if c_idx <= len(columns) else ""
            if col_name in money_cols:
                style_data(cell, '"$"#,##0.00')
            elif col_name in date_cols:
                style_data(cell, "yyyy-mm-dd")
            else:
                style_data(cell)

    # Auto-width
    for i, col in enumerate(columns, start=1):
        max_len = len(col)
        for r_idx in range(5, 5 + len(rows)):
            val = ws.cell(row=r_idx, column=i).value
            if val is not None:
                max_len = max(max_len, len(str(val)[:40]))
        ws.column_dimensions[get_column_letter(i)].width = min(max_len + 4, 40)

    ws.freeze_panes = "A5"


def main():
    output_path = sys.argv[1] if len(sys.argv) > 1 else None
    if not output_path:
        timestamp = datetime.now().strftime("%Y%m%d%H%M")
        output_path = f"/home/z/my-project/download/Flor by Maria ERP {timestamp}.xlsx"

    if not os.path.exists(DB_PATH):
        print(f"ERROR: DB not found at {DB_PATH}")
        sys.exit(1)

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    wb = Workbook()
    # Remove default sheet
    wb.remove(wb.active)

    timestamp_str = datetime.now().strftime("%Y-%m-%d %H:%M")

    # === TAB 1: Backup Info ===
    ws_info = wb.create_sheet("Backup Info")
    ws_info["A1"] = "Flor by Maria — ERP Backup"
    ws_info["A1"].font = TITLE_FONT
    ws_info["A2"] = f"Generated: {timestamp_str}"
    ws_info["A2"].font = SUBTITLE_FONT
    ws_info["A4"] = "Tab"
    ws_info["B4"] = "Description"
    ws_info["C4"] = "Rows"
    for c in range(1, 4):
        style_header(ws_info.cell(row=4, column=c), ["Tab", "Description", "Rows"][c-1])

    tab_descriptions = [
        ("Customers", "Customer records (added via UI)"),
        ("Orders", "Order records with pipeline status"),
        ("Order Line Items", "Products within each order"),
        ("Custom Materials", "El Gato catalogue matched to ERP"),
        ("Custom Recipes", "Saved custom bouquet recipes"),
        ("Custom Recipe Lines", "Materials within each custom recipe"),
        ("Materials", "ERP materials (from Excel source)"),
        ("Products", "ERP products / bouquets (from Excel + custom saved)"),
        ("Suppliers", "ERP suppliers"),
        ("Recipe Lines", "ERP recipe lines (bill of materials)"),
    ]

    # Map display names to actual SQLite table names
    table_name_map = {
        "Customers": "Customer",
        "Orders": '"Order"',
        "Order Line Items": "OrderLineItem",
        "Custom Materials": "CustomMaterial",
        "Custom Recipes": "CustomRecipe",
        "Custom Recipe Lines": "CustomRecipeLine",
        "Materials": "Material",
        "Products": "Product",
        "Suppliers": "Supplier",
        "Recipe Lines": "RecipeLine",
    }

    for i, (tab, desc) in enumerate(tab_descriptions, start=5):
        ws_info.cell(row=i, column=1, value=tab).font = DATA_FONT
        ws_info.cell(row=i, column=2, value=desc).font = DATA_FONT
        # Count rows
        actual_table = table_name_map.get(tab, tab)
        try:
            cur.execute(f"SELECT COUNT(*) FROM {actual_table}")
            count = cur.fetchone()[0]
        except Exception:
            count = "N/A"
        ws_info.cell(row=i, column=3, value=count).font = DATA_FONT

    ws_info.column_dimensions["A"].width = 25
    ws_info.column_dimensions["B"].width = 50
    ws_info.column_dimensions["C"].width = 10

    # === TAB 2: Customers ===
    ws = wb.create_sheet("Customers")
    cur.execute("SELECT name, phone, email, address, notes, createdAt, updatedAt FROM Customer ORDER BY name")
    rows = cur.fetchall()
    write_table(ws, "Customers", f"Backup {timestamp_str}",
        ["Name", "Phone", "Email", "Address", "Notes", "Created", "Updated"],
        [tuple(r) for r in rows],
        date_cols={"Created", "Updated"})

    # === TAB 3: Orders ===
    ws = wb.create_sheet("Orders")
    cur.execute("""
        SELECT o.orderNumber, o.status, c.name as customerName,
               o.deliveryDate, o.deliveryAddress, o.cardMessage,
               o.deliveryNotes, o.internalNotes, o.deliveryFee, o.discount,
               o.paymentMethod, o.paymentStatus, o.paymentConfirmedAt,
               o.paymentReference, o.quoteSentAt, o.quoteSentVia,
               o.procurementStartedAt, o.producedAt, o.deliveredAt, o.fulfilledAt,
               o.createdAt, o.updatedAt
        FROM "Order" o
        LEFT JOIN Customer c ON o.customerId = c.id
        ORDER BY o.orderNumber
    """)
    rows = cur.fetchall()
    write_table(ws, "Orders", f"Backup {timestamp_str} · {len(rows)} orders",
        ["Order #", "Status", "Customer", "Delivery Date", "Delivery Address",
         "Card Message", "Delivery Notes", "Internal Notes",
         "Delivery Fee", "Discount",
         "Payment Method", "Payment Status", "Payment Confirmed At",
         "Payment Reference", "Quote Sent At", "Quote Sent Via",
         "Procurement Started", "Produced At", "Delivered At", "Fulfilled At",
         "Created", "Updated"],
        [tuple(r) for r in rows],
        money_cols={"Delivery Fee", "Discount"},
        date_cols={"Delivery Date", "Payment Confirmed At", "Quote Sent At",
                   "Procurement Started", "Produced At", "Delivered At",
                   "Fulfilled At", "Created", "Updated"})

    # === TAB 4: Order Line Items ===
    ws = wb.create_sheet("Order Line Items")
    cur.execute("""
        SELECT o.orderNumber, li.productSku, li.productName, li.productSize,
               li.qty, li.unitPrice, (li.unitPrice * li.qty) as lineTotal,
               c.name as customerName, o.deliveryDate
        FROM OrderLineItem li
        JOIN "Order" o ON li.orderId = o.id
        LEFT JOIN Customer c ON o.customerId = c.id
        ORDER BY o.orderNumber, li.productName
    """)
    rows = cur.fetchall()
    write_table(ws, "Order Line Items", f"Backup {timestamp_str} · {len(rows)} lines",
        ["Order #", "Product SKU", "Product Name", "Size", "Qty",
         "Unit Price", "Line Total", "Customer", "Delivery Date"],
        [tuple(r) for r in rows],
        money_cols={"Unit Price", "Line Total"},
        date_cols={"Delivery Date"})

    # === TAB 5: Custom Materials ===
    ws = wb.create_sheet("Custom Materials")
    cur.execute("""
        SELECT name, pricePerStem, type, class, source, erpSku, erpName,
               matchScore, matchConfidence, createdAt
        FROM CustomMaterial ORDER BY type, name
    """)
    rows = cur.fetchall()
    write_table(ws, "Custom Materials (El Gato)", f"Backup {timestamp_str} · {len(rows)} items",
        ["Name", "Price/Stem", "Type", "Class", "Source", "ERP SKU", "ERP Name",
         "Match Score", "Match Confidence", "Created"],
        [tuple(r) for r in rows],
        money_cols={"Price/Stem"},
        date_cols={"Created"})

    # === TAB 6: Custom Recipes ===
    ws = wb.create_sheet("Custom Recipes")
    cur.execute("""
        SELECT cr.erpProductSku, cr.name, cr.size, cr.description,
               cr.flowersCost, cr.otherMaterialsCost, cr.totalCost,
               cr.suggestedPrice, cr.actualPrice, cr.hidden,
               cr.createdAt
        FROM CustomRecipe cr ORDER BY cr.createdAt DESC
    """)
    rows = cur.fetchall()
    write_table(ws, "Custom Recipes", f"Backup {timestamp_str} · {len(rows)} recipes",
        ["SKU", "Name", "Size", "Description",
         "Flowers Cost", "Other Cost", "Total Cost",
         "Suggested Price", "Actual Price", "Hidden?", "Created"],
        [tuple(r) for r in rows],
        money_cols={"Flowers Cost", "Other Cost", "Total Cost",
                    "Suggested Price", "Actual Price"},
        date_cols={"Created"})

    # === TAB 7: Custom Recipe Lines ===
    ws = wb.create_sheet("Custom Recipe Lines")
    cur.execute("""
        SELECT cr.erpProductSku, crl.materialName, crl.qty, crl.materialPrice,
               crl.materialType, (crl.qty * crl.materialPrice) as lineCost
        FROM CustomRecipeLine crl
        JOIN CustomRecipe cr ON crl.customRecipeId = cr.id
        ORDER BY cr.erpProductSku, crl.materialName
    """)
    rows = cur.fetchall()
    write_table(ws, "Custom Recipe Lines", f"Backup {timestamp_str} · {len(rows)} lines",
        ["Recipe SKU", "Material Name", "Qty", "Material Price", "Type", "Line Cost"],
        [tuple(r) for r in rows],
        money_cols={"Material Price", "Line Cost"})

    # === TAB 8: Materials (from ERP Excel) ===
    ws = wb.create_sheet("Materials")
    cur.execute("""
        SELECT sku, name, category, unit, unitCost, supplier,
               currentStockPacks, reorderLevelPacks, packPrice, unitsPerPack,
               colors, notes
        FROM Material ORDER BY category, name
    """)
    rows = cur.fetchall()
    write_table(ws, "Materials (ERP)", f"Backup {timestamp_str} · {len(rows)} materials",
        ["SKU", "Name", "Category", "Unit", "Unit Cost", "Supplier",
         "Current Stock (packs)", "Reorder Level", "Pack Price", "Units/Pack",
         "Colors", "Notes"],
        [tuple(r) for r in rows],
        money_cols={"Unit Cost", "Pack Price"})

    # === TAB 9: Products (from ERP + custom saved) ===
    ws = wb.create_sheet("Products")
    cur.execute("""
        SELECT sku, name, category, size,
               flowersCost, otherMaterialsCost, totalCost,
               suggestedPriceBeforeIva, actualPriceBeforeIva,
               marginPct, linesToReview, description
        FROM Product ORDER BY category, name
    """)
    rows = cur.fetchall()
    write_table(ws, "Products (ERP + Custom)", f"Backup {timestamp_str} · {len(rows)} products",
        ["SKU", "Name", "Category", "Size",
         "Flowers Cost", "Other Cost", "Total Cost",
         "Suggested Price (pre-IVA)", "Actual Price (pre-IVA)",
         "Margin %", "Lines to Review", "Description"],
        [tuple(r) for r in rows],
        money_cols={"Flowers Cost", "Other Cost", "Total Cost",
                    "Suggested Price (pre-IVA)", "Actual Price (pre-IVA)"})

    # === TAB 10: Suppliers ===
    ws = wb.create_sheet("Suppliers")
    cur.execute("""
        SELECT name, contactPerson, phone, email, leadTimeDays, paymentTerms, notes
        FROM Supplier ORDER BY name
    """)
    rows = cur.fetchall()
    write_table(ws, "Suppliers", f"Backup {timestamp_str} · {len(rows)} suppliers",
        ["Name", "Contact", "Phone", "Email", "Lead Time (days)", "Payment Terms", "Notes"],
        [tuple(r) for r in rows])

    # === TAB 11: Recipe Lines (ERP BOM) ===
    ws = wb.create_sheet("Recipe Lines")
    cur.execute("""
        SELECT productSku, componentSku, componentName, qty, unit,
               unitCost, lineCost, category, color, `check`
        FROM RecipeLine ORDER BY productSku, category
    """)
    rows = cur.fetchall()
    write_table(ws, "Recipe Lines (BOM)", f"Backup {timestamp_str} · {len(rows)} lines",
        ["Product SKU", "Component SKU", "Component Name", "Qty", "Unit",
         "Unit Cost", "Line Cost", "Category", "Color", "Check"],
        [tuple(r) for r in rows],
        money_cols={"Unit Cost", "Line Cost"})

    # Set workbook metadata
    wb.properties.creator = "Flor by Maria ERP"
    wb.properties.title = f"Flor by Maria ERP Backup {timestamp_str}"
    wb.properties.description = (
        f"Full database backup generated {timestamp_str}. "
        "Contains all customers, orders, custom recipes, and ERP data."
    )

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    wb.save(output_path)

    # Print summary for the API to parse
    print(f"OUTPUT:{output_path}")
    print(f"TAB_COUNT:{len(wb.sheetnames)}")
    for name in wb.sheetnames:
        ws = wb[name]
        print(f"TAB:{name}:{ws.max_row - 4} rows")

    conn.close()


if __name__ == "__main__":
    main()
