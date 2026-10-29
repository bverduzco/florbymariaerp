"""
ERP Zai v1.8.2 → v1.8.3 upgrade script.

Goal (per user instruction):
- Add a `Cloudinary Public ID` column to the Products sheet (column X).
- This is Excel-only: no Prisma migration, no code changes, no upload UI.
- Pre-fill row 7 (PRD-PEACHY-S) with "Matilde_Ramo_Mini.png" — the only
  photo we have wired up so far (the v1.9 spike asset).
- All other product rows get the column blank, ready for Maria to fill in
  as she uploads more photos.
- Add a "MEDIA" group label in row 3 above the new column.
- Append a v1.8.3 row to the Version History sheet documenting the change.

Why no Prisma/code yet:
  The user explicitly deferred Prisma changes — they want to validate the
  Excel structure first, then add the column manually per product as they
  have time. The hard-coded PRODUCT_IMAGES lookup in /demo-cloudinary is
  the spike; this Excel column is the production data store.

Run:
    python /home/z/my-project/scripts/v1_8_3_upgrade.py
"""
from datetime import datetime
from pathlib import Path

from openpyxl import load_workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

SRC = Path("/home/z/my-project/download/ERP Zai v1.8.2.xlsx")
DST = Path("/home/z/my-project/download/ERP Zai v1.8.3.xlsx")

PRODUCTS_SHEET = "Products"
HISTORY_SHEET = "Version History"

# Column index for the new column (1-indexed).
# Current max column is W = 23. New column = X = 24.
NEW_COL_IDX = 24
NEW_COL_LETTER = get_column_letter(NEW_COL_IDX)  # "X"

# Pre-filled value: the one Cloudinary public_id we have wired up so far.
# This matches the demo page at /demo-cloudinary (PRD-PEACHY-S).
PREFILL = {
    7: "Matilde_Ramo_Mini.png",  # row 7 = PRD-PEACHY-S (the Small variant)
}

# Styling — must match the existing header row 4 of Products sheet:
# - white bold text on dark green (#2F5233) fill
# - centered, wrap_text=True
HEADER_FILL = PatternFill(start_color="2F5233", end_color="2F5233", fill_type="solid")
HEADER_FONT = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
HEADER_ALIGN = Alignment(horizontal="center", vertical="center", wrap_text=True)

# Group label styling (row 3) — same as existing group labels (e.g. "COST (from Recipes)")
GROUP_FONT = Font(name="Calibri", size=11, bold=True, color="2F5233")
GROUP_ALIGN = Alignment(horizontal="center", vertical="center", wrap_text=True)

# Body styling
BODY_FONT = Font(name="Calibri", size=11)
BODY_ALIGN = Alignment(horizontal="left", vertical="center", wrap_text=False)
BODY_FILL_HIGHLIGHT = PatternFill(start_color="FEF3C7", end_color="FEF3C7", fill_type="solid")  # amber tint

# New Version History row
V1_8_3_ROW = (
    "v1.8.3",
    datetime(2026, 10, 29),
    "Z.ai",
    "v1.8.3: added 'Cloudinary Public ID' column (col X) to Products sheet. "
    "Excel-only — no Prisma migration, no code changes, no upload UI. "
    "Maria will fill in the column manually as she uploads product photos to Cloudinary. "
    "Pre-filled PRD-PEACHY-S row with 'Matilde_Ramo_Mini.png' (the demo asset wired up in the v1.9 spike page at /demo-cloudinary). "
    "All other product rows blank. "
    "Production path: Cloudinary upload → public_id in this Excel column → ERP reads it → <AssetImage> component renders the photo. "
    "Companion React component: src/components/asset-image.tsx (already built, ready to wire into catalogue-grid once Prisma gets the column in a later version).",
    "ERP Zai v1.8.3.xlsx",
)


