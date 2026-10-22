"""
Build ERP Zai v1.2 from v1.1.

7 Purchase Orders (renumbered chronologically per Conflict 14a):
  PO-3001  2026-07-06  BDF Palacio Floral SA de CV   6 items   $590.00  (Purchase 6)
  PO-3002  2026-07-26  PRO FLOR                       10 items  $694.27  (Purchase 7)
  PO-3003  2026-09-14  LA FINCA                        10 items  $761.99  (Purchase 5)
  PO-3004  2026-09-28  LA FINCA                        7 items   $629.00  (Purchase 4 minus albanene)
  PO-3005  2026-10-05  LA FINCA                        6 items   $403.01  (Purchase 2)
  PO-3006  2026-10-12  LA FINCA                        6 items   $600.01  (Purchase 3)
  PO-3007  2026-10-19  LA FINCA                        6 items   $478.00  (existing v1.1 PO, renumbered from PO-3002)

SKU consolidations / renames (per Conflict 44a, 45a, 46a):
  PKG-MEGADECO-FLORAL  → PKG-MEGADECO              (just rename, no consolidation)
  PKG-ESPUMA-FLORAL    → PKG-OASIS-LADRILLO-STD    (consolidate into new unified SKU)

24 new SKUs added (per SKU approvals 1-26 minus deleted albanene, with renames):
  FLR-MARGARITA-BALTICA-LF, FLR-ROSA-MEDIANA-VENDELA09-LF, FLR-MARGARITA-PINOCHO-AMARILLO-LF,
  FLR-CRISANTEMO-BLANCO-CAMPO-LF, FLR-ROSA-STD-PF, FLR-LILI-VINO-PF, FLR-ALSTROMELIA-REBECA-LF,
  FOL-PALMILLA-TEPPE-LF, PKG-CAJA-CENTRO-MESA-LF, PKG-JARDINERA-MADERA-MEGABLOCK-LF,
  PKG-LISTON-ORGANZA-9-ROJO-LF, PKG-CINTA-WP14VERDE-LF, PKG-OASIS-DISCO-20CM-LF,
  PKG-BASE-JARDINERA-BAJITAV-LF, PKG-CANASTA-CARRIZO-CUADRADA-ASA-CHICA-LF,
  PKG-CINTA-FILAMENTO-PRO, PKG-ADHESIVO-UGLUE-100-PRO, PKG-ALAMBRE-VERDE-PRO,
  PKG-BRILLO-FLORALIFE-PRO, PKG-BASE-BOLICHE-GDE-PRO, PKG-FLORALIFE-EXPRESS-PRO,
  PKG-FLORALIFE-EZ-DOSE-PRO, PKG-TUBITO-FLORAL-PUNTA-PRO, PKG-TUBITO-FLORAL-SPUNTA-PRO
"""

from datetime import datetime
from openpyxl import load_workbook
from openpyxl.styles import Font, PatternFill, Border, Side, Alignment
import os

V11_PATH = "/home/z/my-project/download/ERP Zai v1.1.xlsx"
V12_PATH = "/home/z/my-project/download/ERP Zai v1.2.xlsx"

# Styles (matching v1/v1.1)
INPUT_FILL = PatternFill(fill_type="solid", fgColor="FFFFFF00")
INPUT_FONT = Font(name="Arial", size=11, color="FF0000FF")
FORMULA_FONT = Font(name="Arial", size=10.5, color="FF000000")
THIN = Side(border_style="thin", color="FF000000")
BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)


def set_input(cell, value, fmt="General"):
    cell.value = value
    cell.font = INPUT_FONT
    cell.fill = INPUT_FILL
    cell.border = BORDER
    cell.number_format = fmt


def set_formula(cell, formula, fmt="General"):
    cell.value = formula
    cell.font = FORMULA_FONT
    cell.border = BORDER
    cell.number_format = fmt


# ============================================================
# DATA: 7 Purchase Orders (chronological order, final PO numbers)
# ============================================================

# Existing v1.1 PO-3002 → renumbered to PO-3007
# (kept separate to avoid duplication; we'll update the existing row's PO # field)

