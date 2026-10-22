"""
Match each El Gato item to the closest ERP SKU.
Outputs an enriched Excel file with an added 'erp_sku' column.

Strategy:
  1. Normalize both names: lowercase, strip accents, remove punctuation
  2. Cross-language synonym map (English ↔ Spanish)
  3. Color normalization (Blanca = White, Roja = Red, etc.)
  4. Score by Levenshtein on normalized names + bonus for shared tokens
  5. Filter by category (flower→flower, foliage→foliage)
  6. Flag matches below confidence threshold for manual review
"""

import json
import os
import re
import unicodedata
from openpyxl import load_workbook, Workbook
from openpyxl.styles import Font, PatternFill, Border, Side, Alignment
from openpyxl.utils import get_column_letter

EL_GATO_PATH = "/home/z/my-project/upload/catalogo precio por tallo El Gato.xlsx"
SEED_PATH = "/home/z/my-project/src/data/seed.json"
OUTPUT_PATH = "/home/z/my-project/download/El Gato matched to ERP.xlsx"

# English ↔ Spanish synonyms (the most common ones for floristry)
SYNONYMS = {
    # English → Spanish
    "alstroemeria": "alstromelia",
    "chrysanthemum": "crisantemo",
    "crisantemo": "crisantemo",
    "lily": "lili",
    "lilis": "lili",
    "rose": "rosa",
    "rosa": "rosa",
    "rosas": "rosa",
    "sunflower": "girasol",
    "gerbera": "gerbera",
    "tulip": "tulipan",
    "tulipan": "tulipan",
    "tulipán": "tulipan",
    "carnation": "clavel",
    "daisy": "margarita",
    "margarita": "margarita",
    "orchid": "orquidea",
    "orquidea": "orquidea",
    "orquídeas": "orquidea",
    "gypsophila": "gipsofilia",
    "baby breath": "gipsofilia",
    "baby bread": "gipsofilia",
    "snapdragon": "perrito",
    "perrito": "perrito",
    "lisianthus": "lisianthus",
    "eucalyptus": "eucalipto",
    "ruscus": "ruscus",
    "solidago": "solidago",
    "hydrangea": "hortensia",
    "hortensia": "hortensia",
    "peony": "peonia",
    "peonia": "peonia",
    "veronica": "veronica",
    "vikingo": "vikingo",
    "yinyang": "yinyang",
    "pins": "pins",
    "argentina": "argentina",
}

# Color normalization: all color variants → canonical form
COLOR_MAP = {
    "white": "blanco", "blanca": "blanco", "blancas": "blanco", "blanco": "blanco",
    "yellow": "amarillo", "amarilla": "amarillo", "amarillas": "amarillo", "amarillo": "amarillo",
    "red": "rojo", "roja": "rojo", "rojas": "rojo", "rojo": "rojo",
    "pink": "rosa", "rosa": "rosa", "rosas": "rosa", "caricia": "rosa",
    "orange": "naranja", "naranja": "naranja", "naranjas": "naranja",
    "purple": "morado", "morado": "morado", "morados": "morado", "lila": "morado", "fiusha": "morado",
    "fuchsia": "morado", "fiusha": "morado",
    "blue": "azul", "azul": "azul",
    "green": "verde", "verde": "verde",
    "beige": "beige", "porcelain": "beige",
    "maxima": "maxima",
}

# Items that should always be skipped (parsing artifacts, headers, etc.)
SKIP_ITEMS = {"item"}


