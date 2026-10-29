"""
ERP Zai v1.8.1 → v1.8.2 upgrade script.

Goal (per user instruction): consolidate redundant version-history sheets.

Context
-------
The workbook had two version-history sheets with near-identical content:
  - 'Version History' (sheet #2) — schema: Version | Date | Author | Summary | File name
  - 'Workbook Version History' (sheet #43) — schema: Source Row Key | Version | Recorded At | Author | Summary | File Name

The latter was created in v1.3 with the stated intent of "tracking the workbook
file" separately from "tracking the ERP app" — but in practice both sheets end
up logging the exact same events (each version bump IS both a workbook-file
save AND an app evolution).

In v1.8.1 we backfilled 'Workbook Version History' from v1.3 up to v1.8.1.
In v1.8.2 we remove it entirely and keep 'Version History' as the single
source of truth.

This script:
1. Loads ERP Zai v1.8.1.xlsx
2. Captures the more detailed v1.3 summary from the to-be-deleted sheet
   (it lists the 4 new sheets by name + ~18 sync columns; the v1.3 row in
   'Version History' was shorter).
3. Enriches the v1.3 row in 'Version History' with that detail.
4. Deletes the 'Workbook Version History' sheet.
5. Appends a v1.8.2 row to 'Version History' documenting the consolidation.
6. Saves as ERP Zai v1.8.2.xlsx in /home/z/my-project/download/.

Run:
    python /home/z/my-project/scripts/v1_8_2_upgrade.py
"""
from datetime import datetime
from pathlib import Path

from openpyxl import load_workbook
from openpyxl.styles import Alignment, Font

SRC = Path("/home/z/my-project/download/ERP Zai v1.8.1.xlsx")
DST = Path("/home/z/my-project/download/ERP Zai v1.8.2.xlsx")

SHEET_TO_REMOVE = "Workbook Version History"
SHEET_TO_KEEP = "Version History"

# The richer v1.3 summary from the removed sheet (captured before deletion).
# Original wording preserved; only mildly polished for clarity.
ENRICHED_V1_3_SUMMARY = (
    "v1.3: schema sync with Prisma schema (post-v1.9 main).\n"
    "Added 4 new sheets: Material Availability, Material Substitution, "
    "Workbook Settings, Version History (this sheet).\n"
    "Added ~18 sync/metadata columns to existing sheets (sourceRowKey, "
    "legacyLineKey, sourceXxxId, sourceStatus).\n"
    "New columns are at the end of each existing sheet with violet-tinted "
    "headers; hover the header to see the description.\n"
    "See 'v1.3 Schema Changes' sheet at the front for the full diff."
)

# New row for v1.8.2 — documents the consolidation
V1_8_2_ROW = (
    "v1.8.2",
    datetime(2026, 10, 29),
    "Z.ai",
    "v1.8.2: consolidated redundant version-history sheets. "
    "Removed 'Workbook Version History' (was a duplicate of 'Version History' "
    "since v1.3 with slightly different column layout and no real semantic "
    "distinction). 'Version History' is now the single source of truth for "
    "workbook evolution. Enriched the v1.3 row with the more detailed summary "
    "captured from the removed sheet (lists the 4 new sheets + ~18 sync "
    "columns by name).",
    "ERP Zai v1.8.2.xlsx",
)

BODY_FONT = Font(name="Calibri", size=11)
WRAP_ALIGN = Alignment(wrap_text=True, vertical="top")


