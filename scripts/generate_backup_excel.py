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
        # v1.9.x tables — added for v1.9.4 backup
        ("Ad-Hoc Purchases", "Ad-hoc vendor purchases (with color + variant fields)"),
        ("Execution Logs", "Execution events — what was actually used per job"),
        ("Execution Log Lines", "Per-line material usage + cost basis + color/variant"),
        ("Losses", "Damaged / spoiled inventory"),
        ("Loan Records", "Borrowed items (vases, tools) tracked for return"),
        ("Missing Purchase Logs", "Inventory discrepancies found during execution"),
        ("Payments", "Customer payments received"),
        ("Expenses", "Generic business expenses"),
        ("Purchase Orders", "Formal POs to suppliers"),
        ("Purchase Order Lines", "Line items within POs"),
        ("Quotes", "Customer quotes (pipeline: draft → sent → accepted)"),
        ("Quote Lines", "Line items within quotes"),
        ("Events", "Scheduled events (weddings, etc.)"),
        ("Audit Logs", "Audit trail of record changes"),
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
        # v1.9.x tables
        "Ad-Hoc Purchases": "AdHocPurchase",
        "Execution Logs": "ExecutionLog",
        "Execution Log Lines": "ExecutionLogLine",
        "Losses": "Loss",
        "Loan Records": "LoanRecord",
        "Missing Purchase Logs": "MissingPurchaseLog",
        "Payments": "Payment",
        "Expenses": "Expense",
        "Purchase Orders": "PurchaseOrder",
        "Purchase Order Lines": "PurchaseOrderLine",
        "Quotes": "Quote",
        "Quote Lines": "QuoteLine",
        "Events": "Event",
        "Audit Logs": "AuditLog",
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

    # === TAB 12: Ad-Hoc Purchases (v1.9.x) ===
    ws = wb.create_sheet("Ad-Hoc Purchases")
    cur.execute("""
        SELECT adhocNumber, date, vendor, materialSku, materialName, materialType,
               qtyPacks, unitCost, total, ticketNumber, paymentMethod,
               color, variant, notes, createdAt
        FROM AdHocPurchase ORDER BY date DESC
    """)
    rows = cur.fetchall()
    write_table(ws, "Ad-Hoc Purchases", f"Backup {timestamp_str} · {len(rows)} purchases",
        ["Adhoc #", "Date", "Vendor", "Material SKU", "Material Name", "Type",
         "Qty (packs)", "Unit Cost", "Total", "Ticket #", "Payment Method",
         "Color", "Variant", "Notes", "Created"],
        [tuple(r) for r in rows],
        money_cols={"Unit Cost", "Total"},
        date_cols={"Date", "Created"})

    # === TAB 13: Execution Logs (v1.9.x) ===
    ws = wb.create_sheet("Execution Logs")
    cur.execute("""
        SELECT executionNumber, executedAt, executedBy, status, paymentStatus,
               estimatedCost, actualCost, quotedPrice, marginDollars, marginPct,
               durationMinutes, startedAt, completedAt,
               notes, createdAt
        FROM ExecutionLog ORDER BY executedAt DESC
    """)
    rows = cur.fetchall()
    write_table(ws, "Execution Logs", f"Backup {timestamp_str} · {len(rows)} logs",
        ["Execution #", "Executed At", "Executed By", "Status", "Payment Status",
         "Estimated Cost", "Actual Cost", "Quoted Price", "Margin $", "Margin %",
         "Duration (min)", "Started At", "Completed At",
         "Notes", "Created"],
        [tuple(r) for r in rows],
        money_cols={"Estimated Cost", "Actual Cost", "Quoted Price", "Margin $"},
        date_cols={"Executed At", "Started At", "Completed At", "Created"})

    # === TAB 14: Execution Log Lines (v1.9.x — includes color + variant) ===
    ws = wb.create_sheet("Execution Log Lines")
    cur.execute("""
        SELECT el.executionNumber, ell.materialSku, ell.materialName,
               ell.qtyUsed, ell.unit, ell.unitCost, ell.lineCost,
               ell.type, ell.source, ell.costBasis,
               ell.linkedAdhocPurchaseId,
               ell.color, ell.variant,
               ell.notes
        FROM ExecutionLogLine ell
        JOIN ExecutionLog el ON ell.executionLogId = el.id
        ORDER BY el.executionNumber, ell.materialName
    """)
    rows = cur.fetchall()
    write_table(ws, "Execution Log Lines", f"Backup {timestamp_str} · {len(rows)} lines",
        ["Execution #", "Material SKU", "Material Name",
         "Qty Used", "Unit", "Unit Cost", "Line Cost",
         "Type", "Source", "Cost Basis",
         "Linked Adhoc Purchase ID",
         "Color", "Variant",
         "Notes"],
        [tuple(r) for r in rows],
        money_cols={"Unit Cost", "Line Cost"})

    # === TAB 15: Losses (v1.9.x) ===
    ws = wb.create_sheet("Losses")
    cur.execute("""
        SELECT l.lossNumber, l.date, l.materialSku,
               COALESCE(m.name, l.materialSku) as materialName,
               l.qtyLostPacks, l.qtyLostUnits, l.unit,
               l.reason, l.discoveredBy, l.costImpact, l.notes, l.createdAt
        FROM Loss l
        LEFT JOIN Material m ON l.materialSku = m.sku
        ORDER BY l.date DESC
    """)
    rows = cur.fetchall()
    write_table(ws, "Losses", f"Backup {timestamp_str} · {len(rows)} losses",
        ["Loss #", "Date", "Material SKU", "Material Name",
         "Qty Lost (packs)", "Qty Lost (units)", "Unit",
         "Reason", "Discovered By", "Cost Impact", "Notes", "Created"],
        [tuple(r) for r in rows],
        money_cols={"Cost Impact"},
        date_cols={"Date", "Created"})

    # === TAB 16: Loan Records (v1.9.x) ===
    ws = wb.create_sheet("Loan Records")
    cur.execute("""
        SELECT loanNumber, itemName, description, owner, qty,
               dateBorrowed, datePromised, dateReturned, notes, createdAt
        FROM LoanRecord ORDER BY dateBorrowed DESC
    """)
    rows = cur.fetchall()
    write_table(ws, "Loan Records", f"Backup {timestamp_str} · {len(rows)} loans",
        ["Loan #", "Item", "Description", "Owner", "Qty",
         "Date Borrowed", "Date Promised", "Date Returned", "Notes", "Created"],
        [tuple(r) for r in rows],
        date_cols={"Date Borrowed", "Date Promised", "Date Returned", "Created"})

    # === TAB 17: Missing Purchase Logs (v1.9.x) ===
    ws = wb.create_sheet("Missing Purchase Logs")
    cur.execute("""
        SELECT materialSku, materialName, qtyShort, estCost,
               triggerType, triggerRef, triggerLineId,
               resolutionType, resolvedAt, resolvedByPo, resolvedNotes,
               notes, createdAt
        FROM MissingPurchaseLog ORDER BY createdAt DESC
    """)
    rows = cur.fetchall()
    write_table(ws, "Missing Purchase Logs", f"Backup {timestamp_str} · {len(rows)} logs",
        ["Material SKU", "Material Name", "Qty Short", "Est. Cost",
         "Trigger Type", "Trigger Ref", "Trigger Line ID",
         "Resolution Type", "Resolved At", "Resolved By PO", "Resolved Notes",
         "Notes", "Created"],
        [tuple(r) for r in rows],
        money_cols={"Est. Cost"},
        date_cols={"Resolved At", "Created"})

    # === TAB 18: Payments (v1.9.x) ===
    ws = wb.create_sheet("Payments")
    cur.execute("""
        SELECT paymentNumber, date, direction, type,
               linkedId, linkedName, amount, method, reference, status,
               recordedBy, notes, createdAt
        FROM Payment ORDER BY date DESC
    """)
    rows = cur.fetchall()
    write_table(ws, "Payments", f"Backup {timestamp_str} · {len(rows)} payments",
        ["Payment #", "Date", "Direction", "Type",
         "Linked ID", "Linked Name", "Amount", "Method", "Reference", "Status",
         "Recorded By", "Notes", "Created"],
        [tuple(r) for r in rows],
        money_cols={"Amount"},
        date_cols={"Date", "Created"})

    # === TAB 19: Expenses (v1.9.x) ===
    ws = wb.create_sheet("Expenses")
    cur.execute("""
        SELECT expenseNumber, date, category, description, amount,
               vendorPayee, linkedOrder, linkedEvent, paymentMethod,
               notes, createdAt
        FROM Expense ORDER BY date DESC
    """)
    rows = cur.fetchall()
    write_table(ws, "Expenses", f"Backup {timestamp_str} · {len(rows)} expenses",
        ["Expense #", "Date", "Category", "Description", "Amount",
         "Vendor/Payee", "Linked Order", "Linked Event", "Payment Method",
         "Notes", "Created"],
        [tuple(r) for r in rows],
        money_cols={"Amount"},
        date_cols={"Date", "Created"})

    # === TAB 20: Purchase Orders (v1.9.x) ===
    ws = wb.create_sheet("Purchase Orders")
    cur.execute("""
        SELECT poNumber, supplier, status, totalCost, notes, createdAt, updatedAt
        FROM PurchaseOrder ORDER BY createdAt DESC
    """)
    rows = cur.fetchall()
    write_table(ws, "Purchase Orders", f"Backup {timestamp_str} · {len(rows)} POs",
        ["PO #", "Supplier", "Status", "Total Cost", "Notes", "Created", "Updated"],
        [tuple(r) for r in rows],
        money_cols={"Total Cost"},
        date_cols={"Created", "Updated"})

    # === TAB 21: Purchase Order Lines (v1.9.x) ===
    ws = wb.create_sheet("Purchase Order Lines")
    cur.execute("""
        SELECT po.poNumber, pol.materialSku, pol.materialName,
               pol.qtyPacks, pol.costPerPack, pol.lineTotal
        FROM PurchaseOrderLine pol
        JOIN PurchaseOrder po ON pol.poId = po.id
        ORDER BY po.poNumber, pol.materialName
    """)
    rows = cur.fetchall()
    write_table(ws, "Purchase Order Lines", f"Backup {timestamp_str} · {len(rows)} lines",
        ["PO #", "Material SKU", "Material Name", "Qty Packs", "Cost/Pack", "Line Total"],
        [tuple(r) for r in rows],
        money_cols={"Cost/Pack", "Line Total"})

    # === TAB 22: Quotes (v1.9.x) ===
    ws = wb.create_sheet("Quotes")
    cur.execute("""
        SELECT quoteNumber, quoteDate, customerName, status,
               subtotal, discount, discountType, iva, deliveryFee, total,
               depositRequired,
               eventDate, validUntil,
               leadSource, leadSourceDetail, lostReason,
               notes, createdAt
        FROM Quote ORDER BY quoteDate DESC
    """)
    rows = cur.fetchall()
    write_table(ws, "Quotes", f"Backup {timestamp_str} · {len(rows)} quotes",
        ["Quote #", "Quote Date", "Customer Name", "Status",
         "Subtotal", "Discount", "Discount Type", "IVA", "Delivery Fee", "Total",
         "Deposit Required",
         "Event Date", "Valid Until",
         "Lead Source", "Lead Source Detail", "Lost Reason",
         "Notes", "Created"],
        [tuple(r) for r in rows],
        money_cols={"Subtotal", "Discount", "IVA", "Delivery Fee", "Total", "Deposit Required"},
        date_cols={"Quote Date", "Event Date", "Valid Until", "Created"})

    # === TAB 23: Quote Lines (v1.9.x) ===
    ws = wb.create_sheet("Quote Lines")
    cur.execute("""
        SELECT q.quoteNumber, ql.productSku, ql.description,
               ql.qty, ql.unitPrice, ql.lineTotal, ql.notes
        FROM QuoteLine ql
        JOIN Quote q ON ql.quoteId = q.id
        ORDER BY q.quoteNumber, ql.description
    """)
    rows = cur.fetchall()
    write_table(ws, "Quote Lines", f"Backup {timestamp_str} · {len(rows)} lines",
        ["Quote #", "Product SKU", "Description", "Qty", "Unit Price", "Line Total", "Notes"],
        [tuple(r) for r in rows],
        money_cols={"Unit Price", "Line Total"})

    # === TAB 24: Events (v1.9.x) ===
    ws = wb.create_sheet("Events")
    cur.execute("""
        SELECT eventNumber, name, eventDate, status, notes, createdAt
        FROM Event ORDER BY eventDate DESC
    """)
    rows = cur.fetchall()
    write_table(ws, "Events", f"Backup {timestamp_str} · {len(rows)} events",
        ["Event #", "Name", "Event Date", "Status", "Notes", "Created"],
        [tuple(r) for r in rows],
        date_cols={"Event Date", "Created"})

    # === TAB 25: Audit Logs (v1.9.x) ===
    ws = wb.create_sheet("Audit Logs")
    cur.execute("""
        SELECT entityType, entityId, action, fieldName, oldValue, newValue,
               changedBy, changedAt
        FROM AuditLog ORDER BY changedAt DESC
    """)
    rows = cur.fetchall()
    write_table(ws, "Audit Logs", f"Backup {timestamp_str} · {len(rows)} entries",
        ["Entity Type", "Entity ID", "Action", "Field Name",
         "Old Value", "New Value", "Changed By", "Changed At"],
        [tuple(r) for r in rows],
        date_cols={"Changed At"})

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
