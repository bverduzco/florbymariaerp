"""
Generate a draft Excel workbook from the app's SQLite database.
Contains 3 tabs:
  - Orders: one row per order with all order fields (status, payment, delivery, totals)
  - Customers: one row per customer (synced from app's Customers tab)
  - Order Line Items: one row per line item (product × qty) with order ref

This draft is intended to be reviewed by the user, then promoted to be
the official ERP version. It does NOT include the existing Excel's
materials/recipes/products tabs — those would be appended during promotion
(by opening the official Excel and importing the new Orders/Customers
tabs from this draft).

Usage:
    python3 generate_draft.py <input.json> <output.xlsx>

Input JSON shape:
    {
      "orders": [{ orderNumber, status, customerName, ..., lineItems: [...] }, ...],
      "customers": [{ name, phone, email, address, notes }, ...],
      "draftLineItems": [{ orderNumber, productSku, productName, qty, ... }, ...],
      "generatedAt": "2026-..."
    }
"""

import json
import os
import sys
from datetime import datetime, timedelta, timezone

# Mexico City is permanently UTC-6 (no DST since 2022).
# We pin "Generated" timestamps to this zone so they match the user's wall clock.
GMT_MINUS_6 = timezone(timedelta(hours=-6))


def _now_gmt_minus_6_iso() -> str:
    """ISO 8601 timestamp in GMT-6, e.g. '2026-10-23T14:35:00-06:00'."""
    return datetime.now(GMT_MINUS_6).isoformat(timespec="seconds")

from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Border, Side, Alignment
from openpyxl.utils import get_column_letter


HEADER_FILL = PatternFill(fill_type="solid", fgColor="FF2F5233")
HEADER_FONT = Font(name="Arial", size=10.5, bold=True, color="FFFFFFFF")
HEADER_ALIGN = Alignment(horizontal="center", vertical="center", wrap_text=True)

INPUT_FONT = Font(name="Arial", size=11, color="FF000000")
INPUT_FILL = PatternFill(fill_type="solid", fgColor="FFFFF8E0")
THIN = Side(border_style="thin", color="FF000000")
BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)

TITLE_FONT = Font(name="Arial", size=14, bold=True, color="FF1F3B4D")
SUBTITLE_FONT = Font(name="Arial", size=10, italic=True, color="FF6B8E6B")


def style_header(cell, value):
    cell.value = value
    cell.font = HEADER_FONT
    cell.fill = HEADER_FILL
    cell.alignment = HEADER_ALIGN
    cell.border = BORDER


def style_input(cell, fmt="General"):
    cell.font = INPUT_FONT
    cell.fill = INPUT_FILL
    cell.border = BORDER
    cell.number_format = fmt


def build_orders_tab(ws, orders):
    ws.column_dimensions["A"].width = 14
    for col_letter in ["B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S"]:
        ws.column_dimensions[col_letter].width = 14
    ws.column_dimensions["R"].width = 30
    ws.column_dimensions["S"].width = 30

    ws["A1"] = "Orders — Draft Export (from app database)"
    ws["A1"].font = TITLE_FONT
    ws["A2"] = f"Generated {_now_gmt_minus_6_iso()} (GMT-6)"
    ws["A2"].font = SUBTITLE_FONT

    headers = [
        "Order #", "Status", "Customer", "Delivery Date", "Delivery Address",
        "Card Message", "Delivery Notes", "Internal Notes",
        "Subtotal (pre-IVA)", "IVA (16%)", "Delivery Fee", "Discount", "Total Due",
        "Payment Method", "Payment Status", "Payment Confirmed At", "Payment Reference",
        "Quote Sent At", "Internal/Procurement timestamps",
    ]
    for i, h in enumerate(headers, start=1):
        style_header(ws.cell(row=4, column=i), h)

    for r, o in enumerate(orders, start=5):
        subtotal = sum(li["lineTotal"] for li in o.get("lineItems", []))
        iva = subtotal * 0.16
        delivery_fee = o.get("deliveryFee") or 0
        discount = o.get("discount") or 0
        total = subtotal + iva + delivery_fee - discount

        row = [
            o.get("orderNumber", ""),
            o.get("status", ""),
            o.get("customerName", ""),
            o.get("deliveryDate", ""),
            o.get("deliveryAddress", ""),
            o.get("cardMessage", ""),
            o.get("deliveryNotes", ""),
            o.get("internalNotes", ""),
            subtotal,
            iva,
            delivery_fee,
            discount,
            total,
            o.get("paymentMethod", ""),
            o.get("paymentStatus", ""),
            o.get("paymentConfirmedAt", ""),
            o.get("paymentReference", ""),
            o.get("quoteSentAt", ""),
            f"procurement: {o.get('procurementStartedAt', '')} | produced: {o.get('producedAt', '')} | delivered: {o.get('deliveredAt', '')} | fulfilled: {o.get('fulfilledAt', '')}",
        ]
        for c, val in enumerate(row, start=1):
            cell = ws.cell(row=r, column=c, value=val)
            cell.font = INPUT_FONT
            cell.border = BORDER
            if c in (9, 10, 11, 12, 13):
                cell.number_format = '"$"#,##0.00'


