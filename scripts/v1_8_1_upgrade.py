"""
ERP Zai v1.8 → v1.8.1 upgrade script.

Changes:
1. Backfill the long-neglected 'Workbook Version History' sheet (#42) with
   rows for v1.4 through v1.8.1 (was stuck at v1.3 only).
2. Append v1.8.1 row to the regular 'Version History' sheet (#2).
3. Add the new 'SeasonMarkers' sheet with 6 seed markers per the v1.8.1 spec.
4. Save as ERP Zai v1.8.1.xlsx in /home/z/my-project/download/.

Run:
    python /home/z/my-project/scripts/v1_8_1_upgrade.py
"""
from datetime import datetime
from pathlib import Path

from openpyxl import load_workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

SRC = Path("/home/z/my-project/download/ERP Zai v1.8.xlsx")
DST = Path("/home/z/my-project/download/ERP Zai v1.8.1.xlsx")

# ---------------------------------------------------------------------------
# 1. The 14 missing rows for "Workbook Version History" (sheet #42)
#    Source of truth: the regular 'Version History' sheet (#2) which was
#    maintained up through v1.8. We mirror those entries here with the
#    "Workbook Version History" schema (Source Row Key + Recorded At).
# ---------------------------------------------------------------------------

WORKBOOK_HISTORY_BACKFILL = [
    # (source_row_key, version, recorded_at, author, summary, file_name)
    ("wb-v1.4-001", "v1.4", datetime(2026, 10, 26), "Z.ai",
     "v1.4: ad-hoc purchases + material properties sheets. "
     "Added Ad-hoc Purchases sheet, Ribbon Properties, Paper Properties. "
     "Materials sheet gained ASSUMED PACK SIZE handling.",
     "ERP Zai v1.4.xlsx"),
    ("wb-v1.4.1-001", "v1.4.1", datetime(2026, 10, 26), "Z.ai",
     "v1.4.1: added Expenses sheet (operating expenses) — Categories: gas / parking / "
     "software / utilities / labor / venue_fee / equipment_rental / market_run / other.",
     "ERP Zai v1.4.1.xlsx"),
    ("wb-v1.4.2-001", "v1.4.2", datetime(2026, 10, 26), "Z.ai",
     "v1.4.2: fill units_per_pack + delete Photo column + homogenize fonts + Expenses cleanup.",
     "ERP Zai v1.4.2.xlsx"),
    ("wb-v1.4.3-001", "v1.4.3", datetime(2026, 10, 26), "Z.ai",
     "v1.4.3: correct orquid units_per_pack values.",
     "ERP Zai v1.4.3.xlsx"),
    ("wb-v1.4.4-001", "v1.4.4", datetime(2026, 10, 26), "Z.ai",
     "v1.4.4: ASSUMED PACK SIZE flag now visible in Notes columns on Materials.",
     "ERP Zai v1.4.4.xlsx"),
    ("wb-v1.5-001", "v1.5", datetime(2026, 10, 26), "Z.ai",
     "v1.5: Execution Logs + Losses + Events extension + font homogenization. "
     "Added Execution Logs, Execution Log Lines, Losses sheets. Events sheet extended.",
     "ERP Zai v1.5.xlsx"),
    ("wb-v1.5.2-001", "v1.5.2", datetime(2026, 10, 27), "Z.ai",
     "v1.5.2: fix corrupted formula references in Materials rows 50-59.",
     "ERP Zai v1.5.2.xlsx"),
    ("wb-v1.6-001", "v1.6", datetime(2026, 10, 28), "Z.ai",
     "v1.6: Sales Quotes — formal proposal stage in the sales pipeline. "
     "Added Quotes, Quote Lines sheets.",
     "ERP Zai v1.6.xlsx"),
    ("wb-v1.6.1-001", "v1.6.1", datetime(2026, 10, 28), "Z.ai",
     "v1.6.1: Lead/Referrer tracking + Recipient/Delivery tracking on Customers/Events.",
     "ERP Zai v1.6.1.xlsx"),
    ("wb-v1.6.2-001", "v1.6.2", datetime(2026, 10, 28), "Z.ai",
     "v1.6.2: Roles reference sheet (Contact Types distinction).",
     "ERP Zai v1.6.2.xlsx"),
    ("wb-v1.6.3-001", "v1.6.3", datetime(2026, 10, 28), "Z.ai",
     "v1.6.3: Structural fixes to Contact Types + Payer tracking + Staff sheet.",
     "ERP Zai v1.6.3.xlsx"),
    ("wb-v1.6.4-001", "v1.6.4", datetime(2026, 10, 28), "Z.ai",
     "v1.6.4: Monterrey supplier integration + Florería García price list. "
     "15 Monterrey suppliers added.",
     "ERP Zai v1.6.4.xlsx"),
    ("wb-v1.6.5-001", "v1.6.5", datetime(2026, 10, 28), "Z.ai",
     "v1.6.5: Clavo reclassification + Suppliers cleanup + Supplier Comparison sheet.",
     "ERP Zai v1.6.5.xlsx"),
    ("wb-v1.6.6-001", "v1.6.6", datetime(2026, 10, 28), "Z.ai",
     "v1.6.6: Legal templates + template variables (4 documents with [PLACEHOLDER] substitution).",
     "ERP Zai v1.6.6.xlsx"),
    ("wb-v1.7-001", "v1.7", datetime(2026, 10, 29), "Z.ai",
     "v1.7: Payment tracking + supplier payment terms. "
     "Added Payments unified ledger. Small orders 100% prepay, Events 50/50, Suppliers all COD. "
     "15 Monterrey suppliers integrated.",
     "ERP Zai v1.7.xlsx"),
    ("wb-v1.8-001", "v1.8", datetime(2026, 10, 29), "Z.ai",
     "v1.8: Capacity & Calendar — single florist (Maria). "
     "Added Blocked Dates, Capacity Days, Order Schedule sheets. "
     "Weekly rhythm: Mon=ordering, Tue=procurement+conditioning, Wed=idle, "
     "Thu=assembly, Fri=assembly+delivery, Sat=event/off, Sun=off. "
     "Event lockout = Friday + Saturday + Sunday (Option A). "
     "Nov 26, 2026 hard-blocked.",
     "ERP Zai v1.8.xlsx"),
    # The NEW row for this release
    ("wb-v1.8.1-001", "v1.8.1", datetime(2026, 10, 29), "Z.ai",
     "v1.8.1: Season / Holiday / Trend Calendar Overlay. "
     "Added SeasonMarkers sheet (6 seed markers: Wedding Season, Día de las Madres, "
     "Día de Muertos, Valentine's, Prom Season, Slow August). "
     "Markers are informational only — they never block quotes or trigger hard warnings. "
     "They tint calendar day cells and optionally surface yellow hint banners in the Shopping List "
     "when a HIGH-intensity HOLIDAY overlaps the procurement window. "
     "Backfilled Workbook Version History sheet (was stuck at v1.3).",
     "ERP Zai v1.8.1.xlsx"),
]

