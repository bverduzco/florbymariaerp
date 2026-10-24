"""Print headers of every sheet in ERP Zai v1.2.xlsx — helps plan column insertions."""
from openpyxl import load_workbook
from openpyxl.utils import get_column_letter

wb = load_workbook("/home/z/my-project/data/ERP Zai v1.2.xlsx", data_only=False)
for sheet_name in wb.sheetnames:
    ws = wb[sheet_name]
    print(f"\n=== {sheet_name} (max_col={ws.max_column}, max_row={ws.max_row}) ===")
    # Print first 6 rows to find the actual column header row
    for row_idx in range(1, min(7, ws.max_row + 1)):
        row_data = []
        for col_idx in range(1, ws.max_column + 1):
            cell = ws.cell(row=row_idx, column=col_idx)
            val = cell.value
            if val is None:
                val = ""
            row_data.append(f"{get_column_letter(col_idx)}={val!r}")
        print(f"  Row {row_idx}: " + " | ".join(row_data)[:800])
    # List tables in this sheet
    if hasattr(ws, "tables") and ws.tables:
        for tbl_name in ws.tables:
            tbl = ws.tables[tbl_name]
            print(f"  Table: {tbl_name} (ref={tbl.ref}, displayName={tbl.displayName})")

