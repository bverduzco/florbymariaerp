"""
generate_erp_workbook.py — Format-preserving ERP workbook exporter.

Regenerates the "ERP Zai vX.Y.xlsx" operational workbook lineage FROM the live
SQLite database, using the last committed workbook (ERP Zai v1.8.2) as a
template so that formulas, Dashboard, Assumptions, Invoice, styling, and
Version History are all preserved. The DB is the system of record; the
workbook is regenerated from it — never the other way around.

Design rules (do not break them):
  1. INPUT columns get values from the DB.
  2. FORMULA columns (Unit Cost, Line Total, LTV, payment status, ...) are
     re-emitted as translated formulas row-by-row — never as values — so the
     workbook keeps working as a spreadsheet when Maria edits it.
  3. PRESERVE columns (typed only in Excel, unknown to the DB — e.g. Materials
     "Type", Products "Labor (min)", Customers "Referrer ID") are carried over
     from the template, matched by the sheet's key column(s).
  4. MERGE mode: template rows whose key is absent from the DB (supplier price
     history, stock movements, sample rows) are appended after the DB rows so
     the workbook never loses data the DB hasn't imported yet.
  5. Trailing SUM total rows (Payments, Losses, Expenses) are re-emitted with
     their range re-pointed to the new data extent.
  6. DB tables that postdate the template (Custom Recipes, Audit Log, Loan
     Records, ...) are appended as new tabs in the same visual style. Future
     features (e.g. the Waste Log) get added the same way — see NEW_SHEETS.

Usage:
    python3 scripts/generate_erp_workbook.py [--version v1.9.5]
        [--template public/erp-zai-v1_8_2.xlsx] [--db db/custom.db]
        [--out "data/ERP Zai v1.9.5.xlsx"] [--dry-run]

Lookup-range limits inherited from the template (extend the template if
exceeded): Materials <=250, Products <=60, Orders <=500, Customers/Quotes <=300.
"""

import argparse
import copy
import re
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path

from openpyxl import load_workbook
from openpyxl.utils import get_column_letter, column_index_from_string

ROOT = Path(__file__).resolve().parent.parent
EPOCH_MS = 10_000_000_000  # ints above this are epoch-ms timestamps (1e10 ms = Apr 1970)
ISO_DT_RE = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}")
EXCEL_CELL_CAP = 32000
VERSION_HISTORY_SHEET = "Version History"

# ---------------------------------------------------------------------------
# Sheet mapping configuration
# ---------------------------------------------------------------------------