# ---------------------------------------------------------------------------
# 2. The single new row for the regular 'Version History' sheet (#2)
# ---------------------------------------------------------------------------

VERSION_HISTORY_NEW_ROW = (
    "v1.8.1",
    datetime(2026, 10, 29),
    "Z.ai",
    "v1.8.1: Season / Holiday / Trend Calendar Overlay. "
    "Added SeasonMarkers sheet with 6 seed markers (Wedding Season, Día de las Madres, "
    "Día de Muertos, Valentine's, Prom Season, Slow August). "
    "Markers are informational only — they tint calendar day cells and optionally "
    "surface yellow hint banners in the Shopping List. Never block. "
    "Also backfilled the long-neglected 'Workbook Version History' sheet (was stuck at v1.3).",
    "ERP Zai v1.8.1.xlsx",
)

# ---------------------------------------------------------------------------
# 3. The SeasonMarkers sheet — 6 seed markers per the v1.8.1 spec
# ---------------------------------------------------------------------------

SEASON_MARKERS_HEADERS = [
    "marker_id", "name", "type", "start_date", "end_date",
    "color", "intensity", "recurrence", "recurrence_rule", "description",
]

SEASON_MARKERS_ROWS = [
    ("sm_001", "Wedding Season", "SEASON",
     datetime(2026, 10, 1), datetime(2027, 2, 28),
     "#8B5CF6", "HIGH", "YEARLY_FIXED", "",
     "Peak wedding months in Monterrey. Display only — tints day cells in calendar."),
    ("sm_002", "Día de las Madres", "HOLIDAY",
     datetime(2026, 5, 10), None,
     "#EC4899", "HIGH", "YEARLY_FIXED", "",
     "Highest single-demand day of the year. Shopping List hint: roses +30%."),
    ("sm_003", "Día de Muertos", "HOLIDAY",
     datetime(2026, 11, 1), datetime(2026, 11, 2),
     "#F59E0B", "MEDIUM", "YEARLY_FIXED", "",
     "Cempasúchil (marigold) demand spike. Display + hint."),
    ("sm_004", "Valentine's (Amor y Amistad)", "HOLIDAY",
     datetime(2026, 2, 14), None,
     "#EF4444", "HIGH", "YEARLY_FIXED", "",
     "Red roses spike. Shopping List hint: red roses +50%."),
    ("sm_005", "Prom Season", "SEASON",
     datetime(2026, 5, 15), datetime(2026, 6, 30),
     "#10B981", "MEDIUM", "YEARLY_FIXED", "",
     "HS prom bouquets. Display only."),
    ("sm_006", "Slow August", "TREND",
     datetime(2026, 8, 1), datetime(2026, 8, 31),
     "#3B82F6", "LOW", "YEARLY_FIXED", "",
     "Off-season — vacation/inventory friendly. Display + caption only, no demand assumption."),
]