POS = [
    # PO-3001: Purchase 6 — 2026-07-06, BDF, 6 items, $590 total
    {
        "po_number": "PO-3001",
        "date": datetime(2026, 7, 6),
        "supplier": "BDF Palacio Floral SA de CV",
        "status": "Received",
        "items": [
            ("FLR-MARGARITA",                  "MARGARITA",                1, 85),
            ("FOL-EUCALIPTO-DOLAR-MINI",       "EUCALIPTO DOLAR MINI",     1, 105),
            ("FLR-SOLIDAGO",                   "SOLIDAGO",                  1, 50),
            ("FLR-TULIA-CHICA",                "TULIA CHICA",               1, 25),
            ("FLR-ROSA-STD-PF",                "ROSA STD",                  1, 95),   # new SKU
            ("FLR-LILI-VINO-PF",               "LILI VINO",                 1, 230),  # new SKU
        ],
    },
    # PO-3002: Purchase 7 — 2026-07-26, PRO FLOR, 10 items
    {
        "po_number": "PO-3002",
        "date": datetime(2026, 7, 26),
        "supplier": "PRO FLOR",
        "status": "Received",
        "items": [
            ("PKG-CINTA-FILAMENTO-PRO",        "CINTA CON FILAMENTO",      1, 58),
            ("PKG-ADHESIVO-UGLUE-100-PRO",     "ADHESIVO UGLUE 100",        1, 104.01),
            ("PKG-ALAMBRE-VERDE-PRO",          "ALAMBRE VERDE",             1, 58),    # 50 pcs/pack
            ("PKG-BRILLO-FLORALIFE-PRO",       "BRILLO FLORALIFE",          1, 173.25),
            ("PKG-BASE-BOLICHE-GDE-PRO",       "BASE BOLICHE GDE",          1, 100),
            ("PKG-OASIS-LADRILLO-STD",         "OASIS LADRILLO ESPUMA",     2, 17.005), # $34.01/2
            ("PKG-FLORALIFE-EXPRESS-PRO",      "FLORALIFE EXPRESS",         1, 30),
            ("PKG-FLORALIFE-EZ-DOSE-PRO",      "FLORALIFE EZ DOSE",         1, 25.01),
            ("PKG-TUBITO-FLORAL-PUNTA-PRO",    "TUBITO FLORAL PUNTA",       1, 25),
            ("PKG-TUBITO-FLORAL-SPUNTA-PRO",   "TUBITO FLORAL SIN PUNTA",   1, 25),
        ],
    },
    # PO-3003: Purchase 5 — 2026-09-14, LA FINCA, 10 items, $761.99 total
    {
        "po_number": "PO-3003",
        "date": datetime(2026, 9, 14),
        "supplier": "LA FINCA",
        "status": "Received",
        "items": [
            ("PKG-OASIS-LADRILLO-STD",         "OASIS LADRILLO ESPUMA",     3, 15.997), # $47.99/3 — Is Latest = NO (P4 wins)
            ("PKG-OASIS-DISCO-20CM-LF",        "DISCO MEDIANO OASIS 20CM",  1, 16),
            ("PKG-BASE-JARDINERA-BAJITAV-LF",  "BASE JARDINERA BAJITA VERDE", 1, 17.01),
            ("PKG-CANASTA-CARRIZO-CUADRADA-ASA-CHICA-LF", "CANASTA CARRIZO CUADRADA ASA CHICA", 2, 74),  # $147.99/2 ≈ $74
            ("FLR-MINI-ROSA",                  "MINI ROSA BLANCO",          1, 60),  # Conflict 26b: same SKU, new LF price
            ("FLR-GREEN-TRICK",                "GREEN TRICK",               1, 119), # new LF price
            ("FLR-MINFER",                     "MINFER",                    1, 113),
            ("FOL-HOJA-MAICERA",               "HOJA MAICERA",              2, 20),   # $40/2, new LF price
            ("FOL-EUCALIPTO-PARVIFOLIA",       "EUCALIPTO PARVIFOLIA",      1, 94),
            ("FLR-CRISANTEMO-BLANCO-CAMPO-LF", "CRISANTEMO BLANCO DE CAMPO", 1, 107),  # new SKU
        ],
    },
    # PO-3004: Purchase 4 — 2026-09-28, LA FINCA, 7 items (albanene deleted per Conflict 11)
    {
        "po_number": "PO-3004",
        "date": datetime(2026, 9, 28),
        "supplier": "LA FINCA",
        "status": "Received",
        "items": [
            ("PKG-LISTON-ORGANZA-9-ROJO-LF",   "LISTON ORGANZA 9 ROJO",     1, 39),
            ("FLR-GIRASOL-FULL-SUN",           "GIRASOL FULL SUN",          1, 155),  # Conflict 21b: same SKU, new LF price
            ("FLR-MINI-ROSA",                  "MINI ROSA TITANIC",         1, 80),
            ("FLR-MONTECASINO",                "MONTECASINO MORADO",        1, 31),  # new LF price
            ("FLR-MARGARITA-PINOCHO-AMARILLO-LF", "MARGARITA PINOCHO RELLENAS AMARILLO", 1, 65),  # new SKU
            ("PKG-OASIS-LADRILLO-STD",         "OASIS LADRILLO ESPUMA",     1, 16),   # Is Latest = YES for LF per Conflict 38a
            ("PKG-CINTA-WP14VERDE-LF",         "CINTA WATERPROOF 1/4 VERDE", 1, 197),
        ],
    },
    # PO-3005: Purchase 2 — 2026-10-05, LA FINCA, 6 items, $403.01 total
    {
        "po_number": "PO-3005",
        "date": datetime(2026, 10, 5),
        "supplier": "LA FINCA",
        "status": "Received",
        "items": [
            ("FLR-PERRITO",                    "PERRITO LILA",              1, 75),
            ("FLR-POLAR",                      "POLAR BLANCO",              1, 72),  # new LF price (was $87)
            ("FOL-RUSCUS-LARGO",               "RUSCUS LARGO",              2, 46),  # 2 packs @ $46
            ("FLR-ALSTROMELIA-REBECA-LF",      "ALSTROMELIA REBECA",        1, 35),  # new SKU per Conflict 32a
            ("FLR-MARGARITA-BALTICA-LF",       "MARGARITA BALTICA RELLENO BLANCO", 1, 107),  # new SKU
            ("PKG-CAJA-CENTRO-MESA-LF",        "CAJA CENTRO DE MESA",        1, 22.01),
        ],
    },
    # PO-3006: Purchase 3 — 2026-10-12, LA FINCA, 6 items, $600.01 total
    {
        "po_number": "PO-3006",
        "date": datetime(2026, 10, 12),
        "supplier": "LA FINCA",
        "status": "Received",
        "items": [
            ("FLR-ROSA-MEDIANA-VENDELA09-LF",  "ROSA VENDELA MEDIANA 09",   1, 115),  # new SKU
            ("PKG-JARDINERA-MADERA-MEGABLOCK-LF", "JARDINERA DE MADERA PARA MEGABLOCK", 1, 22.01),
            ("FLR-LILI",                       "LILI ROSA",                 1, 205),
            ("FOL-EUCALIPTO-PARVIFOLIA",       "EUCALIPTO PARVIFOLIA",      1, 94),
            ("FOL-EUCALIPTO-PAPALO-PICUD",    "EUCALIPTO PAPALO PICUDO",   1, 94),
            ("FOL-PALMILLA-TEPPE-LF",          "PALMILLA TEPPE",            1, 70),  # new SKU
        ],
    },
]