SHEETS = {
    "Materials": {
        "model": "Material", "order_by": "sku",
        "key_cols": ["A"], "merge_key": ["A"],
        "inputs": {"A": "sku", "B": "name", "C": "category", "F": "supplier",
                   "H": "reorderLevelPacks", "I": "reorderQtyPacks",
                   "N": "colors", "O": "notes", "Q": "supplier"},
    },
    "Suppliers": {
        "model": "Supplier", "order_by": "name",
        "key_cols": ["A"], "merge_key": ["A"],
        "inputs": {"A": "name", "B": "contactPerson", "C": "phone", "D": "email",
                   "E": "leadTimeDays", "F": "paymentTerms", "G": "notes"},
    },
    "Supplier Prices": {
        "model": "SupplierPrice", "order_by": "date, materialSku",
        "key_cols": ["A", "B", "C"], "merge_key": ["A", "B", "C"],
        "inputs": {"A": "date", "B": "materialSku", "C": "supplierName",
                   "D": "packPrice", "E": "unitsPerPack", "F": "isLatest",
                   "G": "notes", "H": "sourceRowKey"},
        "yes_no": ["F"],
    },
    "Recipes": {
        "model": "RecipeLine", "order_by": "productSku, rowid",
        "key_cols": ["A", "B"], "merge_key": ["A", "B"],
        "inputs": {"A": "productSku", "B": "componentSku", "D": "qty",
                   "I": "color", "K": "notes"},
    },
    "Products": {
        "model": "Product", "order_by": "sku",
        "key_cols": ["A"], "merge_key": ["A"],
        "inputs": {"A": "sku", "B": "name", "C": "category", "D": "size",
                   "R": "actualPriceBeforeIva"},
    },
    "Customers": {
        "model": "Customer", "order_by": "createdAt",
        "key_cols": ["A"], "merge_key": ["A"],
        "inputs": {"A": "id", "B": "name", "C": "phone", "D": "email",
                   "E": "address", "F": "notes", "N": "status", "Q": "createdAt"},
    },
    "Quotes": {
        "model": "Quote", "order_by": "quoteNumber",
        "key_cols": ["A"], "merge_key": ["A"],
        "sql": ("SELECT q.quoteNumber, q.quoteDate, q.customerId, q.eventType, "
                "q.eventDate, q.status, q.validUntil, "
                "COALESCE(o.orderNumber, q.linkedOrderId) AS linkedOrderId, "
                "q.lostReason, q.leadSource, q.leadSourceDetail, q.notes, "
                "q.sourceRowKey, q.deliveryFee, q.discount, q.discountType, "
                "q.paymentRule, q.rowid AS rowid "
                "FROM Quote q LEFT JOIN \"Order\" o ON q.orderId = o.id"),
        "inputs": {"A": "quoteNumber", "B": "quoteDate", "C": "customerId",
                   "E": "eventType", "F": "eventDate", "G": "status",
                   "H": "validUntil", "M": "linkedOrderId", "N": "lostReason",
                   "O": "leadSource", "P": "notes", "Q": "sourceRowKey"},
        "extra": {"Delivery Fee": "deliveryFee", "Discount": "discount",
                  "Discount Type": "discountType", "Payment Rule": "paymentRule",
                  "Lead Source Detail": "leadSourceDetail"},
    },
    "Quote Lines": {
        "model": "QuoteLine", "order_by": "q.quoteNumber, l.lineNumber",
        "key_cols": ["A", "B"], "merge_key": ["A", "B"],
        "sql": ("SELECT q.quoteNumber, l.lineNumber, l.productSku, l.description, "
                "l.qty, l.unitPrice, l.notes, l.sourceRowKey, "
                "l.rowid AS rowid FROM QuoteLine l "
                "JOIN Quote q ON l.quoteId = q.id"),
        "inputs": {"A": "quoteNumber", "B": "lineNumber", "C": "productSku",
                   "E": "qty", "F": "unitPrice", "H": "notes", "I": "sourceRowKey"},
        "desc_fallback": {"D": ("productSku", "description")},
    },
    "Orders": {
        "model": "OrderLineItem", "order_by": "o.orderNumber, li.rowid",
        "key_cols": ["A"], "merge_key": ["A", "E", "F"],
        "sql": ("SELECT o.orderNumber, o.createdAt, o.customerId, "
                "li.productSku, li.qty, o.status, o.deliveryDate, o.deliveryFee, "
                "o.deliveryAddress, o.cardMessage, li.unitPrice, "
                "(SELECT q.quoteNumber FROM Quote q WHERE q.orderId = o.id "
                " LIMIT 1) AS quoteId, "
                "li.productSize, o.discount, o.discountType, "
                "o.paymentMethod, li.rowid AS rowid "
                "FROM OrderLineItem li JOIN \"Order\" o ON li.orderId = o.id"),
        "inputs": {"A": "orderNumber", "B": "createdAt", "C": "customerId",
                   "E": "productSku", "F": "qty", "K": "status",
                   "L": "deliveryDate", "V": "deliveryAddress", "W": "cardMessage"},
        "first_line_only": {"M": "deliveryFee"},
        "extra": {"Product Size": "productSize",
                  "Discount": "discount", "Discount Type": "discountType",
                  "Payment Method": "paymentMethod"},
        "quote_id_col": "S",
    },
    "Events": {
        "model": "Event", "order_by": "eventNumber",
        "key_cols": ["A"], "merge_key": ["A"],
        "inputs": {"A": "eventNumber", "B": "name", "C": "customerId",
                   "E": "eventDate", "F": "guests", "L": "status"},
    },
    "Event Line Items": {
        "model": "EventLineItem", "order_by": "rowid",
        "key_cols": ["A"], "merge_key": ["A", "B"],
        "sql": ("SELECT ev.eventNumber, l.productSku, l.qty, l.unitPrice, "
                "l.legacyLineKey, l.sourceRowKey, l.rowid AS rowid "
                "FROM EventLineItem l JOIN Event ev ON l.eventId = ev.id"),
        "inputs": {"A": "eventNumber", "B": "productSku", "D": "qty",
                   "J": "legacyLineKey", "K": "sourceRowKey"},
        "desc_fallback": {"E": ("productSku", "unitPrice")},
    },
    "Execution Logs": {
        "model": "ExecutionLog", "order_by": "executedAt, rowid",
        "key_cols": ["A"], "merge_key": ["A"],
        "sql": ("SELECT e.executionNumber, ev.eventNumber AS eventId, "
                "e.eventLineItemKey, e.executedAt, e.executedBy, e.status, "
                "e.estimatedCost, e.actualCost, e.quotedPrice, e.priceAdjustment, "
                "e.marginDollars, e.marginPct, e.notes, e.sourceRowKey, "
                "e.paymentStatus, e.startedAt, e.completedAt, e.durationMinutes, "
                "e.rowid AS rowid FROM ExecutionLog e "
                "LEFT JOIN Event ev ON e.eventId = ev.id"),
        "inputs": {"A": "executionNumber", "B": "eventId", "C": "eventLineItemKey",
                   "D": "executedAt", "E": "executedBy", "F": "status",
                   "G": "estimatedCost", "H": "actualCost", "I": "quotedPrice",
                   "J": "priceAdjustment", "K": "marginDollars", "L": "marginPct",
                   "M": "notes", "N": "sourceRowKey"},
        "extra": {"Payment Status": "paymentStatus", "Started At": "startedAt",
                  "Completed At": "completedAt", "Duration (min)": "durationMinutes"},
    },
    "Execution Log Lines": {
        "model": "ExecutionLogLine", "order_by": "e.executionNumber, l.rowid",
        "key_cols": ["A", "L"], "merge_key": ["A", "B", "D"],
        "sql": ("SELECT e.executionNumber, l.materialSku, l.materialName, "
                "l.qtyUsed, l.unit, l.unitCost, l.lineCost, l.type, "
                "l.originalMaterialSku, l.originalQty, l.notes, l.sourceRowKey, "
                "l.costBasis, l.color, l.variant, l.rowid AS rowid "
                "FROM ExecutionLogLine l JOIN ExecutionLog e "
                "ON l.executionLogId = e.id"),
        "inputs": {"A": "executionNumber", "B": "materialSku", "C": "materialName",
                   "D": "qtyUsed", "E": "unit", "F": "unitCost", "H": "type",
                   "I": "originalMaterialSku", "J": "originalQty", "K": "notes",
                   "L": "sourceRowKey"},
        "value_instead_of_formula": {"G": "lineCost"},
        "extra": {"Cost Basis": "costBasis", "Color": "color", "Variant": "variant"},
    },
    "Purchase Orders": {
        "model": "PurchaseOrderLine", "order_by": "po.poNumber, l.rowid",
        "key_cols": ["A"], "merge_key": ["A", "D", "F"],
        "sql": ("SELECT po.poNumber, po.createdAt, po.supplier, l.materialSku, "
                "l.materialName, l.qtyPacks, l.costPerPack, po.status, l.rowid AS rowid "
                "FROM PurchaseOrderLine l JOIN PurchaseOrder po ON l.poId = po.id"),
        "inputs": {"A": "poNumber", "B": "createdAt", "C": "supplier",
                   "D": "materialSku", "E": "materialName", "F": "qtyPacks",
                   "G": "costPerPack", "J": "status"},
    },
    "Ad-hoc Purchases": {
        "model": "AdHocPurchase", "order_by": "date",
        "key_cols": ["A"], "merge_key": ["A"],
        "inputs": {"A": "adhocNumber", "B": "date", "C": "vendor",
                   "D": "materialSku", "E": "qtyPacks", "F": "unitCost",
                   "H": "ticketNumber", "I": "paymentMethod", "J": "notes",
                   "K": "sourceRowKey"},
        "extra": {"Color": "color", "Variant": "variant"},
    },
    "Expenses": {
        "model": "Expense", "order_by": "date",
        "key_cols": ["A"], "merge_key": ["A"],
        "inputs": {"A": "expenseNumber", "B": "date", "C": "category",
                   "D": "description", "E": "amount", "F": "vendorPayee",
                   "G": "linkedOrder", "H": "linkedEvent", "I": "paymentMethod",
                   "J": "notes", "K": "sourceRowKey"},
    },
    "Payments": {
        "model": "Payment", "order_by": "date, rowid",
        "key_cols": ["A"], "merge_key": ["A"],
        "inputs": {"A": "paymentNumber", "B": "date", "C": "direction", "D": "type",
                   "E": "linkedId", "F": "linkedName", "G": "amount", "H": "method",
                   "I": "reference", "J": "status", "K": "recordedBy",
                   "L": "notes", "M": "sourceRowKey"},
    },
    "Stock Movements": {
        "model": "StockMovement", "order_by": "date",
        "key_cols": ["A", "B", "C"], "merge_key": ["A", "B", "C"],
        "inputs": {"A": "date", "B": "materialSku", "C": "packs", "D": "reason",
                   "E": "reference", "F": "notes", "G": "sourceRowKey"},
    },
    "Losses": {
        "model": "Loss", "order_by": "date",
        "key_cols": ["A"], "merge_key": ["A"],
        "inputs": {"A": "lossNumber", "B": "date", "C": "materialSku",
                   "D": "qtyLostPacks", "E": "reason", "F": "discoveredBy",
                   "H": "notes", "I": "sourceRowKey"},
    },
    "Blocked Dates": {
        "model": "BlockedDate", "order_by": "date",
        "key_cols": ["A"], "merge_key": ["A"],
        "inputs": {"A": "date", "B": "reason", "C": "notes", "D": "blockedBy",
                   "E": "sourceRowKey"},
    },
    "SeasonMarkers": {
        "model": "SeasonMarker", "order_by": "startDate",
        "key_cols": ["A"], "merge_key": ["A"],
        "inputs": {"A": "markerId", "B": "name", "C": "type", "D": "startDate",
                   "E": "endDate", "F": "color", "G": "intensity",
                   "H": "recurrence", "I": "recurrenceRule", "J": "description"},
    },
    "Capacity Days": {
        "model": "CapacityDay", "order_by": "date",
        "key_cols": ["A"], "merge_key": ["A"],
        "inputs": {"A": "date", "C": "isWorkingDay", "D": "isProcurementDay",
                   "E": "minutesAvailable", "F": "minutesUsed",
                   "H": "coolerSlotsAvailable", "I": "coolerSlotsUsed", "J": "notes"},
        "value_instead_of_formula": {"G": "utilizationPct"},
    },
    "Tools & Equipment": {
        "model": "Tool", "order_by": "sku",
        "key_cols": ["A"], "merge_key": ["A"],
        "inputs": {"A": "sku", "B": "itemName", "C": "category", "D": "qty",
                   "E": "condition", "F": "location", "G": "datePurchased",
                   "H": "purchasedFrom", "I": "purchaseCost", "J": "lastServiced",
                   "K": "notes"},
    },
    "Recipe Versions": {
        "model": "RecipeVersion", "order_by": "productSku, version",
        "key_cols": ["A", "B"], "merge_key": ["A", "B"],
        "inputs": {"A": "productSku", "B": "version", "C": "effectiveFrom",
                   "D": "status", "E": "notes", "F": "sourceRowKey"},
    },
    "Material Availability": {
        "model": "MaterialAvailability", "order_by": "materialSku",
        "key_cols": ["A", "B"], "merge_key": ["A", "B"],
        "inputs": {"A": "materialSku", "B": "availableFrom", "C": "availableUntil",
                   "D": "status", "E": "source", "F": "notes"},
    },
    "Material Substitution": {
        "model": "MaterialSubstitution", "order_by": "materialSku, priority",
        "key_cols": ["A", "B"], "merge_key": ["A", "B"],
        "inputs": {"A": "materialSku", "B": "substituteSku", "C": "priority",
                   "D": "accepted", "E": "notes"},
    },
    "Workbook Settings": {
        "model": "WorkbookSetting", "order_by": "section, key",
        "key_cols": ["A"], "merge_key": ["A"],
        "inputs": {"A": "key", "B": "section", "C": "value", "D": "notes"},
    },
    "Staff": {
        "model": "Staff", "order_by": "staffNumber",
        "key_cols": ["A"], "merge_key": ["A"],
        "inputs": {"A": "staffNumber", "B": "name", "C": "shortName", "D": "phone",
                   "E": "email", "F": "type", "G": "skills", "H": "payRate",
                   "I": "notes", "J": "active", "K": "dateAdded"},
    },
    "Legal Templates": {
        "model": "LegalTemplate", "order_by": "templateNumber",
        "key_cols": ["A"], "merge_key": ["A"],
        "inputs": {"A": "templateNumber", "B": "name", "C": "appliesTo",
                   "D": "trigger", "E": "templateText", "F": "placeholdersNeeded",
                   "G": "version", "H": "lastUpdated"},
    },
    "Ribbon Properties": {
        "model": "RibbonProperty", "order_by": "sku",
        "key_cols": ["A"], "merge_key": ["A"],
        "inputs": {"A": "sku", "B": "brand", "C": "color", "D": "colorCode",
                   "E": "widthCm", "F": "lengthM", "G": "fabric", "H": "printSolid"},
    },
    "Paper Properties": {
        "model": "PaperProperty", "order_by": "sku",
        "key_cols": ["A"], "merge_key": ["A"],
        "inputs": {"A": "sku", "B": "size", "C": "sheetsPerPack", "D": "waterproof",
                   "E": "printSolid", "F": "color", "G": "edge",
                   "H": "straightCurvy", "I": "translucent", "J": "shinyMatte",
                   "K": "occasion"},
    },
}

