"""
Seed the CustomMaterial table from the matched El Gato Excel file.
Idempotent: clears existing El Gato materials before re-inserting.

Uses sqlite3 directly (not Prisma) so we don't have to deal with TS imports.

Usage: python3 scripts/seed_custom_materials.py
"""
import json
import os
import sqlite3
from openpyxl import load_workbook

MATCHED_PATH = "/home/z/my-project/download/El Gato matched to ERP.xlsx"
DB_PATH = "/home/z/my-project/db/custom.db"


def main():
    if not os.path.exists(MATCHED_PATH):
        print(f"ERROR: Matched Excel not found at {MATCHED_PATH}")
        print("Run: python3 scripts/match_el_gato.py first")
        return

    if not os.path.exists(DB_PATH):
        print(f"ERROR: SQLite DB not found at {DB_PATH}")
        print("Run: bash setup.sh first")
        return

    # Parse Excel
    wb = load_workbook(MATCHED_PATH, data_only=True)
    ws = wb.active

    rows = []
    for r in range(5, ws.max_row + 1):
        name = ws.cell(row=r, column=1).value
        if not name:
            continue
        price_raw = ws.cell(row=r, column=2).value
        price = float(price_raw) if isinstance(price_raw, (int, float)) else 0.0
        type_ = str(ws.cell(row=r, column=3).value or "").strip().lower()
        class_ = str(ws.cell(row=r, column=4).value or "").strip()
        erp_sku = str(ws.cell(row=r, column=5).value or "").strip() or None
        erp_name = str(ws.cell(row=r, column=6).value or "").strip() or None
        match_score_raw = ws.cell(row=r, column=9).value
        match_score = float(match_score_raw) if isinstance(match_score_raw, (int, float)) else 0.0
        match_confidence = str(ws.cell(row=r, column=10).value or "").strip() or None
        rows.append((
            str(name).strip(),
            price,
            type_,
            class_,
            "El Gato",
            erp_sku,
            erp_name,
            match_score,
            match_confidence,
        ))

    print(f"Parsed {len(rows)} rows from matched Excel")

    # Connect to SQLite directly
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    # Clear existing El Gato materials
    print("Clearing existing El Gato custom materials…")
    cur.execute("DELETE FROM CustomMaterial WHERE source = ?", ("El Gato",))

    # Insert
    print("Inserting…")
    for row in rows:
        # Generate a cuid-like ID
        import uuid
        mat_id = "cm" + uuid.uuid4().hex[:22]
        cur.execute(
            """INSERT INTO CustomMaterial
               (id, name, pricePerStem, type, class, source, erpSku, erpName,
                matchScore, matchConfidence, createdAt, updatedAt)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))""",
            (mat_id, row[0], row[1], row[2], row[3], row[4], row[5], row[6], row[7], row[8]),
        )

    conn.commit()
    print(f"Inserted {len(rows)} custom materials")

    # Verify
    cur.execute("SELECT COUNT(*) FROM CustomMaterial WHERE source = 'El Gato'")
    count = cur.fetchone()[0]
    print(f"Verified: {count} El Gato materials in DB")

    conn.close()
    print("Done.")


if __name__ == "__main__":
    main()