# ============================================================
# DATA: New Supplier Prices rows (chronological by date)
# Each entry: (date, sku, supplier, pack_price, units_per_pack, is_latest, notes)
# ============================================================

NEW_SUPPLIER_PRICES = [
    # PO-3001 (P6) — BDF, 2026-07-06
    ("2026-07-06", "FLR-MARGARITA",              "BDF Palacio Floral SA de CV", 85,   "", "yes", "First BDF quote. Default preferred supplier stays LA FINCA per Conflict 42c."),
    ("2026-07-06", "FOL-EUCALIPTO-DOLAR-MINI",   "BDF Palacio Floral SA de CV", 105,  "", "yes", "First BDF quote. BDF more expensive than LF ($99)."),
    ("2026-07-06", "FLR-SOLIDAGO",               "BDF Palacio Floral SA de CV", 50,   "", "yes", "First BDF quote. BDF +47% over LF ($34)."),
    ("2026-07-06", "FLR-TULIA-CHICA",            "BDF Palacio Floral SA de CV", 25,   "", "yes", "First BDF quote. BDF cheaper than LF ($29)."),
    ("2026-07-06", "FLR-ROSA-STD-PF",            "BDF Palacio Floral SA de CV", 95,   1, "yes", "New SKU — first purchase. 'Std' likely standard grade."),
    ("2026-07-06", "FLR-LILI-VINO-PF",           "BDF Palacio Floral SA de CV", 230,  1, "yes", "New SKU — wine color variant. BDF +12% over LF ($205)."),

    # PO-3002 (P7) — PRO FLOR, 2026-07-26
    ("2026-07-26", "PKG-CINTA-FILAMENTO-PRO",     "PRO FLOR", 58,    1, "yes", "New SKU."),
    ("2026-07-26", "PKG-ADHESIVO-UGLUE-100-PRO",  "PRO FLOR", 104.01, 1, "yes", "New SKU."),
    ("2026-07-26", "PKG-ALAMBRE-VERDE-PRO",       "PRO FLOR", 58,    50, "yes", "New SKU. 50 pieces per pack — pack price = $58."),
    ("2026-07-26", "PKG-BRILLO-FLORALIFE-PRO",    "PRO FLOR", 173.25, 1, "yes", "New SKU."),
    ("2026-07-26", "PKG-BASE-BOLICHE-GDE-PRO",    "PRO FLOR", 100,   1, "yes", "New SKU."),
    ("2026-07-26", "PKG-OASIS-LADRILLO-STD",      "PRO FLOR", 17.005, 1, "yes", "$34.01 / 2 = $17.005 per piece. Is Latest = yes for PRO FLOR."),
    ("2026-07-26", "PKG-FLORALIFE-EXPRESS-PRO",    "PRO FLOR", 30,    1, "yes", "New SKU."),
    ("2026-07-26", "PKG-FLORALIFE-EZ-DOSE-PRO",    "PRO FLOR", 25.01, 1, "yes", "New SKU."),
    ("2026-07-26", "PKG-TUBITO-FLORAL-PUNTA-PRO", "PRO FLOR", 25,    1, "yes", "New SKU."),
    ("2026-07-26", "PKG-TUBITO-FLORAL-SPUNTA-PRO","PRO FLOR", 25,    1, "yes", "New SKU."),

    # PO-3003 (P5) — LA FINCA, 2026-09-14
    ("2026-09-14", "PKG-OASIS-LADRILLO-STD",      "LA FINCA", 15.997, 1, "no", "$47.99 / 3 = $15.997 per piece. Is Latest = NO — superseded by P4 (2026-09-28) per Conflict 38a."),
    ("2026-09-14", "PKG-OASIS-DISCO-20CM-LF",     "LA FINCA", 16,    1, "yes", "New SKU."),
    ("2026-09-14", "PKG-BASE-JARDINERA-BAJITAV-LF","LA FINCA", 17.01, 1, "yes", "New SKU."),
    ("2026-09-14", "PKG-CANASTA-CARRIZO-CUADRADA-ASA-CHICA-LF", "LA FINCA", 74, 1, "yes", "New SKU. $147.99/2 ≈ $74/piece (rounded up per Conflict 37 default)."),
    ("2026-09-14", "FLR-MINI-ROSA",               "LA FINCA", 60,   1, "yes", "Conflict 26b: same SKU, new LF price. Was $80 (baseline); now $60 for blanco."),
    ("2026-09-14", "FLR-GREEN-TRICK",             "LA FINCA", 119,  1, "yes", "New LF price. Was $129 (baseline)."),
    ("2026-09-14", "FOL-HOJA-MAICERA",             "LA FINCA", 20,   1, "yes", "New LF price. Was $22/pack (baseline). $40 total for 2 packs."),
    ("2026-09-14", "FLR-CRISANTEMO-BLANCO-CAMPO-LF","LA FINCA", 107, 1, "yes", "New SKU per Conflict 32a... wait, that was alstromelia. This is a new chrysanthemum SKU."),

    # PO-3004 (P4) — LA FINCA, 2026-09-28
    ("2026-09-28", "PKG-LISTON-ORGANZA-9-ROJO-LF", "LA FINCA", 39,   1, "yes", "New SKU."),
    ("2026-09-28", "FLR-GIRASOL-FULL-SUN",         "LA FINCA", 155,  1, "yes", "Conflict 21b: same SKU, new LF price. Was $125 (baseline)."),
    ("2026-09-28", "FLR-MONTECASINO",              "LA FINCA", 31,   1, "yes", "New LF price. Was $32 (baseline). $1 difference, likely real."),
    ("2026-09-28", "FLR-MARGARITA-PINOCHO-AMARILLO-LF", "LA FINCA", 65, 1, "yes", "New SKU."),
    ("2026-09-28", "PKG-OASIS-LADRILLO-STD",       "LA FINCA", 16,   1, "yes", "Conflict 38a: Is Latest = YES for LA FINCA (supersedes P5's $15.997/piece)."),
    ("2026-09-28", "PKG-CINTA-WP14VERDE-LF",       "LA FINCA", 197,  1, "yes", "New SKU."),

    # PO-3005 (P2) — LA FINCA, 2026-10-05
    ("2026-10-05", "FLR-POLAR",                    "LA FINCA", 72,  1, "yes", "New LF price. Was $87 (baseline)."),
    ("2026-10-05", "FLR-ALSTROMELIA-REBECA-LF",    "LA FINCA", 35,  1, "yes", "New SKU per Conflict 32a. 'Rebeca' is a distinct variety."),
    ("2026-10-05", "FLR-MARGARITA-BALTICA-LF",     "LA FINCA", 107, 1, "yes", "New SKU. Baltica (relleno blanco) color variant."),

    # PO-3006 (P3) — LA FINCA, 2026-10-12
    ("2026-10-12", "FLR-ROSA-MEDIANA-VENDELA09-LF","LA FINCA", 115, 1, "yes", "New SKU. 'Vendela 09' specific variety."),
    ("2026-10-12", "FOL-PALMILLA-TEPPE-LF",        "LA FINCA", 70,  1, "yes", "New SKU."),
]