# Sheets left untouched: Dashboard, README, Assumptions, Invoice, Menu,
# Supplier Comparison, Order Schedule, Contact Types, Template Variables,
# v1.3 Schema Changes. Version History gets an appended entry below.

# DB tables with no template sheet → new tabs, house style, plain data.
# Future features (Waste Log, etc.) are added here the same way.
NEW_SHEETS = {
    "Stock Adjustments": ("StockAdjustment",
                          ["materialSku", "deltaPacks", "reason", "notes", "createdAt"], None),
    "Custom Materials": ("CustomMaterial",
                         ["name", "type", "class", "source", "erpSku", "erpName",
                          "pricePerStem", "matchScore", "matchConfidence"], None),
    "Custom Recipes": ("CustomRecipe",
                       ["name", "size", "description", "flowersCost",
                        "otherMaterialsCost", "totalCost", "suggestedPrice",
                        "actualPrice", "erpProductSku", "hidden"], None),
    "Custom Recipe Lines": ("CustomRecipeLine",
                            ["r.name", "l.materialName", "l.qty", "l.materialPrice",
                             "l.materialType"],
                            "FROM CustomRecipeLine l JOIN CustomRecipe r "
                            "ON l.customRecipeId = r.id ORDER BY r.name, l.rowid"),
    "Customer Notes": ("CustomerNote",
                       ["c.name", "n.channel", "n.direction", "n.subject", "n.body",
                        "n.followUpDate", "n.followUpDone", "n.recordedBy", "n.createdAt"],
                       "FROM CustomerNote n JOIN Customer c ON n.customerId = c.id "
                       "ORDER BY n.createdAt"),
    "Quote Reminders": ("QuoteReminder",
                        ["q.quoteNumber", "r.remindAt", "r.note", "r.done"],
                        "FROM QuoteReminder r JOIN Quote q ON r.quoteId = q.id "
                        "ORDER BY r.remindAt"),
    "Loan Records": ("LoanRecord",
                     ["loanNumber", "itemName", "description", "owner", "qty",
                      "dateBorrowed", "datePromised", "dateReturned", "notes"], None),
    "Missing Purchase Logs": ("MissingPurchaseLog",
                              ["materialSku", "materialName", "qtyShort", "estCost",
                               "triggerType", "triggerRef", "resolutionType",
                               "resolvedAt", "resolvedByPo", "resolvedNotes", "notes"], None),
    "Wiki Articles": ("WikiArticle",
                      ["slug", "title", "category", "tags", "pinned", "createdBy",
                       "createdAt"], None),
    "Audit Log": ("AuditLog",
                  ["entityType", "entityId", "action", "fieldName", "oldValue",
                   "newValue", "changedBy", "changedAt"], None),
    "Shopping Lists": ("ShoppingList",
                       ["slNumber", "weekStartDate", "status", "itemsToBuyCount",
                        "totalToBuyPacks", "totalCost", "materialCount",
                        "supplierCount", "generatedAt"], None),
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def to_xl(value, yes_no=False):
    """Normalize a DB value for a worksheet cell."""
    if value is None:
        return None
    if isinstance(value, bytes):
        return value.decode("utf-8", "replace")
    if isinstance(value, int) and value > EPOCH_MS:
        return datetime.fromtimestamp(value / 1000, tz=timezone.utc).replace(tzinfo=None)
    if isinstance(value, str):
        if ISO_DT_RE.match(value):
            try:
                dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
                return dt.replace(tzinfo=None)
            except ValueError:
                pass
        return value
    if yes_no:
        return "yes" if value in (1, True, "yes", "TRUE", True) else ""
    if isinstance(value, bool):
        return "TRUE" if value else "FALSE"
    if isinstance(value, str) and len(value) > EXCEL_CELL_CAP:
        return value[:EXCEL_CELL_CAP] + "…[truncated]"
    return value


ROWREF_RE = re.compile(r"(?<![A-Za-z0-9_/])(\$?[A-Z]{1,2})(\$?)(\d+)(?!\d)")


def translate_row(formula: str, src_row: int, dst_row: int) -> str:
    """Shift row-relative cell references ($A5 -> $A9, F5 -> F9) in a formula,
    leaving absolute-row refs ($A$5) and absolute ranges untouched."""
    if src_row == dst_row:
        return formula

    def repl(m):
        col, abs_mark, row = m.group(1), m.group(2), int(m.group(3))
        if abs_mark == "$":
            return m.group(0)  # absolute row reference — keep
        return f"{col}{dst_row}"

    return ROWREF_RE.sub(repl, formula)


def retranslate_total(formula: str, last_data_row: int) -> str:
    """Re-point a trailing SUM range's end (e.g. =SUM(G5:G9) -> =SUM(G5:G{end}))."""
    return re.sub(r":([A-Za-z$]+)\$?\d+", rf":\g<1>{last_data_row}", formula, count=1)


def detect_header_row(ws):
    for r in range(1, min(ws.max_row, 10) + 1):
        vals = [c.value for c in ws[r]]
        if len([v for v in vals if v not in (None, "")]) >= 2:
            return r
    return 4


def is_sum_total(cell_value):
    return (isinstance(cell_value, str) and cell_value.startswith("=")
            and re.search(r"SUM\(", cell_value) and ":" in cell_value
            and cell_value.count("(") == 1)


def copy_cell_style(src_cell, dst_cell):
    dst_cell._style = copy.copy(src_cell._style)


def eff_key(cfg_keys, inputs):
    """Key columns that actually map to DB fields (used for preserve + merge)."""
    return [cl for cl in cfg_keys if cl in inputs]


# ---------------------------------------------------------------------------
# Per-sheet export
# ---------------------------------------------------------------------------

def export_sheet(ws, cfg, cur, report, version):
    hdr = detect_header_row(ws)
    first = hdr + 1
    last = ws.max_row

    # ---- classify columns --------------------------------------------------
    formula_cols, total_cells = {}, []   # formula_cols: letter -> ref row
    value_cols = {}
    for row in ws.iter_rows(min_row=first, max_row=last):
        for c in row:
            v = c.value
            if isinstance(v, str) and v.startswith("="):
                if is_sum_total(v):
                    total_cells.append((c.column_letter, c.row, v))
                elif c.column_letter not in formula_cols:
                    formula_cols[c.column_letter] = c.row
                continue
            if c.column_letter in formula_cols:
                continue
            if v not in (None, "") and c.column_letter not in value_cols:
                value_cols[c.column_letter] = c.row

    inputs = cfg["inputs"]
    total_cols = {t[0] for t in total_cells}
    total_rows = sorted({t[1] for t in total_cells})
    preserve_cols = [cl for cl in value_cols
                     if cl not in inputs and cl not in total_cols]

    # ---- capture formulas + preserve values BEFORE clearing ------------------
    formula_texts = {cl: ws[f"{cl}{frow}"].value for cl, frow in formula_cols.items()}
    key_cols = eff_key(cfg["key_cols"], inputs)
    merge_key_cols = eff_key(cfg.get("merge_key", cfg["key_cols"]), inputs)

    preserve_map = {}
    template_rows = []  # (key_tuple, {col: value}) for merge mode
    # Only rows ABOVE the first trailing total row are merge candidates —
    # the total row itself and any trailing notes rows are not data.
    merge_cutoff = min(total_rows) - 1 if total_rows else last
    for r in range(first, merge_cutoff + 1):
        key_vals = [ws[f"{cl}{r}"].value for cl in key_cols]
        # Skip rows whose key cell holds long prose — those are trailing
        # documentation notes, not data rows.
        if any(isinstance(v, str) and len(v) > 60 for v in key_vals):
            continue
        key = tuple(str(v) for v in key_vals)
        if all(ws[f"{cl}{r}"].value in (None, "") for cl in key_cols):
            continue
        tvals = {cl: ws[f"{cl}{r}"].value for cl in
                 set(preserve_cols) | set(inputs)}
        if any(v not in (None, "") for v in
               {cl: tvals[cl] for cl in preserve_cols}.values()):
            preserve_map.setdefault(key, tvals)
        template_rows.append((tuple(str(ws[f"{cl}{r}"].value)
                                    for cl in merge_key_cols), tvals))

    # total-row snapshots (label cells etc.)
    total_row_snapshots = {r: {c.column_letter: c.value
                               for c in ws[r] if c.value is not None}
                           for r in total_rows}

    # ---- clear the data region (values only; styles/widths stay) -------------
    for row in ws.iter_rows(min_row=first, max_row=last):
        for c in row:
            if c.value is not None:
                c.value = None

    # ---- fetch DB rows -------------------------------------------------------
    sql = cfg.get("sql") or f'SELECT *, rowid AS rowid FROM "{cfg["model"]}"'
    if cfg.get("order_by") and "ORDER BY" not in sql:
        sql += f" ORDER BY {cfg['order_by']}"
    db_rows = [dict(r) for r in cur.execute(sql)]

    # ---- merge: template rows missing from the DB ----------------------------
    db_keys = {tuple(str(row.get(inputs[cl])) for cl in merge_key_cols)
               for row in db_rows}
    merged = []
    for key, tvals in template_rows:
        if key in db_keys or key == tuple("None" for _ in merge_key_cols):
            continue
        row_data = {inputs[cl]: tvals.get(cl) for cl in inputs}
        merged.append(row_data)

    rows = db_rows + merged

    # ---- write rows ------------------------------------------------------------
    for i, data in enumerate(rows):
        r_out = first + i
        if r_out > last:  # beyond template: clone styles from first data row
            for cl_idx in range(1, ws.max_column + 1):
                dst = ws.cell(row=r_out, column=cl_idx)
                copy_cell_style(ws.cell(row=first, column=cl_idx), dst)

        for cl, field in inputs.items():
            cell = ws[f"{cl}{r_out}"]
            val = to_xl(data.get(field), yes_no=cl in cfg.get("yes_no", []))
            cell.value = val
            if isinstance(val, datetime) and cell.number_format in ("General", "@"):
                cell.number_format = "dd/mm/yyyy"

        for cl, field in (cfg.get("first_line_only") or {}).items():
            prev = rows[i - 1] if i else None
            key_field = inputs["A"]
            if prev is None or prev.get(key_field) != data.get(key_field):
                ws[f"{cl}{r_out}"].value = to_xl(data.get(field))

        for cl in formula_cols:
            if cl in (cfg.get("value_instead_of_formula") or {}):
                ws[f"{cl}{r_out}"].value = to_xl(
                    data.get(cfg["value_instead_of_formula"][cl]))
                continue
            ws[f"{cl}{r_out}"].value = translate_row(
                formula_texts[cl], formula_cols[cl], r_out)

        for cl, (sku_field, fallback_field) in (cfg.get("desc_fallback") or {}).items():
            if not data.get(sku_field):
                ws[f"{cl}{r_out}"].value = to_xl(data.get(fallback_field))

        key = tuple(str(data.get(inputs[cl])) for cl in key_cols)
        carried = preserve_map.get(key, {})
        for cl in preserve_cols:
            ws[f"{cl}{r_out}"].value = carried.get(cl)

        if cfg.get("quote_id_col"):
            ws[f"{cfg['quote_id_col']}{r_out}"].value = to_xl(data.get("quoteId"))

    # ---- new columns appended right of the last template column ---------------
    if cfg.get("extra") and rows:
        all_cols = list(inputs) + list(formula_cols) + preserve_cols + list(total_cols)
        last_col_idx = max(column_index_from_string(cl) for cl in all_cols)
        col = last_col_idx + 1
        for title, field in cfg["extra"].items():
            hc = ws.cell(row=hdr, column=col)
            hc.value = title
            copy_cell_style(ws.cell(row=hdr, column=last_col_idx), hc)
            for i, data in enumerate(rows):
                c = ws.cell(row=first + i, column=col)
                c.value = to_xl(data.get(field))
                copy_cell_style(ws.cell(row=first, column=last_col_idx), c)
            ws.column_dimensions[get_column_letter(col)].width = max(12, len(title) + 4)
            col += 1

    # ---- trailing totals -------------------------------------------------------
    if total_cells and rows:
        r_tot = first + len(rows)
        for cl, frow, f in total_cells:
            cell = ws[f"{cl}{r_tot}"]
            cell.value = retranslate_total(f, first + len(rows) - 1)
            copy_cell_style(ws.cell(row=frow, column=column_index_from_string(cl)), cell)
            snap = total_row_snapshots.get(frow, {})
            for other_cl, other_v in snap.items():
                if other_cl != cl and ws[f"{other_cl}{r_tot}"].value is None:
                    ws[f"{other_cl}{r_tot}"].value = other_v

    kind = f" (+{len(merged)} merged from template)" if merged else ""
    report.append(f"{ws.title}: {len(db_rows)} DB rows{kind}; "
                  f"formulas kept in {len(formula_cols)} cols, "
                  f"preserved {len(preserve_cols)} cols")


def export_new_sheet(wb, tab, spec, cur, version):
    table, cols, join = spec
    select = ", ".join(cols)
    sql = f"SELECT {select} {join}" if join else f'SELECT {select} FROM "{table}"'
    rows = [dict(r) for r in cur.execute(sql)]

    style_src = wb["Stock Movements"]
    ws = wb.create_sheet(title=tab)
    t = ws.cell(row=1, column=1, value=tab)
    t.font = copy.copy(style_src.cell(row=1, column=1).font)
    note = ws.cell(row=2, column=1,
                   value=f"New in {version} — exported from the app database "
                         f"(no equivalent tab existed in v1.8.2).")
    note.font = copy.copy(style_src.cell(row=2, column=1).font)
    for j, field in enumerate(cols, start=1):
        label = field.split(".")[-1]
        hc = ws.cell(row=4, column=j, value=label)
        copy_cell_style(style_src.cell(row=4, column=min(j, 7)), hc)
        ws.column_dimensions[get_column_letter(j)].width = max(14, len(label) + 6)
    for i, data in enumerate(rows):
        for j, field in enumerate(cols, start=1):
            c = ws.cell(row=5 + i, column=j, value=to_xl(data.get(field)))
            if isinstance(c.value, datetime):
                c.number_format = "dd/mm/yyyy"
    ws.freeze_panes = "A5"
    return len(rows)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def export(template_path: Path, db_path: Path, out_path: Path, version: str,
           dry_run: bool = False):
    con = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    con.row_factory = sqlite3.Row
    cur = con.cursor()

    wb = load_workbook(template_path, data_only=False)
    today = datetime.now().strftime("%Y-%m-%d")
    summary = ("Regenerated from SQLite DB (system of record). Data tabs "
               "refreshed; formulas, Dashboard, Assumptions, Invoice preserved; "
               "post-v1.8.2 DB tables added as new tabs.")
    out_name = out_path.name
    report = []

    for sheet_name, cfg in SHEETS.items():
        if sheet_name not in wb.sheetnames:
            report.append(f"SKIP (no sheet): {sheet_name}")
            continue
        export_sheet(wb[sheet_name], cfg, cur, report, version)

    for tab, spec in NEW_SHEETS.items():
        if tab in wb.sheetnames:
            report.append(f"SKIP (tab exists): {tab}")
            continue
        n = export_new_sheet(wb, tab, spec, cur, version)
        report.append(f"[new tab] {tab}: {n} rows")

    if VERSION_HISTORY_SHEET in wb.sheetnames:
        vh = wb[VERSION_HISTORY_SHEET]
        out_row = vh.max_row + 1
        if all(vh.cell(row=vh.max_row, column=c).value in (None, "")
               for c in range(1, 6)):
            out_row = vh.max_row
        vh.cell(row=out_row, column=1, value=version)
        vh.cell(row=out_row, column=2, value=today)
        vh.cell(row=out_row, column=3, value="Z.ai (DB export)")
        vh.cell(row=out_row, column=4, value=summary)
        vh.cell(row=out_row, column=5, value=out_name)
        report.append(f"Version History: appended {version} at row {out_row}")

    con.close()

    if dry_run:
        print("\n".join(report))
        print("(dry run — nothing saved)")
        return

    out_path.parent.mkdir(parents=True, exist_ok=True)
    wb.save(out_path)
    print("\n".join(report))
    print(f"\nSAVED: {out_path}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--version", default="v1.9.5")
    ap.add_argument("--template", default=str(ROOT / "public/erp-zai-v1_8_2.xlsx"))
    ap.add_argument("--db", default=str(ROOT / "db/custom.db"))
    ap.add_argument("--out", default=None)
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    out = a.out or str(ROOT / f"data/ERP Zai {a.version}.xlsx")
    export(Path(a.template), Path(a.db), Path(out), a.version, a.dry_run)


if __name__ == "__main__":
    sys.exit(main())