def normalize(s):
    """Lowercase, strip accents, remove punctuation, collapse whitespace."""
    if not s:
        return ""
    s = unicodedata.normalize("NFD", str(s).lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = re.sub(r"[^a-z\s]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def tokenize(s):
    """Split into tokens, apply synonyms + color normalization."""
    if not s:
        return []
    raw_tokens = s.split()
    out = []
    for t in raw_tokens:
        # Multi-word synonyms (e.g. "baby breath" → "gipsofilia")
        if t == "baby":
            continue  # Will be handled in bigram pass below
        # Color normalization
        if t in COLOR_MAP:
            out.append(COLOR_MAP[t])
        elif t in SYNONYMS:
            out.append(SYNONYMS[t])
        else:
            out.append(t)
    return out


def normalize_with_synonyms(s):
    """Apply synonym + color normalization to a full name string."""
    norm = normalize(s)
    # Bigram replacements for "baby bread", "baby breath", "baby breathe"
    norm = re.sub(r"\bbaby (?:bread|breath|breathe|bread)\b", "gipsofilia", norm)
    tokens = tokenize(norm)
    return " ".join(tokens)


def levenshtein(a, b):
    if len(a) < len(b):
        a, b = b, a
    if len(b) == 0:
        return len(a)
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        curr = [i]
        for j, cb in enumerate(b, 1):
            ins = prev[j] + 1
            dele = curr[j - 1] + 1
            sub = prev[j - 1] + (ca != cb)
            curr.append(min(ins, dele, sub))
        prev = curr
    return prev[-1]


def jaccard_similarity(a_tokens, b_tokens):
    """Token-based Jaccard similarity (0-1, higher is better)."""
    a_set = set(a_tokens)
    b_set = set(b_tokens)
    if not a_set or not b_set:
        return 0
    intersection = a_set & b_set
    union = a_set | b_set
    return len(intersection) / len(union)


def score_match(el_gato_item, erp_material):
    """Score a match between El Gato item and ERP material. Lower = better.

    Heavily weights species-name token overlap (e.g. "LILI" must match "Lilis"),
    with color as a tiebreaker.
    """
    a_norm = normalize_with_synonyms(el_gato_item["name"])
    b_norm = normalize_with_synonyms(erp_material["name"])

    a_tokens = a_norm.split()
    b_tokens = b_norm.split()

    # Separate species tokens from color tokens
    # Note: "rosa" can be BOTH a species (rose) AND a color (pink).
    # Strategy: only treat "rosa" as color if there's ANOTHER species token in the name.
    # e.g. "Mini Rosa" → "rosa" is species (mini is just a modifier, also species).
    # "Rosa Blanca" → "rosa" is species, "blanca" is color.
    # "Margarita Rosa" → "margarita" is species, "rosa" is color.
    COLOR_WORDS = set(COLOR_MAP.values()) | set(COLOR_MAP.keys())
    # Drop "rosa" from color words for now — handle it specially below
    COLOR_WORDS_NO_ROSA = COLOR_WORDS - {"rosa"}

    a_tokens_no_syn = normalize(el_gato_item["name"]).split()
    b_tokens_no_syn = normalize(erp_material["name"]).split()

    # Find species tokens (anything not a color)
    a_species = [t for t in a_tokens if t not in COLOR_WORDS_NO_ROSA]
    b_species = [t for t in b_tokens if t not in COLOR_WORDS_NO_ROSA]
    # Now: is "rosa" the only species token, or is there another?
    # If a_species = ["rosa"] only → "rosa" is species
    # If a_species = ["mini", "rosa"] → "rosa" is species (mini is a modifier, both species)
    # If a_species = ["margarita", "rosa"] → "rosa" might be color, drop it
    # Heuristic: if there's another species token besides "rosa", treat "rosa" as color
    a_other_species = [t for t in a_species if t != "rosa"]
    b_other_species = [t for t in b_species if t != "rosa"]
    if a_other_species and "rosa" in a_species:
        a_species = a_other_species  # treat "rosa" as color
        a_colors = ["rosa"]
    else:
        a_colors = [t for t in a_tokens if t in COLOR_WORDS_NO_ROSA]
    if b_other_species and "rosa" in b_species:
        b_species = b_other_species
        b_colors = ["rosa"]
    else:
        b_colors = [t for t in b_tokens if t in COLOR_WORDS_NO_ROSA]

    # Species overlap: how many of El Gato's species tokens appear in ERP species tokens?
    a_set = set(a_species)
    b_set = set(b_species)
    species_intersection = a_set & b_set
    species_union = a_set | b_set
    species_jac = len(species_intersection) / max(len(species_union), 1)
    # Coverage: how much of the El Gato name does the ERP cover?
    species_coverage = len(species_intersection) / max(len(a_set), 1)

    # Color match
    color_match = 0
    if a_colors and b_colors:
        a_color_set = set(a_colors)
        b_color_set = set(b_colors)
        if a_color_set & b_color_set:
            color_match = 1  # color matches
        else:
            color_match = -1  # color mismatch
    elif a_colors and not b_colors:
        color_match = 0  # neutral: El Gato has color, ERP doesn't
    elif not a_colors and b_colors:
        color_match = 0  # neutral: El Gato no color, ERP has color

    # Levenshtein on species-only strings (species name similarity)
    a_species_str = " ".join(a_species)
    b_species_str = " ".join(b_species)
    if a_species_str and b_species_str:
        lev = levenshtein(a_species_str, b_species_str)
        max_len = max(len(a_species_str), len(b_species_str), 1)
        lev_score = lev / max_len
    else:
        lev_score = 1.0  # no species → worst score

    # Final weighted score (lower = better match)
    # Species coverage is the dominant signal (0-1, lower is better when 1-coverage)
    species_component = (1 - species_coverage) * 0.5 + (1 - species_jac) * 0.2
    # Levenshtein contributes
    lev_component = lev_score * 0.3
    # Color as tiebreaker
    if color_match == 1:
        color_component = -0.05  # small bonus
    elif color_match == -1:
        color_component = 0.15   # meaningful penalty
    else:
        color_component = 0

    return species_component + lev_component + color_component


def best_match(el_gato_item, erp_materials):
    """Find the best matching ERP material for an El Gato item."""
    el_gato_type = el_gato_item["type"]
    candidates = []
    for m in erp_materials:
        # Filter by category
        if el_gato_type == "flower" and m["category"] != "flower":
            continue
        if el_gato_type == "foliage" and m["category"] != "foliage":
            continue
        score = score_match(el_gato_item, m)
        candidates.append((score, m))
    candidates.sort(key=lambda x: x[0])
    if not candidates:
        return None, None, 1.0
    best_score, best_mat = candidates[0]
    return best_mat, best_score, best_score


def main():
    print("=" * 70)
    print("MATCHING EL GATO ITEMS TO ERP SKUs")
    print("=" * 70)

    # Load El Gato items
    wb = load_workbook(EL_GATO_PATH, data_only=True)
    ws = wb.active
    el_gato_items = []
    for r in range(4, ws.max_row + 1):
        name = ws.cell(row=r, column=1).value
        if not name or str(name).strip().lower() in SKIP_ITEMS:
            continue
        price_raw = ws.cell(row=r, column=2).value
        type_ = ws.cell(row=r, column=3).value
        class_ = ws.cell(row=r, column=4).value
        price = None
        if isinstance(price_raw, (int, float)):
            price = float(price_raw)
        elif isinstance(price_raw, str):
            m = re.search(r"[\$]?\s*([\d,]+\.?\d*)", price_raw)
            if m:
                price = float(m.group(1).replace(",", ""))
        el_gato_items.append({
            "row": r,
            "name": str(name).strip(),
            "price": price,
            "type": str(type_).strip() if type_ else "",
            "class": str(class_).strip() if class_ else "",
        })
    print(f"Loaded {len(el_gato_items)} El Gato items")

    # Load ERP materials
    with open(SEED_PATH, encoding="utf-8") as f:
        seed = json.load(f)
    erp_materials = seed["materials"]
    print(f"Loaded {len(erp_materials)} ERP materials")

    # Match each item
    print()
    print("--- MATCHING ---")
    matches = []
    for item in el_gato_items:
        best_mat, best_score, _ = best_match(item, erp_materials)
        if best_mat:
            erp_sku = best_mat["sku"]
            erp_name = best_mat["name"]
            erp_price = best_mat.get("packPrice")
            erp_unit_cost = best_mat.get("unitCost")
            # Confidence tier
            if best_score < 0.25:
                tier = "HIGH"
            elif best_score < 0.45:
                tier = "MEDIUM"
            elif best_score < 0.65:
                tier = "LOW"
            else:
                tier = "VERY_LOW"
        else:
            erp_sku = ""
            erp_name = ""
            erp_price = None
            erp_unit_cost = None
            tier = "NO_MATCH"
            best_score = 1.0

        matches.append({
            **item,
            "erp_sku": erp_sku,
            "erp_name": erp_name,
            "erp_pack_price": erp_price,
            "erp_unit_cost": erp_unit_cost,
            "match_score": round(best_score, 3),
            "match_confidence": tier,
        })

        flag = {"HIGH": "✅", "MEDIUM": "🟡", "LOW": "⚠️", "VERY_LOW": "❌", "NO_MATCH": "💀"}[tier]
        print(f"  {flag} {item['name'][:35]:35s} (${item['price']:>5.0f}) → {erp_sku:30s} {erp_name[:25]:25s} [score={best_score:.2f}]")

    # Stats
    print()
    by_tier = {}
    for m in matches:
        by_tier[m["match_confidence"]] = by_tier.get(m["match_confidence"], 0) + 1
    print("--- SUMMARY ---")
    print(f"  HIGH confidence:  {by_tier.get('HIGH', 0)}")
    print(f"  MEDIUM:           {by_tier.get('MEDIUM', 0)}")
    print(f"  LOW:              {by_tier.get('LOW', 0)}")
    print(f"  VERY_LOW:         {by_tier.get('VERY_LOW', 0)}")
    print(f"  NO_MATCH:         {by_tier.get('NO_MATCH', 0)}")

    # Write enriched Excel
    print()
    print(f"Writing enriched Excel to: {OUTPUT_PATH}")
    write_enriched_excel(matches, OUTPUT_PATH)
    print("Done.")


def write_enriched_excel(matches, output_path):
    out_wb = Workbook()
    ws = out_wb.active
    ws.title = "El Gato matched"

    HEADER_FILL = PatternFill(fill_type="solid", fgColor="FF2F5233")
    HEADER_FONT = Font(name="Arial", size=10.5, bold=True, color="FFFFFFFF")
    HEADER_ALIGN = Alignment(horizontal="center", vertical="center", wrap_text=True)
    THIN = Side(border_style="thin", color="FF000000")
    BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)

    # Title rows
    ws["A1"] = "El Gato catalogue — matched to ERP SKUs"
    ws["A1"].font = Font(name="Arial", size=14, bold=True, color="FF1F3B4D")
    ws["A2"] = f"Generated by Z.ai matcher. Review MEDIUM/LOW/VERY_LOW confidence matches."
    ws["A2"].font = Font(name="Arial", size=10, italic=True, color="FF6B8E6B")

    # Header row
    headers = [
        "El Gato Item", "Price (MXN/stem)", "Type", "Class",
        "Matched ERP SKU", "ERP Name", "ERP Pack Price (MXN)", "ERP Unit Cost (MXN)",
        "Match Score (0=perfect, 1=worst)", "Confidence", "Notes",
    ]
    for i, h in enumerate(headers, start=1):
        c = ws.cell(row=4, column=i, value=h)
        c.font = HEADER_FONT
        c.fill = HEADER_FILL
        c.alignment = HEADER_ALIGN
        c.border = BORDER

    # Data rows
    for r, m in enumerate(matches, start=5):
        row = [
            m["name"], m["price"], m["type"], m["class"],
            m["erp_sku"], m["erp_name"], m["erp_pack_price"], m["erp_unit_cost"],
            m["match_score"], m["match_confidence"],
            "",  # Notes column — blank, for user to fill
        ]
        for c, val in enumerate(row, start=1):
            cell = ws.cell(row=r, column=c, value=val)
            cell.font = Font(name="Arial", size=10.5, color="FF000000")
            cell.border = BORDER
            if c == 2 or c == 7 or c == 8:
                cell.number_format = '"$"#,##0.00'
            if c == 9:
                cell.number_format = "0.000"
            # Color-code confidence
            if c == 10:
                if m["match_confidence"] == "HIGH":
                    cell.fill = PatternFill(fill_type="solid", fgColor="FFD1FAE5")  # emerald-100
                elif m["match_confidence"] == "MEDIUM":
                    cell.fill = PatternFill(fill_type="solid", fgColor="FFFEF3C7")  # amber-100
                elif m["match_confidence"] == "LOW":
                    cell.fill = PatternFill(fill_type="solid", fgColor="FFFED7AA")  # orange-200
                elif m["match_confidence"] == "VERY_LOW":
                    cell.fill = PatternFill(fill_type="solid", fgColor="FFFECACA")  # red-200
                else:
                    cell.fill = PatternFill(fill_type="solid", fgColor="FFE5E7EB")  # gray-200

    # Column widths
    widths = [30, 14, 10, 10, 30, 30, 16, 16, 14, 12, 30]
    for i, w in enumerate(widths, start=1):
        ws.column_dimensions[get_column_letter(i)].width = w

    ws.freeze_panes = "A5"

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    out_wb.save(output_path)


if __name__ == "__main__":
    main()