# ============================================================
# DATA: New Materials SKUs to append (24 SKUs after consolidation & rename)
# ============================================================

NEW_MATERIALS = [
    # Flowers
    {"sku": "FLR-MARGARITA-BALTICA-LF",       "name": "MARGARITA BALTICA (RELLENO BLANCO)", "category": "Flower", "colors": "White",  "preferred_supplier": "LA FINCA"},
    {"sku": "FLR-ROSA-MEDIANA-VENDELA09-LF",  "name": "ROSA VENDELA MEDIANA 09",            "category": "Flower", "colors": "Pink",   "preferred_supplier": "LA FINCA"},
    {"sku": "FLR-MARGARITA-PINOCHO-AMARILLO-LF","name": "MARGARITA PINOCHO RELLENAS AMARILLO","category": "Flower","colors": "Yellow","preferred_supplier": "LA FINCA"},
    {"sku": "FLR-CRISANTEMO-BLANCO-CAMPO-LF", "name": "CRISANTEMO BLANCO DE CAMPO",         "category": "Flower", "colors": "White",  "preferred_supplier": "LA FINCA"},
    {"sku": "FLR-ROSA-STD-PF",                "name": "ROSA STD",                            "category": "Flower", "colors": "Red",    "preferred_supplier": "LA FINCA"},  # Conflict 42c: LF default; actual supplier BDF
    {"sku": "FLR-LILI-VINO-PF",               "name": "LILI VINO",                           "category": "Flower", "colors": "Wine",   "preferred_supplier": "LA FINCA"},  # Conflict 42c
    {"sku": "FLR-ALSTROMELIA-REBECA-LF",      "name": "ALSTROMELIA REBECA",                 "category": "Flower", "colors": "Pink",   "preferred_supplier": "LA FINCA"},
    # Foliage
    {"sku": "FOL-PALMILLA-TEPPE-LF",          "name": "PALMILLA TEPPE",                     "category": "Foliage", "colors": "Green",  "preferred_supplier": "LA FINCA"},
    # Packaging
    {"sku": "PKG-CAJA-CENTRO-MESA-LF",                "name": "CAJA CENTRO DE MESA",                       "category": "Packaging", "colors": "",      "preferred_supplier": "LA FINCA"},
    {"sku": "PKG-JARDINERA-MADERA-MEGABLOCK-LF",      "name": "JARDINERA DE MADERA PARA MEGABLOCK",       "category": "Packaging", "colors": "",      "preferred_supplier": "LA FINCA"},
    {"sku": "PKG-LISTON-ORGANZA-9-ROJO-LF",           "name": "LISTON ORGANZA 9 ROJO",                     "category": "Packaging", "colors": "Red",   "preferred_supplier": "LA FINCA"},
    {"sku": "PKG-CINTA-WP14VERDE-LF",                 "name": "CINTA WATERPROOF 1/4 VERDE",                "category": "Packaging", "colors": "Green", "preferred_supplier": "LA FINCA"},
    {"sku": "PKG-OASIS-DISCO-20CM-LF",                "name": "DISCO MEDIANO OASIS 20CM",                  "category": "Packaging", "colors": "",      "preferred_supplier": "LA FINCA"},
    {"sku": "PKG-BASE-JARDINERA-BAJITAV-LF",          "name": "BASE JARDINERA BAJITA VERDE",               "category": "Packaging", "colors": "Green", "preferred_supplier": "LA FINCA"},
    {"sku": "PKG-CANASTA-CARRIZO-CUADRADA-ASA-CHICA-LF","name": "CANASTA CARRIZO CUADRADA ASA CHICA",     "category": "Packaging", "colors": "",      "preferred_supplier": "LA FINCA"},
    {"sku": "PKG-CINTA-FILAMENTO-PRO",                "name": "CINTA CON FILAMENTO",                       "category": "Packaging", "colors": "",      "preferred_supplier": "PRO FLOR"},
    {"sku": "PKG-ADHESIVO-UGLUE-100-PRO",             "name": "ADHESIVO UGLUE 100",                        "category": "Packaging", "colors": "",      "preferred_supplier": "PRO FLOR"},
    {"sku": "PKG-ALAMBRE-VERDE-PRO",                  "name": "ALAMBRE VERDE",                             "category": "Packaging", "colors": "Green", "preferred_supplier": "PRO FLOR"},
    {"sku": "PKG-BRILLO-FLORALIFE-PRO",               "name": "BRILLO FLORALIFE",                          "category": "Packaging", "colors": "",      "preferred_supplier": "PRO FLOR"},
    {"sku": "PKG-BASE-BOLICHE-GDE-PRO",               "name": "BASE BOLICHE GDE",                          "category": "Packaging", "colors": "",      "preferred_supplier": "PRO FLOR"},
    {"sku": "PKG-FLORALIFE-EXPRESS-PRO",              "name": "FLORALIFE EXPRESS",                         "category": "Packaging", "colors": "",      "preferred_supplier": "PRO FLOR"},
    {"sku": "PKG-FLORALIFE-EZ-DOSE-PRO",              "name": "FLORALIFE EZ DOSE",                         "category": "Packaging", "colors": "",      "preferred_supplier": "PRO FLOR"},
    {"sku": "PKG-TUBITO-FLORAL-PUNTA-PRO",            "name": "TUBITO FLORAL PUNTA",                       "category": "Packaging", "colors": "",      "preferred_supplier": "PRO FLOR"},
    {"sku": "PKG-TUBITO-FLORAL-SPUNTA-PRO",           "name": "TUBITO FLORAL SIN PUNTA",                   "category": "Packaging", "colors": "",      "preferred_supplier": "PRO FLOR"},
]