def main():
    if not SRC.exists():
        raise FileNotFoundError(f"Source workbook not found: {SRC}")

    print(f"Loading source: {SRC.name}")
    wb = load_workbook(SRC, data_only=False)
    print(f"  {len(wb.sheetnames)} sheets found.")

    # -------------------------------------------------------------------
    # Step 1 — Capture the richer v1.3 summary from the soon-to-be-deleted
    #          'Workbook Version History' sheet BEFORE we delete it.
    # -------------------------------------------------------------------
    if SHEET_TO_REMOVE not in wb.sheetnames:
        print(f"\n[1] '{SHEET_TO_REMOVE}' not found — nothing to capture.")
        captured_v13_summary = ENRICHED_V1_3_SUMMARY
    else:
        print(f"\n[1] Capturing richer v1.3 summary from '{SHEET_TO_REMOVE}'...")
        ws_remove = wb[SHEET_TO_REMOVE]
        captured_v13_summary = None
        for row in ws_remove.iter_rows(values_only=True):
            # Find the v1.3 row (Version column == 'v1.3')
            if row and len(row) > 4 and row[1] == "v1.3":
                captured_v13_summary = row[4]  # Summary column
                break
        if captured_v13_summary is None:
            print(f"  ⚠ v1.3 row not found in '{SHEET_TO_REMOVE}' — using fallback.")
            captured_v13_summary = ENRICHED_V1_3_SUMMARY
        else:
            preview = str(captured_v13_summary).split("\n")[0][:120]
            print(f"  Captured. First line: {preview}...")

    # -------------------------------------------------------------------
    # Step 2 — Enrich the v1.3 row in 'Version History' with the captured
    #          detailed summary (replaces the shorter one).
    # -------------------------------------------------------------------
    print(f"\n[2] Enriching v1.3 row in '{SHEET_TO_KEEP}' with detailed summary...")
    ws_keep = wb[SHEET_TO_KEEP]
    v13_row_idx = None
    for r_idx, row in enumerate(ws_keep.iter_rows(values_only=True), 1):
        if row and row[0] == "v1.3":
            v13_row_idx = r_idx
            break
    if v13_row_idx is None:
        print(f"  ⚠ v1.3 row not found in '{SHEET_TO_KEEP}' — skipping enrichment.")
    else:
        # Find the Summary column index (4th column = column D = index 4)
        # Schema: Version(1) | Date(2) | Author(3) | Summary(4) | File name(5)
        ws_keep.cell(row=v13_row_idx, column=4, value=captured_v13_summary).font = BODY_FONT
        ws_keep.cell(row=v13_row_idx, column=4).alignment = WRAP_ALIGN
        # Make the row tall enough to show the multi-line summary
        ws_keep.row_dimensions[v13_row_idx].height = 90
        print(f"  v1.3 row at row {v13_row_idx} updated with detailed summary.")

    # -------------------------------------------------------------------
    # Step 3 — Delete the 'Workbook Version History' sheet.
    # -------------------------------------------------------------------
    if SHEET_TO_REMOVE in wb.sheetnames:
        print(f"\n[3] Deleting '{SHEET_TO_REMOVE}' sheet...")
        del wb[SHEET_TO_REMOVE]
        print(f"  Deleted. {len(wb.sheetnames)} sheets remaining.")
    else:
        print(f"\n[3] '{SHEET_TO_REMOVE}' not found — already removed.")

    # -------------------------------------------------------------------
    # Step 4 — Append v1.8.2 row to 'Version History'.
    # -------------------------------------------------------------------
    print(f"\n[4] Appending v1.8.2 row to '{SHEET_TO_KEEP}'...")
    ws = wb[SHEET_TO_KEEP]
    # Find next free row after the last v-prefixed entry
    next_row = ws.max_row + 1
    while next_row > 6 and all(
        ws.cell(row=next_row - 1, column=c).value is None
        for c in range(1, 6)
    ):
        next_row -= 1

    for col_idx, val in enumerate(V1_8_2_ROW, start=1):
        cell = ws.cell(row=next_row, column=col_idx, value=val)
        cell.font = BODY_FONT
        cell.alignment = WRAP_ALIGN
    ws.row_dimensions[next_row].height = 70
    print(f"  +1 row appended at row {next_row} (v1.8.2).")

    # -------------------------------------------------------------------
    # Step 5 — Save as v1.8.2.
    # -------------------------------------------------------------------
    print(f"\n[5] Saving to: {DST.name}")
    wb.save(DST)
    size_kb = DST.stat().st_size / 1024
    print(f"  Saved ({size_kb:.1f} KB).")
    print(f"\nFinal sheet count: {len(wb.sheetnames)} sheets.")


if __name__ == "__main__":
    main()