# ---------------------------------------------------------------------------
# Styling helpers
# ---------------------------------------------------------------------------

HEADER_FILL = PatternFill(start_color="1F2937", end_color="1F2937", fill_type="solid")
HEADER_FONT = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
SUBTITLE_FONT = Font(name="Calibri", size=14, bold=True, color="1F2937")
NOTE_FONT = Font(name="Calibri", size=10, italic=True, color="6B7280")
BODY_FONT = Font(name="Calibri", size=11)
WRAP_ALIGN = Alignment(wrap_text=True, vertical="top")
HEADER_ALIGN = Alignment(horizontal="center", vertical="center", wrap_text=True)


def style_header_row(ws, row_idx, n_cols):
    for col_idx in range(1, n_cols + 1):
        cell = ws.cell(row=row_idx, column=col_idx)
        cell.fill = HEADER_FILL
        cell.font = HEADER_FONT
        cell.alignment = HEADER_ALIGN


def autosize_columns(ws, min_width=12, max_width=45):
    for col_cells in ws.columns:
        col_letter = get_column_letter(col_cells[0].column)
        max_len = 0
        for cell in col_cells:
            if cell.value is None:
                continue
            # Take first line for width calc (handles wrapped text)
            val_str = str(cell.value).split("\n")[0]
            if len(val_str) > max_len:
                max_len = len(val_str)
        width = min(max(max_len + 2, min_width), max_width)
        ws.column_dimensions[col_letter].width = width


# ---------------------------------------------------------------------------
# Main upgrade logic
# ---------------------------------------------------------------------------