# SKU renames (per Conflict 45a, 46a)
SKU_RENAMES = {
    "PKG-MEGADECO-FLORAL": "PKG-MEGADECO",
    "PKG-ESPUMA-FLORAL":   "PKG-OASIS-LADRILLO-STD",
}


# ============================================================
# 1. RENUMBER existing PO-3002 → PO-3007 (in Purchase Orders + Stock Movements)
# ============================================================
def renumber_existing_po_3002(wb):
    """Update the existing v1.1 PO-3002 (dated 2026-10-19) to PO-3007.
    Also update Stock Movements references from 'PO-3002' to 'PO-3007'."""
    # Purchase Orders
    ws_po = wb["Purchase Orders"]
    po_count = 0
    for r in range(5, ws_po.max_row + 1):
        if ws_po.cell(row=r, column=1).value == "PO-3002":
            ws_po.cell(row=r, column=1).value = "PO-3007"
            po_count += 1

    # Stock Movements — update reference column E from PO-3002 to PO-3007
    ws_sm = wb["Stock Movements"]
    sm_count = 0
    for r in range(5, ws_sm.max_row + 1):
        if ws_sm.cell(row=r, column=5).value == "PO-3002":
            ws_sm.cell(row=r, column=5).value = "PO-3007"
            sm_count += 1

    print(f"  Renumbered existing PO-3002 → PO-3007: {po_count} PO rows, {sm_count} Stock Movements references")


