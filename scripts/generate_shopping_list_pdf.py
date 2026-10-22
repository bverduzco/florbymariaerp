"""
Generate a printable PDF shopping list (procurement sheet) in the same style
as the invoice. Used by the "Print" button in the Shopping List panel.

Usage:
    python3 generate_shopping_list_pdf.py <input.json> <output.pdf>

Input JSON shape:
    {
      "weekStartDate": "2026-10-26" | null,
      "planSummary": { "totalBouquets", "totalRevenue", "totalCost", "estimatedProfit", "marginPct", "distinctMaterials", "distinctSuppliers" },
      "shoppingList": [{ "materialSku", "materialName", "category", "supplier", "unit", "totalQty", "unitCost", "totalCost", "packPrice", "unitsPerPack", "packQtyRounded", "totalPackCost", "warning", "usedBy": [{ "productName", "qty", "deliveryDate", "customerName" }] }],
      "bySupplier": { "LA FINCA": { "lines": [...], "totalPackCost": N, "lineCount": N } }
    }

Output: a single-page (or multi-page if needed) A4 PDF with:
  - Flor by Maria logo + header
  - Week date range
  - Summary stats (bouquets, materials, suppliers, est. cost)
  - Per-supplier sections with material rows
  - Pack quantities and warnings
"""

import json
import os
import sys
from datetime import datetime

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    Frame,
    PageTemplate,
    BaseDocTemplate,
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_RIGHT, TA_CENTER


COLOR_ROSE = colors.HexColor("#BE185D")
COLOR_ROSE_LIGHT = colors.HexColor("#FCE7F3")
COLOR_STONE = colors.HexColor("#44403C")
COLOR_STONE_LIGHT = colors.HexColor("#78716C")
COLOR_AMBER = colors.HexColor("#D97706")
COLOR_EMERALD = colors.HexColor("#047857")
COLOR_BORDER = colors.HexColor("#E7E5E4")
COLOR_BG_LIGHT = colors.HexColor("#FAFAF9")
COLOR_BLUE = colors.HexColor("#1D4ED8")
COLOR_BLUE_LIGHT = colors.HexColor("#EFF6FF")