def main():
    if not SRC.exists():
        raise FileNotFoundError(f"Source workbook not found: {SRC}")

    print(f"Loading source: {SRC.name}")
    wb = load_workbook(SRC, data_only=False)
    print(f"  {len(wb.sheetnames)} sheets found.")

    # -----------------------------------------------------------------------
    # Step 1 — Backfill 'Workbook Version History' (sheet #42)
    # -----------------------------------------------------------------------
    sheet_name = "Workbook Version History"
    if sheet_name not in wb.sheetnames:
        raise RuntimeError(f"Sheet '{sheet_name}' not found in workbook.")
    ws = wb[sheet_name]
    print(f"\n[1] Backfilling '{sheet_name}' (was stuck at v1.3)...")

    # Find next free row. Header is at row 4, data starts at row 5.
    next_row = ws.max_row + 1
    # Walk down to find first truly empty row (skip any trailing blanks)
    while next_row > 5 and all(
        ws.cell(row=next_row - 1, column=c).value is None
        for c in range(1, 7)
    ):
        next_row -= 1

    added_wb_rows = 0
    for row in WORKBOOK_HISTORY_BACKFILL:
        for col_idx, val in enumerate(row, start=1):
            cell = ws.cell(row=next_row, column=col_idx, value=val)
            cell.font = BODY_FONT
            cell.alignment = WRAP_ALIGN
        # Set row height to accommodate wrapped summary
        ws.row_dimensions[next_row].height = 48
        next_row += 1
        added_wb_rows += 1
    print(f"  +{added_wb_rows} rows appended (v1.4 → v1.8.1).")
    print(f"  Sheet now has {ws.max_row} total rows.")

    # -----------------------------------------------------------------------
    # Step 2 — Append v1.8.1 row to regular 'Version History' (sheet #2)
    # -----------------------------------------------------------------------
    sheet_name = "Version History"
    if sheet_name not in wb.sheetnames:
        raise RuntimeError(f"Sheet '{sheet_name}' not found in workbook.")
    ws = wb[sheet_name]
    print(f"\n[2] Appending v1.8.1 row to '{sheet_name}'...")

    # Find next free row after the last v-prefixed entry
    next_row = ws.max_row + 1
    while next_row > 6 and all(
        ws.cell(row=next_row - 1, column=c).value is None
        for c in range(1, 6)
    ):
        next_row -= 1

    for col_idx, val in enumerate(VERSION_HISTORY_NEW_ROW, start=1):
        cell = ws.cell(row=next_row, column=col_idx, value=val)
        cell.font = BODY_FONT
        cell.alignment = WRAP_ALIGN
    ws.row_dimensions[next_row].height = 60
    print(f"  +1 row appended at row {next_row} (v1.8.1).")

    # -----------------------------------------------------------------------
    # Step 3 — Add the new 'SeasonMarkers' sheet
    # -----------------------------------------------------------------------
    sheet_name = "SeasonMarkers"
    if sheet_name in wb.sheetnames:
        print(f"\n[3] '{sheet_name}' already exists — skipping creation.")
    else:
        print(f"\n[3] Creating new '{sheet_name}' sheet...")
        ws = wb.create_sheet(title=sheet_name)
        # Position it after Calendar-related sheets (Capacity Days / Blocked Dates area)
        # Find Blocked Dates and place SeasonMarkers right after it
        try:
            blocked_idx = wb.sheetnames.index("Blocked Dates") + 1
        except ValueError:
            blocked_idx = len(wb.sheetnames) - 1
        sheets_list = wb._sheets
        target = sheets_list.pop(wb.sheetnames.index(sheet_name))
        sheets_list.insert(blocked_idx, target)

        # Row 1: title
        ws.cell(row=1, column=1, value="SeasonMarkers — v1.8.1").font = SUBTITLE_FONT
        ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=10)

        # Row 2: description
        ws.cell(row=2, column=1, value=(
            "Season / Holiday / Trend markers for the Calendar screen. "
            "Informational ONLY — never blocks quotes or triggers hard warnings. "
            "Tints calendar day cells and optionally surfaces yellow hint banners "
            "in the Shopping List when a HIGH-intensity HOLIDAY overlaps procurement. "
            "Edit freely — Excel-first per project convention."
        )).font = NOTE_FONT
        ws.merge_cells(start_row=2, start_column=1, end_row=2, end_column=10)
        ws.row_dimensions[2].height = 48
        ws.cell(row=2, column=1).alignment = WRAP_ALIGN

        # Row 3: blank
        # Row 4: headers
        for col_idx, header in enumerate(SEASON_MARKERS_HEADERS, start=1):
            ws.cell(row=4, column=col_idx, value=header)
        style_header_row(ws, 4, len(SEASON_MARKERS_HEADERS))
        ws.row_dimensions[4].height = 28

        # Row 5+: data
        for r_offset, row_data in enumerate(SEASON_MARKERS_ROWS, start=5):
            for col_idx, val in enumerate(row_data, start=1):
                cell = ws.cell(row=r_offset, column=col_idx, value=val)
                cell.font = BODY_FONT
                cell.alignment = WRAP_ALIGN
                # Color preview cell — make the color hex cell actually display that color
                if SEASON_MARKERS_HEADERS[col_idx - 1] == "color":
                    fill_color = val.lstrip("#")
                    cell.fill = PatternFill(
                        start_color=fill_color,
                        end_color=fill_color,
                        fill_type="solid",
                    )
                    cell.font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
            ws.row_dimensions[r_offset].height = 36

        autosize_columns(ws, min_width=12, max_width=42)

        print(f"  +1 new sheet with {len(SEASON_MARKERS_ROWS)} seed markers.")

    # -----------------------------------------------------------------------
    # Step 4 — Save as v1.8.1
    # -----------------------------------------------------------------------
    print(f"\n[4] Saving to: {DST.name}")
    wb.save(DST)
    size_kb = DST.stat().st_size / 1024
    print(f"  Saved ({size_kb:.1f} KB).")
    print(f"\nFinal sheet count: {len(wb.sheetnames)} sheets.")


if __name__ == "__main__":
    main()
