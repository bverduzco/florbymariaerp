"""Verify the generated ERP Zai v1.9.5 workbook."""
import openpyxl

wb = openpyxl.load_workbook("data/ERP Zai v1.9.5.xlsx", data_only=False)
print(f"Sheets: {len(wb.sheetnames)} (template had 42)")

def row_summary(name, row, maxcol=None):
    ws = wb[name]
    out = []
    for c in ws[row][:maxcol or ws.max_column]:
        if c.value not in (None, ""):
            out.append(f"{c.coordinate}={str(c.value)[:70]}")
    return out

print("\n--- Materials rows 5 & 10 (inputs + formulas must both exist) ---")
for v in row_summary("Materials", 5): print("  ", v)
print()
for v in row_summary("Materials", 10)[:12]: print("  ", v)

print("\n--- Products row 5 (R=actual price input, E=cost formula) ---")
for v in row_summary("Products", 5)[:8]: print("  ", v)
print("  R5 =", wb["Products"]["R5"].value)

print("\n--- Orders rows 5-8 ---")
for r in range(5, 9):
    vals = row_summary("Orders", r)
    print(f" row{r}:", " | ".join(vals[:10]) or "(empty)")
print("  Orders extra headers AI4..AN4:",
      [wb["Orders"].cell(row=4, column=c).value for c in range(35, 41)])

print("\n--- Payments: data + total row ---")
ws = wb["Payments"]
for r in range(5, 15):
    a, g = ws[f"A{r}"].value, ws[f"G{r}"].value
    if a or g:
        print(f"  A{r}={a}  G{r}={str(g)[:60]}")

print("\n--- Losses total row ---")
ws = wb["Losses"]
for r in range(5, 12):
    d = ws[f"D{r}"].value
    if d is not None:
        print(f"  D{r} = {d}")

print("\n--- Execution Log Lines: duplicate check for EXE keys ---")
ws = wb["Execution Log Lines"]
keys = []
for r in range(5, ws.max_row + 1):
    a, l = ws[f"A{r}"].value, ws[f"L{r}"].value
    if a:
        keys.append((a, l))
print("  rows:", len(keys), "| duplicates:", len(keys) - len(set(keys)))
for k in keys: print("   ", k)

print("\n--- Quotes: I formula + extras R..V ---")
ws = wb["Quotes"]
print("  I5 =", str(ws["I5"].value)[:60])
print("  headers R4..V4:", [ws.cell(row=4, column=c).value for c in range(18, 23)])
print("  R5..U5:", [ws.cell(row=5, column=c).value for c in range(18, 22)])

print("\n--- Customers: LTV formula intact, ids written ---")
ws = wb["Customers"]
for r in range(5, 11):
    a, l = ws[f"A{r}"].value, ws[f"L{r}"].value
    if a:
        print(f"  A{r}={str(a)[:28]}  L{r}={str(l)[:55]}")

print("\n--- Version History last row ---")
vh = wb["Version History"]
r = 64 if vh["A64"].value else vh.max_row
print("  ", [vh.cell(row=r, column=c).value for c in range(1, 6)])

print("\n--- New tabs sample ---")
for tab in ["Custom Materials", "Custom Recipes", "Custom Recipe Lines", "Shopping Lists", "Wiki Articles"]:
    ws = wb[tab]
    print(f"  {tab}: max_row={ws.max_row}, A5={str(ws['A5'].value)[:40]}, B5={str(ws['B5'].value)[:40]}")

print("\n--- Formula counts per key sheet (must be > 0) ---")
for name in ["Materials", "Products", "Customers", "Orders", "Events", "Recipes", "Quote Lines", "Purchase Orders", "Event Line Items", "Ad-hoc Purchases"]:
    ws = wb[name]
    n = sum(1 for row in ws.iter_rows() for c in row
            if isinstance(c.value, str) and c.value.startswith("="))
    print(f"  {name}: {n} formulas")

wb.close()