def main():
    if not SRC.exists():
        raise FileNotFoundError(f"Source workbook not found: {SRC}")

    print(f"Loading source: {SRC.name}")
    wb = load_workbook(SRC, data_only=False)
    print(f"  {len(wb.sheetnames)} sheets found.")

    # -------------------------------------------------------------------
    # Step 1 — Add 'Cloudinary Public ID' column to Products sheet.
    # -------------------------------------------------------------------
    if PRODUCTS_SHEET not in wb.sheetnames:
        raise RuntimeError(f"Sheet '{PRODUCTS_SHEET}' not found in workbook.")
    ws = wb[PRODUCTS_SHEET]
    print(f"\n[1] Adding 'Cloudinary Public ID' column to '{PRODUCTS_SHEET}' sheet (col {NEW_COL_LETTER})...")

    # Row 3: group label — "MEDIA"
    group_cell = ws.cell(row=3, column=NEW_COL_IDX, value="MEDIA")
    group_cell.font = GROUP_FONT
    group_cell.alignment = GROUP_ALIGN

    # Row 4: header
    header_cell = ws.cell(row=4, column=NEW_COL_IDX, value="Cloudinary Public ID")
    header_cell.fill = HEADER_FILL
    header_cell.font = HEADER_FONT
    header_cell.alignment = HEADER_ALIGN

    # Rows 5-8: pre-fill PRD-PEACHY-S (row 7), leave others blank but styled
    product_count = 0
    for r_idx in range(5, ws.max_row + 1):
        sku_cell = ws.cell(row=r_idx, column=1)
        if not sku_cell.value:
            continue
        product_count += 1
        body_cell = ws.cell(row=r_idx, column=NEW_COL_IDX)
        body_cell.font = BODY_FONT
        body_cell.alignment = BODY_ALIGN

        if r_idx in PREFILL:
            body_cell.value = PREFILL[r_idx]
            body_cell.fill = BODY_FILL_HIGHLIGHT  # amber tint = pre-filled
            print(f"  Row {r_idx} ({sku_cell.value}): pre-filled with '{PREFILL[r_idx]}' (highlighted)")
        else:
            body_cell.value = None  # explicit empty
            print(f"  Row {r_idx} ({sku_cell.value}): blank (waiting on Cloudinary upload)")

    # Set column width — Cloudinary public_ids can be long (e.g. "Matilde_Ramo_Mini.png")
    ws.column_dimensions[NEW_COL_LETTER].width = 32
    print(f"  Column {NEW_COL_LETTER} width set to 32.")
    print(f"  {product_count} product rows updated.")

    # -------------------------------------------------------------------
    # Step 2 — Append v1.8.3 row to Version History.
    # -------------------------------------------------------------------
    if HISTORY_SHEET not in wb.sheetnames:
        raise RuntimeError(f"Sheet '{HISTORY_SHEET}' not found in workbook.")
    ws = wb[HISTORY_SHEET]
    print(f"\n[2] Appending v1.8.3 row to '{HISTORY_SHEET}'...")

    # Find next free row after the last v-prefixed entry
    next_row = ws.max_row + 1
    while next_row > 6 and all(
        ws.cell(row=next_row - 1, column=c).value is None
        for c in range(1, 6)
    ):
        next_row -= 1

    for col_idx, val in enumerate(V1_8_3_ROW, start=1):
        cell = ws.cell(row=next_row, column=col_idx, value=val)
        cell.font = BODY_FONT
        cell.alignment = Alignment(wrap_text=True, vertical="top")
    ws.row_dimensions[next_row].height = 90
    print(f"  +1 row appended at row {next_row} (v1.8.3).")

    # -------------------------------------------------------------------
    # Step 3 — Save as v1.8.3.
    # -------------------------------------------------------------------
    print(f"\n[3] Saving to: {DST.name}")
    wb.save(DST)
    size_kb = DST.stat().st_size / 1024
    print(f"  Saved ({size_kb:.1f} KB).")
    print(f"\nFinal sheet count: {len(wb.sheetnames)} sheets.")


if __name__ == "__main__":
    main()