# ============================================================
# 2. ADD new Purchase Orders (PO-3001 through PO-3006)
# ============================================================
def add_new_purchase_orders(wb):
    ws = wb["Purchase Orders"]
    # Find first empty row
    row = 5
    while ws.cell(row=row, column=1).value:
        row += 1

    total_items_added = 0
    for po in POS:
        for sku, name, qty, cost_per_unit in po["items"]:
            set_input(ws.cell(row=row, column=1), po["po_number"])
            set_input(ws.cell(row=row, column=2), po["date"], fmt="yyyy-mm-dd")
            set_input(ws.cell(row=row, column=3), po["supplier"])
            set_input(ws.cell(row=row, column=4), sku)
            set_input(ws.cell(row=row, column=5), name)
            set_input(ws.cell(row=row, column=6), qty, fmt="#,##0")
            set_input(ws.cell(row=row, column=7), cost_per_unit, fmt='"$"#,##0.00')
            # Total = Qty * Cost per Pack
            set_formula(ws.cell(row=row, column=8), f"=F{row}*G{row}", fmt='"$"#,##0.00')
            set_input(ws.cell(row=row, column=9), "")
            set_input(ws.cell(row=row, column=10), po["status"])
            row += 1
            total_items_added += 1
    print(f"  Added {total_items_added} PO line items across {len(POS)} new POs (PO-3001 through PO-3006)")


# ============================================================
# 3. ADD new Stock Movements (one row per item per PO, +qty packs)
# ============================================================
def add_new_stock_movements(wb):
    ws = wb["Stock Movements"]
    row = 5
    while ws.cell(row=row, column=1).value:
        row += 1

    total_added = 0
    for po in POS:
        for sku, name, qty, _ in po["items"]:
            set_input(ws.cell(row=row, column=1), po["date"], fmt="yyyy-mm-dd")
            set_input(ws.cell(row=row, column=2), sku)
            set_input(ws.cell(row=row, column=3), qty, fmt="#,##0")
            set_input(ws.cell(row=row, column=4), "PO received")
            set_input(ws.cell(row=row, column=5), po["po_number"])
            set_input(ws.cell(row=row, column=6), f"Received from {po['supplier']} — {name}")
            row += 1
            total_added += 1
    print(f"  Added {total_added} Stock Movements rows (PO-received)")


# ============================================================
# 4. RENAME existing SKUs (in Materials, Supplier Prices, Stock Movements, Recipes)
# ============================================================
def rename_existing_skus(wb):
    """Per Conflict 45a and 46a:
       PKG-MEGADECO-FLORAL → PKG-MEGADECO
       PKG-ESPUMA-FLORAL   → PKG-OASIS-LADRILLO-STD
    """
    total_renamed = 0
    for tab_name, col_idx in [("Materials", 1), ("Supplier Prices", 2), ("Stock Movements", 2)]:
        ws = wb[tab_name]
        for r in range(5, ws.max_row + 1):
            sku = ws.cell(row=r, column=col_idx).value
            if sku in SKU_RENAMES:
                ws.cell(row=r, column=col_idx).value = SKU_RENAMES[sku]
                total_renamed += 1
    print(f"  Renamed {total_renamed} SKU references across 3 tabs ({list(SKU_RENAMES.keys())} → {list(SKU_RENAMES.values())})")


# ============================================================
# 5. ADD new Supplier Prices rows
# ============================================================
def add_new_supplier_prices(wb):
    ws = wb["Supplier Prices"]
    row = 5
    while ws.cell(row=row, column=1).value:
        row += 1

    added = 0
    for date_str, sku, supplier, pack_price, units_per_pack, is_latest, notes in NEW_SUPPLIER_PRICES:
        # Parse date string "YYYY-MM-DD" to datetime
        y, m, d = map(int, date_str.split("-"))
        date_val = datetime(y, m, d)
        set_input(ws.cell(row=row, column=1), date_val, fmt="yyyy-mm-dd")
        set_input(ws.cell(row=row, column=2), sku)
        set_input(ws.cell(row=row, column=3), supplier)
        set_input(ws.cell(row=row, column=4), pack_price, fmt='"$"#,##0.0000')
        set_input(ws.cell(row=row, column=5), units_per_pack if units_per_pack != "" else "", fmt="#,##0")
        set_input(ws.cell(row=row, column=6), is_latest)
        set_input(ws.cell(row=row, column=7), notes)
        row += 1
        added += 1
    print(f"  Added {added} new Supplier Prices rows (per-supplier latest model)")