def build_customers_tab(ws, customers):
    ws.column_dimensions["A"].width = 14
    for col_letter in ["B", "C", "D", "E", "F", "G"]:
        ws.column_dimensions[col_letter].width = 24
    ws.column_dimensions["G"].width = 40

    ws["A1"] = "Customers — Draft Export (from app database)"
    ws["A1"].font = TITLE_FONT
    ws["A2"] = f"Generated {_now_gmt_minus_6_iso()} (GMT-6)"
    ws["A2"].font = SUBTITLE_FONT

    headers = ["Customer ID", "Name", "Phone", "Email", "Address", "Notes", "Created At"]
    for i, h in enumerate(headers, start=1):
        style_header(ws.cell(row=4, column=i), h)

    for r, c in enumerate(customers, start=5):
        row = [
            c.get("id", ""),
            c.get("name", ""),
            c.get("phone", ""),
            c.get("email", ""),
            c.get("address", ""),
            c.get("notes", ""),
            c.get("createdAt", ""),
        ]
        for col_idx, val in enumerate(row, start=1):
            cell = ws.cell(row=r, column=col_idx, value=val)
            cell.font = INPUT_FONT
            cell.border = BORDER


def build_line_items_tab(ws, line_items):
    ws.column_dimensions["A"].width = 14
    for col_letter in ["B", "C", "D", "E", "F", "G", "H", "I", "J", "K"]:
        ws.column_dimensions[col_letter].width = 18

    ws["A1"] = "Order Line Items — Draft Export (from app database)"
    ws["A1"].font = TITLE_FONT
    ws["A2"] = f"Generated {_now_gmt_minus_6_iso()} (GMT-6)"
    ws["A2"].font = SUBTITLE_FONT

    headers = [
        "Order #", "Customer Name", "Product SKU", "Product Name", "Size",
        "Qty", "Unit Price (pre-IVA)", "Line Total (pre-IVA)",
        "Delivery Date", "Order Status",
    ]
    for i, h in enumerate(headers, start=1):
        style_header(ws.cell(row=4, column=i), h)

    for r, li in enumerate(line_items, start=5):
        row = [
            li.get("orderNumber", ""),
            li.get("customerName", ""),
            li.get("productSku", ""),
            li.get("productName", ""),
            li.get("productSize", ""),
            li.get("qty", 0),
            li.get("unitPrice", 0),
            li.get("lineTotal", 0),
            li.get("deliveryDate", ""),
            li.get("status", ""),
        ]
        for c, val in enumerate(row, start=1):
            cell = ws.cell(row=r, column=c, value=val)
            cell.font = INPUT_FONT
            cell.border = BORDER
            if c in (7, 8):
                cell.number_format = '"$"#,##0.00'


def main():
    if len(sys.argv) != 3:
        print(f"Usage: python3 {sys.argv[0]} <input.json> <output.xlsx>", file=sys.stderr)
        sys.exit(1)

    input_path = sys.argv[1]
    output_path = sys.argv[2]

    if not os.path.exists(input_path):
        print(f"Input JSON not found: {input_path}", file=sys.stderr)
        sys.exit(1)

    with open(input_path, encoding="utf-8") as f:
        data = json.load(f)

    wb = Workbook()

    # Remove default sheet
    default = wb.active
    wb.remove(default)

    # Build tabs
    ws_orders = wb.create_sheet("Orders")
    build_orders_tab(ws_orders, data.get("orders", []))

    ws_customers = wb.create_sheet("Customers")
    build_customers_tab(ws_customers, data.get("customers", []))

    ws_lines = wb.create_sheet("Order Line Items")
    build_line_items_tab(ws_lines, data.get("draftLineItems", []))

    # Set workbook metadata
    wb.properties.creator = "Flor by Maria app"
    wb.properties.title = "ERP Draft"
    wb.properties.description = (
        f"Auto-generated draft export from the app database on "
        f"{data.get('generatedAt', _now_gmt_minus_6_iso())}. "
        "Review this file, then promote to be the official ERP version."
    )

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    wb.save(output_path)

    print(f"Draft Excel written to: {output_path}")
    print(f"  Orders: {len(data.get('orders', []))}")
    print(f"  Customers: {len(data.get('customers', []))}")
    print(f"  Line items: {len(data.get('draftLineItems', []))}")


if __name__ == "__main__":
    main()