def build_shopping_list(payload, output_path):
    page_w, page_h = A4
    margin = 15 * mm

    doc = BaseDocTemplate(
        output_path,
        pagesize=A4,
        leftMargin=margin,
        rightMargin=margin,
        topMargin=margin,
        bottomMargin=margin,
        title=f"Shopping List - Flor by Maria",
        author="Flor by Maria",
        subject=f"Procurement sheet for week of {payload.get('weekStartDate', '—')}",
        creator="Flor by Maria ERP",
    )

    frame = Frame(
        margin, margin,
        page_w - 2 * margin, page_h - 2 * margin,
        leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0,
        showBoundary=0,
    )

    def on_page(canvas, doc):
        canvas.saveState()
        canvas.setFillColor(COLOR_ROSE)
        canvas.rect(0, page_h - 8 * mm, page_w, 8 * mm, fill=1, stroke=0)
        canvas.restoreState()
        canvas.saveState()
        canvas.setStrokeColor(COLOR_BORDER)
        canvas.setLineWidth(0.5)
        canvas.line(margin, 15 * mm, page_w - margin, 15 * mm)
        canvas.setFont("Helvetica", 8)
        canvas.setFillColor(COLOR_STONE_LIGHT)
        canvas.drawString(margin, 10 * mm, "Flor by Maria · Lista de compras")
        canvas.drawRightString(page_w - margin, 10 * mm, f"Generated {datetime.now().strftime('%d/%m/%Y %H:%M')}")
        canvas.restoreState()

    doc.addPageTemplates([PageTemplate(id="main", frames=[frame], onPage=on_page)])

    styles = getSampleStyleSheet()
    style_logo = ParagraphStyle("Logo", parent=styles["Title"], fontName="Helvetica-Bold", fontSize=20, textColor=COLOR_ROSE, spaceAfter=0, leading=24)
    style_tagline = ParagraphStyle("Tagline", parent=styles["Normal"], fontName="Helvetica-Oblique", fontSize=9, textColor=COLOR_STONE_LIGHT, spaceAfter=6, leading=11)
    style_section = ParagraphStyle("Section", parent=styles["Heading2"], fontName="Helvetica-Bold", fontSize=12, textColor=COLOR_STONE, spaceBefore=8, spaceAfter=4, leading=14)
    style_supplier = ParagraphStyle("Supplier", parent=styles["Heading3"], fontName="Helvetica-Bold", fontSize=11, textColor=COLOR_ROSE, spaceBefore=6, spaceAfter=3, leading=13)
    style_body = ParagraphStyle("Body", parent=styles["Normal"], fontName="Helvetica", fontSize=9, textColor=COLOR_STONE, leading=12)
    style_small = ParagraphStyle("Small", parent=styles["Normal"], fontName="Helvetica", fontSize=8, textColor=COLOR_STONE_LIGHT, leading=10)
    style_warning = ParagraphStyle("Warning", parent=styles["Normal"], fontName="Helvetica-Oblique", fontSize=8, textColor=COLOR_AMBER, leading=10)
    style_used_by = ParagraphStyle("UsedBy", parent=styles["Normal"], fontName="Helvetica", fontSize=7, textColor=COLOR_STONE_LIGHT, leading=9)

    story = []

    # === HEADER ===
    logo_html = '<font color="#BE185D">✿</font> Flor by Maria'
    story.append(Paragraph(logo_html, style_logo))
    story.append(Paragraph("Lista de compras · Procurement sheet", style_tagline))

    week_start = payload.get("weekStartDate")
    if week_start:
        try:
            d = datetime.strptime(week_start, "%Y-%m-%d")
            d_end = datetime.strptime(week_start, "%Y-%m-%d")
            d_end_day = d_end.day + 6
            # Simple: just show the week start
            week_label = f"Week of {d.strftime('%d/%m/%Y')}"
        except Exception:
            week_label = f"Week of {week_start}"
    else:
        week_label = "Current week"

    # Summary stats
    s = payload.get("planSummary", {})
    summary_html = (
        f'<font name="Helvetica-Bold" size="14" color="#44403C">SHOPPING LIST</font>'
        f'<br/><font size="9" color="#78716C">{week_label}</font>'
    )
    stats_html = (
        f'<font size="9" color="#78716C">Bouquets:</font> '
        f'<font name="Helvetica-Bold" size="11" color="#44403C">{s.get("totalBouquets", 0)}</font>'
        f' &nbsp; <font size="9" color="#78716C">Materials:</font> '
        f'<font name="Helvetica-Bold" size="11" color="#44403C">{s.get("distinctMaterials", 0)}</font>'
        f' &nbsp; <font size="9" color="#78716C">Suppliers:</font> '
        f'<font name="Helvetica-Bold" size="11" color="#44403C">{s.get("distinctSuppliers", 0)}</font>'
    )
    # Compute total pack cost
    total_pack_cost = sum(l.get("totalPackCost") or 0 for l in payload.get("shoppingList", []))
    stats_html += (
        f' &nbsp; <font size="9" color="#78716C">Est. cost:</font> '
        f'<font name="Helvetica-Bold" size="11" color="#BE185D">${total_pack_cost:,.0f} MXN</font>'
    )

    header_table = Table(
        [[Paragraph(summary_html, style_body), Paragraph(stats_html, style_body)]],
        colWidths=[70 * mm, 110 * mm],
    )
    header_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("ALIGN", (1, 0), (1, 0), "RIGHT"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 4 * mm))

    # === PER-SUPPLIER SECTIONS ===
    by_supplier = payload.get("bySupplier", {})
    # Sort suppliers alphabetically
    for supplier_name in sorted(by_supplier.keys()):
        group = by_supplier[supplier_name]
        lines = group.get("lines", [])
        group_total = group.get("totalPackCost", 0)

        # Supplier header
        story.append(Paragraph(
            f'{supplier_name} — {group.get("lineCount", len(lines))} items · '
            f'${group_total:,.0f} MXN',
            style_supplier,
        ))

        # Table header
        table_data = [[
            Paragraph('<font color="#FFFFFF" name="Helvetica-Bold" size="8">MATERIAL</font>', style_body),
            Paragraph('<font color="#FFFFFF" name="Helvetica-Bold" size="8">SKU</font>', style_body),
            Paragraph('<font color="#FFFFFF" name="Helvetica-Bold" size="8">NEED</font>', style_body),
            Paragraph('<font color="#FFFFFF" name="Helvetica-Bold" size="8">PACK SIZE</font>', style_body),
            Paragraph('<font color="#FFFFFF" name="Helvetica-Bold" size="8">PACKS</font>', style_body),
            Paragraph('<font color="#FFFFFF" name="Helvetica-Bold" size="8">PACK PRICE</font>', style_body),
            Paragraph('<font color="#FFFFFF" name="Helvetica-Bold" size="8">TOTAL</font>', style_body),
            Paragraph('<font color="#FFFFFF" name="Helvetica-Bold" size="8">USED BY</font>', style_body),
        ]]

        for li in lines:
            need_str = f'{li.get("totalQty", 0)} {li.get("unit", "")}'
            if li.get("totalQty", 0) > 1 and li.get("unit", "") != "pack":
                need_str += "s"

            pack_size_str = str(li.get("unitsPerPack")) if li.get("unitsPerPack") else "?"
            packs_str = str(li.get("packQtyRounded")) if li.get("packQtyRounded") else "?"
            pack_price_str = f'${li.get("packPrice", 0):,.0f}' if li.get("packPrice") else "?"
            total_str = f'${li.get("totalPackCost", 0):,.0f}' if li.get("totalPackCost") else "?"

            # Used by summary
            used_by_parts = []
            for u in li.get("usedBy", []):
                part = f'{u.get("productName", "")} ×{u.get("qty", 1)}'
                if u.get("deliveryDate"):
                    part += f' (deliver {u["deliveryDate"][8:10]}/{u["deliveryDate"][5:7]})'
                used_by_parts.append(part)
            used_by_str = "; ".join(used_by_parts)

            warning_str = ""
            if li.get("warning"):
                warning_str = f'<br/><font color="#D97706" size="7"><i>⚠ {li["warning"]}</i></font>'

            table_data.append([
                Paragraph(f'{li.get("materialName", "")}{warning_str}', style_body),
                Paragraph(f'<font size="7" color="#78716C">{li.get("materialSku", "")}</font>', style_body),
                Paragraph(need_str, style_body),
                Paragraph(pack_size_str, style_body),
                Paragraph(f'<font name="Helvetica-Bold" size="10" color="#BE185D">{packs_str}</font>', style_body),
                Paragraph(pack_price_str, style_body),
                Paragraph(f'<font name="Helvetica-Bold">{total_str}</font>', style_body),
                Paragraph(f'<font size="7" color="#78716C">{used_by_str}</font>', style_body),
            ])

        col_widths = [32*mm, 22*mm, 18*mm, 14*mm, 12*mm, 18*mm, 18*mm, 46*mm]
        items_table = Table(table_data, colWidths=col_widths, repeatRows=1)
        items_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), COLOR_ROSE),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("ALIGN", (2, 0), (-1, -1), "RIGHT"),
            ("ALIGN", (0, 0), (1, -1), "LEFT"),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 4),
            ("RIGHTPADDING", (0, 0), (-1, -1), 4),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, COLOR_BG_LIGHT]),
            ("LINEBELOW", (0, 0), (-1, -1), 0.25, COLOR_BORDER),
            ("BOX", (0, 0), (-1, -1), 0.5, COLOR_BORDER),
        ]))
        story.append(items_table)
        story.append(Spacer(1, 4 * mm))

    # === FOOTER NOTE ===
    story.append(Spacer(1, 4 * mm))
    warnings = [l for l in payload.get("shoppingList", []) if l.get("warning")]
    if warnings:
        story.append(Paragraph(
            f'<font color="#D97706">⚠ {len(warnings)} item(s) have unknown pack sizes — '
            f'confirm with supplier before ordering.</font>',
            style_warning,
        ))

    doc.build(story)


def main():
    if len(sys.argv) != 3:
        print(f"Usage: python3 {sys.argv[0]} <input.json> <output.pdf>", file=sys.stderr)
        sys.exit(1)

    input_path = sys.argv[1]
    output_path = sys.argv[2]

    if not os.path.exists(input_path):
        print(f"Input JSON not found: {input_path}", file=sys.stderr)
        sys.exit(1)

    with open(input_path, encoding="utf-8") as f:
        payload = json.load(f)

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    build_shopping_list(payload, output_path)

    print(f"Shopping list PDF written to: {output_path}")
    print(f"  Materials: {len(payload.get('shoppingList', []))}")
    print(f"  Suppliers: {len(payload.get('bySupplier', {}))}")


if __name__ == "__main__":
    main()