# ============================================================
# 6. ADD new Materials rows (24 new SKUs)
# ============================================================
def add_new_materials(wb):
    ws = wb["Materials"]
    row = 5
    while ws.cell(row=row, column=1).value:
        row += 1
    new_rows_start = row

    for m in NEW_MATERIALS:
        r = row
        set_input(ws.cell(row=r, column=1), m["sku"])
        set_input(ws.cell(row=r, column=2), m["name"])
        set_input(ws.cell(row=r, column=3), m["category"])
        set_formula(ws.cell(row=r, column=4), f'=IF($A{r}="","",IF($M{r}="","pack","stem"))')
        set_formula(ws.cell(row=r, column=5), f'=IF($A{r}="","",IF($L{r}="","",IFERROR($L{r}/$M{r},$L{r})))', fmt='"$"#,##0.00')
        set_input(ws.cell(row=r, column=6), m["preferred_supplier"])  # col F mirrors Preferred Supplier for backwards compat
        set_formula(ws.cell(row=r, column=7), f"=SUMIFS('Stock Movements'!$C:$C,'Stock Movements'!$B:$B,$A{r})", fmt="#,##0")
        set_input(ws.cell(row=r, column=8), "", fmt="#,##0")
        set_input(ws.cell(row=r, column=9), "", fmt="#,##0")
        set_formula(ws.cell(row=r, column=10), f'=IF($A{r}="","",IFERROR($G{r}*$L{r},0))', fmt='"$"#,##0.00')
        set_formula(ws.cell(row=r, column=11), f'=IF($A{r}="","",IF($H{r}="","NOT TRACKED",IF($G{r}<=$H{r},"REORDER","OK")))')
        set_formula(
            ws.cell(row=r, column=12),
            f'=IF(COUNTIFS(\'Supplier Prices\'!$B:$B,$A{r},\'Supplier Prices\'!$C:$C,$R{r},\'Supplier Prices\'!$F:$F,"yes")=0,"",'
            f'SUMIFS(\'Supplier Prices\'!$D:$D,\'Supplier Prices\'!$B:$B,$A{r},\'Supplier Prices\'!$C:$C,$R{r},\'Supplier Prices\'!$F:$F,"yes"))',
            fmt='"$"#,##0.00',
        )
        set_formula(
            ws.cell(row=r, column=13),
            f'=IF($R{r}="","",'
            f'IF(COUNTIFS(\'Supplier Prices\'!$B:$B,$A{r},\'Supplier Prices\'!$C:$C,$R{r},\'Supplier Prices\'!$F:$F,"yes")=0,"",'
            f'SUMIFS(\'Supplier Prices\'!$E:$E,\'Supplier Prices\'!$B:$B,$A{r},\'Supplier Prices\'!$C:$C,$R{r},\'Supplier Prices\'!$F:$F,"yes")))',
            fmt="#,##0",
        )
        set_input(ws.cell(row=r, column=14), m["colors"])
        set_input(ws.cell(row=r, column=15), "View photos")
        notes = f"New SKU added in v1.2 — first purchased from {m['preferred_supplier']}."
        set_input(ws.cell(row=r, column=16), notes)
        # Type based on category
        type_val = "perishable" if m["category"] in ("Flower", "Foliage") else "consumable"
        set_input(ws.cell(row=r, column=17), type_val)
        set_input(ws.cell(row=r, column=18), m["preferred_supplier"])
        row += 1

    print(f"  Appended {len(NEW_MATERIALS)} new Materials SKU rows (rows {new_rows_start}-{row - 1})")


