"""
Quick fix: set megadeco's Preferred Supplier (Materials col R) to "LA FINCA".
This resolves the blank-Preferred-Supplier issue (Conflict 9c → updated to B),
so Materials.L (Pack Price), Materials.M (Units per Pack) and Materials.E (Unit Cost)
all resolve correctly via the per-supplier formula.
"""

from datetime import datetime
from openpyxl import load_workbook
from openpyxl.styles import Font, PatternFill, Border, Side, Alignment
import os

V11_PATH = "/home/z/my-project/download/ERP Zai v1.1.xlsx"

INPUT_FONT = Font(name="Arial", size=11, color="FF0000FF")
INPUT_FILL = PatternFill(fill_type="solid", fgColor="FFFFFF00")
THIN = Side(border_style="thin", color="FF000000")
BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)


def fix_megadeco_preferred_supplier(wb):
    """Set Materials.R (Preferred Supplier) = "LA FINCA" for the megadeco row."""
    ws = wb["Materials"]
    fixed = False
    for r in range(5, ws.max_row + 1):
        if ws.cell(row=r, column=1).value == "PKG-MEGADECO-FLORAL":
            old_val = ws.cell(row=r, column=18).value
            cell = ws.cell(row=r, column=18)
            cell.value = "LA FINCA"
            cell.font = INPUT_FONT
            cell.fill = INPUT_FILL
            cell.border = BORDER
            # Update notes to record the decision change
            existing_notes = ws.cell(row=r, column=16).value or ""
            # Remove the old "left blank per Conflict 9c" note and replace with the new decision
            if "Preferred Supplier left blank per Conflict 9c" in existing_notes:
                existing_notes = existing_notes.replace(
                    "[v1.1] Preferred Supplier left blank per Conflict 9c — both OASIS ($43.07) and LA FINCA ($48) are valid sources. Materials.Pack Price will show empty until you choose one.",
                    "[v1.1 fix] Preferred Supplier set to LA FINCA per Conflict 9c → B (user decision). Pack Price = $48/piece, Unit Cost = $48/piece.",
                )
            ws.cell(row=r, column=16).value = existing_notes
            print(f"  Materials row {r}: megadeco Preferred Supplier {old_val!r} → 'LA FINCA'")
            fixed = True
            break
    return fixed


def update_version_history(wb):
    """Append a note to the v1.1 entry about the Conflict 9c → B decision."""
    ws = wb["Version History"]
    for r in range(5, ws.max_row + 1):
        v = ws.cell(row=r, column=1).value
        if v == "v1.1":
            existing_summary = ws.cell(row=r, column=4).value or ""
            decision_note = (
                "\n\n--- CONFLICT 9c → B UPDATE ---\n"
                "User decision: set megadeco Preferred Supplier to LA FINCA (was blank per original "
                "Conflict 9c choice). Now Materials.Pack Price resolves to $48/piece (LA FINCA's latest), "
                "Unit Cost = $48/piece. The OASIS $646/pack (15 pieces) baseline is preserved in Supplier "
                "Prices for future reference; switching Preferred Supplier to OASIS would show $43.07/piece "
                "instead. The app parser already had a 'most recent' fallback that produced the same result, "
                "so no app-side change needed."
            )
            ws.cell(row=r, column=4).value = existing_summary + decision_note
            ws.row_dimensions[r].height = 430
            print(f"  Version History: appended Conflict 9c → B update note to v1.1 entry (row {r})")
            break


def main():
    if not os.path.exists(V11_PATH):
        raise SystemExit(f"v1.1 file not found: {V11_PATH}")

    print(f"Loading v1.1: {V11_PATH}")
    wb = load_workbook(V11_PATH)

    print("\n[1/2] Setting megadeco Preferred Supplier = LA FINCA…")
    fixed = fix_megadeco_preferred_supplier(wb)
    if not fixed:
        print("  WARNING: megadeco row not found")

    print("\n[2/2] Updating Version History…")
    update_version_history(wb)

    print(f"\nSaving fixed v1.1: {V11_PATH}")
    wb.save(V11_PATH)
    print("Done.")


if __name__ == "__main__":
    main()