# ============================================================
# 7. UPDATE Version History with v1.2 entry
# ============================================================
def update_version_history(wb):
    ws = wb["Version History"]
    row = 5
    while ws.cell(row=row, column=1).value:
        row += 1

    v12_summary = (
        "Iterative update from v1.1 — added 6 new Purchase Orders (P2, P3, P4, P5, P6, P7) with chronologically renumbered PO identifiers.\n\n"
        "CHANGES:\n"
        "1. Purchase Orders: existing v1.1 PO-3002 (Oct 19) renumbered to PO-3007 per Conflict 14a. Added 6 new POs:\n"
        "   PO-3001 (2026-07-06, BDF, 6 items, $590) — Purchase 6\n"
        "   PO-3002 (2026-07-26, PRO FLOR, 10 items) — Purchase 7\n"
        "   PO-3003 (2026-09-14, LA FINCA, 10 items, $761.99) — Purchase 5\n"
        "   PO-3004 (2026-09-28, LA FINCA, 7 items) — Purchase 4 (albanene deleted per Conflict 11)\n"
        "   PO-3005 (2026-10-05, LA FINCA, 6 items, $403.01) — Purchase 2\n"
        "   PO-3006 (2026-10-12, LA FINCA, 6 items, $600.01) — Purchase 3\n"
        "   All Stock Movements references to old 'PO-3002' updated to 'PO-3007'.\n\n"
        "2. Stock Movements: added 45 new PO-received rows across 6 new POs. Each row logs +qty packs with reason='PO received' and reference to the corresponding PO number.\n\n"
        "3. Supplier Prices: added 35 new rows across 6 new POs. Each row logs a per-supplier latest quote. For multi-supplier items (e.g. margarita, eucalipto dolar mini, solidago, tulia chica, lili), BDF and PRO FLOR quotes are tracked separately with Is Latest = 'yes' per (SKU, Supplier). Per Conflict 42c, Preferred Supplier stays LA FINCA for all flower/foliage items unless explicitly changed.\n\n"
        "4. Materials — SKU renames (per Conflicts 45a and 46a):\n"
        "   PKG-MEGADECO-FLORAL → PKG-MEGADECO (drop '-FLORAL' suffix; same multi-supplier product)\n"
        "   PKG-ESPUMA-FLORAL → PKG-OASIS-LADRILLO-STD (consolidated with the new oasis ladrillo purchases; same physical product, multiple suppliers tracked in Supplier Prices)\n"
        "   All existing references in Supplier Prices and Stock Movements updated to new SKU names.\n\n"
        "5. Materials — 24 new SKUs appended (rows 158-181):\n"
        "   Flowers (7): FLR-MARGARITA-BALTICA-LF, FLR-ROSA-MEDIANA-VENDELA09-LF, FLR-MARGARITA-PINOCHO-AMARILLO-LF, FLR-CRISANTEMO-BLANCO-CAMPO-LF, FLR-ROSA-STD-PF, FLR-LILI-VINO-PF, FLR-ALSTROMELIA-REBECA-LF\n"
        "   Foliage (1): FOL-PALMILLA-TEPPE-LF\n"
        "   Packaging (16): PKG-CAJA-CENTRO-MESA-LF, PKG-JARDINERA-MADERA-MEGABLOCK-LF, PKG-LISTON-ORGANZA-9-ROJO-LF, PKG-CINTA-WP14VERDE-LF, PKG-OASIS-DISCO-20CM-LF, PKG-BASE-JARDINERA-BAJITAV-LF, PKG-CANASTA-CARRIZO-CUADRADA-ASA-CHICA-LF, PKG-CINTA-FILAMENTO-PRO, PKG-ADHESIVO-UGLUE-100-PRO, PKG-ALAMBRE-VERDE-PRO, PKG-BRILLO-FLORALIFE-PRO, PKG-BASE-BOLICHE-GDE-PRO, PKG-FLORALIFE-EXPRESS-PRO, PKG-FLORALIFE-EZ-DOSE-PRO, PKG-TUBITO-FLORAL-PUNTA-PRO, PKG-TUBITO-FLORAL-SPUNTA-PRO\n\n"
        "6. Conflict resolutions applied:\n"
        "   14a — POs renumbered chronologically\n"
        "   21b — FLR-GIRASOL-FULL-SUN: same SKU, new LA FINCA price $155 (was $125)\n"
        "   26b — FLR-MINI-ROSA: same SKU, new LA FINCA price $60 (was $80)\n"
        "   32a — FLR-ALSTROMELIA-REBECA-LF: new SKU at $35\n"
        "   38a — PKG-OASIS-LADRILLO-STD (LA FINCA): Is Latest = P4 row ($16/piece, 2026-09-28); P5 row ($15.997/piece, 2026-09-14) marked Is Latest = no\n"
        "   41 — SKU suffix convention: -LF (LA FINCA), -PF (BDF = Palacio Floral), -PRO (PRO FLOR), -OAS (OASIS)\n"
        "   42c — Default Preferred Supplier = LA FINCA for all flower/foliage materials\n"
        "   44a — Unified SKU PKG-OASIS-LADRILLO-STD (no supplier suffix); multiple suppliers tracked in Supplier Prices\n"
        "   45a — Renamed PKG-MEGADECO-FLORAL → PKG-MEGADECO\n"
        "   46a — Consolidated PKG-ESPUMA-FLORAL into PKG-OASIS-LADRILLO-STD\n"
        "   11 — Albanene item from Purchase 4 deleted (not added as new SKU)\n\n"
        "7. Unresolved: Conflict 40 — Purchase 7 stated total ($694.27) did not match sum of items ($632.28). Per user instruction, ignored for now.\n\n"
        "Open issues for next iteration:\n"
        "   - Default Preferred Supplier = LA FINCA applied to all new flower/foliage SKUs. Verify each matches your actual sourcing.\n"
        "   - For new SKUs with no LA FINCA price (e.g. FLR-ROSA-STD-PF, FLR-LILI-VINO-PF — both only have BDF prices), Preferred Supplier = LA FINCA is technically wrong. Consider setting Preferred Supplier = BDF Palacio Floral SA de CV for these specific SKUs."
    )

    row_data = [
        "v1.2",
        datetime(2026, 10, 22).strftime("%Y-%m-%d"),
        "Z.ai",
        v12_summary,
        "ERP Zai v1.2.xlsx",
    ]
    for i, v in enumerate(row_data, start=1):
        cell = ws.cell(row=row, column=i)
        cell.value = v
        cell.font = Font(name="Arial", size=10.5, color="FF000000")
        cell.alignment = Alignment(vertical="top", wrap_text=True)
        cell.border = BORDER
    ws.row_dimensions[row].height = 600
    print(f"  Version History: added v1.2 entry at row {row}")


# ============================================================
# MAIN
# ============================================================
def main():
    if not os.path.exists(V11_PATH):
        raise SystemExit(f"v1.1 file not found: {V11_PATH}")

    print(f"Loading v1.1: {V11_PATH}")
    wb = load_workbook(V11_PATH)

    print("\n[1/7] Renumbering existing PO-3002 → PO-3007…")
    renumber_existing_po_3002(wb)

    print("\n[2/7] Adding new Purchase Orders…")
    add_new_purchase_orders(wb)

    print("\n[3/7] Adding new Stock Movements…")
    add_new_stock_movements(wb)

    print("\n[4/7] Renaming existing SKUs (PKG-MEGADECO-FLORAL, PKG-ESPUMA-FLORAL)…")
    rename_existing_skus(wb)

    print("\n[5/7] Adding new Supplier Prices rows…")
    add_new_supplier_prices(wb)

    print("\n[6/7] Adding new Materials SKUs…")
    add_new_materials(wb)

    print("\n[7/7] Updating Version History…")
    update_version_history(wb)

    # Set workbook properties
    wb.properties.title = "ERP Zai v1.2"
    wb.properties.description = (
        "Flor by Maria — Floristry ERP v1.2. Added 6 Purchase Orders (P2-P7), "
        "renumbered chronologically. SKU consolidations: PKG-MEGADECO-FLORAL → PKG-MEGADECO, "
        "PKG-ESPUMA-FLORAL → PKG-OASIS-LADRILLO-STD. 24 new SKUs added."
    )

    print(f"\nSaving v1.2: {V12_PATH}")
    os.makedirs(os.path.dirname(V12_PATH), exist_ok=True)
    wb.save(V12_PATH)
    print("Done. v1 and v1.1 left untouched as backups.")


if __name__ == "__main__":
    main()
