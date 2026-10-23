"""
Generate a customer-facing PDF recibo (receipt) for a florist order.

Usage:
    python3 generate_invoice_pdf.py <input.json> <output.pdf>

Input JSON shape:
    {
      "orderNumber": "ORD-1001",
      "createdAt": "2026-...",
      "deliveryDate": "2026-11-05" | null,
      "customer": { "name": "...", "phone": "...", "email": "...", "address": "..." },
      "cardMessage": "..." | null,
      "lineItems": [{ "productName": "...", "productSize": "Large" | null, "qty": 1, "unitPrice": 1700, "lineTotal": 1700 }, ...],
      "subtotal": 3550,
      "iva": 568,
      "deliveryFee": 100,
      "discount": 0,
      "total": 4218,
      "paymentMethod": "cash" | "spei" | "online_link" | null
    }

Output: a single-page A4 PDF recibo (in Spanish) with:
  - Flor by Maria logo (text-based, rose-colored)
  - Business info
  - Para: customer + delivery address
  - Recibo # + dates (in Spanish, GMT-6)
  - Line items table (PRODUCTO / CANT. / PRECIO UNIT. / TOTAL)
  - Totals (Subtotal, IVA, Envío, Descuento, Total)
  - Mensaje de tarjeta (if any)
  - Instrucciones de pago
  - Footer (Spanish)
"""

import json
import os
import sys
from datetime import datetime, timedelta, timezone

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


# Brand colors — warm rose palette matching the app
COLOR_ROSE = colors.HexColor("#BE185D")        # rose-700
COLOR_ROSE_LIGHT = colors.HexColor("#FCE7F3")  # rose-50
COLOR_STONE = colors.HexColor("#44403C")        # stone-700
COLOR_STONE_LIGHT = colors.HexColor("#78716C")  # stone-500
COLOR_AMBER = colors.HexColor("#D97706")        # amber-600
COLOR_EMERALD = colors.HexColor("#047857")      # emerald-700
COLOR_BORDER = colors.HexColor("#E7E5E4")      # stone-200
COLOR_BG_LIGHT = colors.HexColor("#FAFAF9")     # stone-50


def build_invoice(payload: dict, output_path: str) -> None:
    """Build the recibo (customer-facing receipt) PDF."""
    # Fechas en español, usando GMT-6 (Mexico City, no DST desde 2022).
    GMT_MINUS_6 = timezone(timedelta(hours=-6))
    MESES_ES = [
        "enero", "febrero", "marzo", "abril", "mayo", "junio",
        "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
    ]

    page_w, page_h = A4
    margin = 18 * mm

    doc = BaseDocTemplate(
        output_path,
        pagesize=A4,
        leftMargin=margin,
        rightMargin=margin,
        topMargin=margin,
        bottomMargin=margin,
        title=f"Recibo {payload.get('orderNumber', '')} - Flor by Maria",
        author="Flor by Maria",
        subject=f"Recibo {payload.get('orderNumber', '')}",
        creator="Flor by Maria ERP",
    )

    # One frame for the body content
    frame = Frame(
        margin, margin,
        page_w - 2 * margin, page_h - 2 * margin,
        leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0,
        showBoundary=0,
    )

    def on_page(canvas, doc):
        # Top decorative band (rose)
        canvas.saveState()
        canvas.setFillColor(COLOR_ROSE)
        canvas.rect(0, page_h - 8 * mm, page_w, 8 * mm, fill=1, stroke=0)
        canvas.restoreState()

        # Footer line + page number
        canvas.saveState()
        canvas.setStrokeColor(COLOR_BORDER)
        canvas.setLineWidth(0.5)
        canvas.line(margin, 18 * mm, page_w - margin, 18 * mm)
        canvas.setFont("Helvetica", 8)
        canvas.setFillColor(COLOR_STONE_LIGHT)
        canvas.drawString(margin, 12 * mm, "Flor by Maria · Gracias por su compra")
        canvas.drawRightString(page_w - margin, 12 * mm, f"Recibo {payload.get('orderNumber', '')}")
        canvas.restoreState()

    doc.addPageTemplates([PageTemplate(id="main", frames=[frame], onPage=on_page)])

    # Styles
    styles = getSampleStyleSheet()

    style_logo = ParagraphStyle(
        "Logo", parent=styles["Title"],
        fontName="Helvetica-Bold", fontSize=24, textColor=COLOR_ROSE,
        spaceAfter=0, leading=28,
    )
    style_tagline = ParagraphStyle(
        "Tagline", parent=styles["Normal"],
        fontName="Helvetica-Oblique", fontSize=10, textColor=COLOR_STONE_LIGHT,
        spaceAfter=6, leading=12,
    )
    style_business_info = ParagraphStyle(
        "BusinessInfo", parent=styles["Normal"],
        fontName="Helvetica", fontSize=9, textColor=COLOR_STONE,
        leading=12,
    )
    style_section_heading = ParagraphStyle(
        "SectionHeading", parent=styles["Heading2"],
        fontName="Helvetica-Bold", fontSize=10, textColor=COLOR_STONE,
        spaceBefore=10, spaceAfter=4, leading=12,
    )
    style_body = ParagraphStyle(
        "Body", parent=styles["Normal"],
        fontName="Helvetica", fontSize=10, textColor=COLOR_STONE,
        leading=14,
    )
    style_small = ParagraphStyle(
        "Small", parent=styles["Normal"],
        fontName="Helvetica", fontSize=8, textColor=COLOR_STONE_LIGHT,
        leading=10,
    )
    style_card_msg = ParagraphStyle(
        "CardMsg", parent=styles["Normal"],
        fontName="Helvetica-Oblique", fontSize=10, textColor=COLOR_ROSE,
        leading=14,
    )
    style_payment = ParagraphStyle(
        "Payment", parent=styles["Normal"],
        fontName="Helvetica", fontSize=9, textColor=COLOR_STONE,
        leading=12,
    )
    style_total_label = ParagraphStyle(
        "TotalLabel", parent=styles["Normal"],
        fontName="Helvetica-Bold", fontSize=12, textColor=COLOR_STONE,
    )
    style_total_value = ParagraphStyle(
        "TotalValue", parent=styles["Normal"],
        fontName="Helvetica-Bold", fontSize=14, textColor=COLOR_ROSE,
        alignment=TA_RIGHT,
    )

    # Build the story
    story = []

    # === HEADER: Logo + business info (left) | Recibo meta (right) ===
    logo_html = '<font color="#BE185D">✿</font> Flor by Maria'
    business_info_html = (
        "Flor by Maria<br/>"
        "Arreglos florales &amp; bouquets<br/>"
        "Ciudad de México<br/>"
        "WhatsApp: (pendiente)<br/>"
        "Email: hola@florbymaria.mx"
    )

    created_at = payload.get("createdAt", "")
    try:
        created_dt = datetime.fromisoformat(created_at.replace("Z", "+00:00")).astimezone(GMT_MINUS_6)
        created_date = f"{created_dt.day} de {MESES_ES[created_dt.month - 1]} de {created_dt.year}"
    except Exception:
        created_date = created_at[:10] if created_date else ""

    delivery_date = payload.get("deliveryDate", "")
    try:
        delivery_dt = datetime.strptime(delivery_date, "%Y-%m-%d")
        delivery_date_fmt = f"{delivery_dt.day} de {MESES_ES[delivery_dt.month - 1]} de {delivery_dt.year}" if delivery_date else "—"
    except Exception:
        delivery_date_fmt = delivery_date or "—"

    invoice_meta_html = (
        f'<font name="Helvetica-Bold" size="14" color="#44403C">RECIBO</font><br/>'
        f'<font size="9" color="#78716C">#</font> '
        f'<font name="Helvetica-Bold" size="11" color="#44403C">{payload.get("orderNumber", "")}</font><br/><br/>'
        f'<font size="9" color="#78716C">Fecha de emisión:</font><br/>'
        f'<font size="10" color="#44403C">{created_date}</font><br/><br/>'
        f'<font size="9" color="#78716C">Fecha de entrega:</font><br/>'
        f'<font name="Helvetica-Bold" size="10" color="#BE185D">{delivery_date_fmt}</font>'
    )

    header_table = Table(
        [
            [
                Paragraph(logo_html, style_logo),
                Paragraph(invoice_meta_html, style_body),
            ],
            [
                Paragraph("Bouquets &amp; arreglos personalizados", style_tagline),
                "",
            ],
            [
                Paragraph(business_info_html, style_business_info),
                "",
            ],
        ],
        colWidths=[95 * mm, 79 * mm],
    )
    header_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 12 * mm))

    # === BILL TO + DELIVERY ===
    customer = payload.get("customer", {})
    bill_to_lines = []
    if customer.get("name"):
        bill_to_lines.append(f'<font name="Helvetica-Bold">{customer["name"]}</font>')
    if customer.get("phone"):
        bill_to_lines.append(f'Tel: {customer["phone"]}')
    if customer.get("email"):
        bill_to_lines.append(customer["email"])
    bill_to_html = "<br/>".join(bill_to_lines) if bill_to_lines else "—"

    delivery_lines = []
    if payload.get("deliveryAddress"):
        delivery_lines.append(payload["deliveryAddress"])
    elif customer.get("address"):
        delivery_lines.append(customer["address"])
    else:
        delivery_lines.append("Recoger en taller")
    delivery_html = "<br/>".join(delivery_lines)

    bill_to_table = Table(
        [
            [Paragraph('<font color="#78716C" size="9">PARA</font>', style_body),
             Paragraph('<font color="#78716C" size="9">ENTREGAR EN</font>', style_body)],
            [Paragraph(bill_to_html, style_body),
             Paragraph(delivery_html, style_body)],
        ],
        colWidths=[87 * mm, 87 * mm],
    )
    bill_to_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("BACKGROUND", (0, 0), (-1, 0), COLOR_BG_LIGHT),
        ("LINEBELOW", (0, 0), (-1, 0), 0.5, COLOR_BORDER),
        ("BOX", (0, 0), (-1, -1), 0.5, COLOR_BORDER),
    ]))
    story.append(bill_to_table)
    story.append(Spacer(1, 8 * mm))

    # === TABLA DE PRODUCTOS ===
    line_items_data = [[
        Paragraph('<font color="#FFFFFF" name="Helvetica-Bold" size="9">PRODUCTO</font>', style_body),
        Paragraph('<font color="#FFFFFF" name="Helvetica-Bold" size="9">CANT.</font>', style_body),
        Paragraph('<font color="#FFFFFF" name="Helvetica-Bold" size="9">PRECIO UNIT.</font>', style_body),
        Paragraph('<font color="#FFFFFF" name="Helvetica-Bold" size="9">TOTAL</font>', style_body),
    ]]

    for li in payload.get("lineItems", []):
        product_text = li.get("productName", "")
        if li.get("productSize"):
            product_text += f' <font size="8" color="#78716C">({li["productSize"]})</font>'
        line_items_data.append([
            Paragraph(product_text, style_body),
            Paragraph(str(li.get("qty", 0)), style_body),
            Paragraph(f'${li.get("unitPrice", 0):,.0f} MXN', style_body),
            Paragraph(f'${li.get("lineTotal", 0):,.0f} MXN', style_body),
        ])

    items_table = Table(
        line_items_data,
        colWidths=[87 * mm, 18 * mm, 35 * mm, 34 * mm],
        repeatRows=1,
    )
    items_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), COLOR_ROSE),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
        ("ALIGN", (0, 0), (0, -1), "LEFT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, COLOR_BG_LIGHT]),
        ("LINEBELOW", (0, 0), (-1, -1), 0.25, COLOR_BORDER),
        ("BOX", (0, 0), (-1, -1), 0.5, COLOR_BORDER),
    ]))
    story.append(items_table)
    story.append(Spacer(1, 6 * mm))

    # === TOTALS ===
    subtotal = payload.get("subtotal", 0)
    iva = payload.get("iva", 0)
    delivery_fee = payload.get("deliveryFee", 0)
    discount = payload.get("discount", 0)
    total = payload.get("total", 0)

    totals_data = [
        [Paragraph("Subtotal (pre-IVA)", style_body),
         Paragraph(f"${subtotal:,.0f} MXN", style_body)],
        [Paragraph("IVA (16%)", style_body),
         Paragraph(f"${iva:,.0f} MXN", style_body)],
        [Paragraph("Envío", style_body),
         Paragraph(f"${delivery_fee:,.0f} MXN", style_body)],
    ]
    if discount > 0:
        totals_data.append([
            Paragraph('<font color="#BE185D">Descuento</font>', style_body),
            Paragraph(f'<font color="#BE185D">−${discount:,.0f} MXN</font>', style_body),
        ])
    totals_data.append([
        Paragraph("TOTAL", style_total_label),
        Paragraph(f"${total:,.0f} MXN", style_total_value),
    ])

    totals_table = Table(
        totals_data,
        colWidths=[110 * mm, 64 * mm],
    )
    totals_table.setStyle(TableStyle([
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        # Last row (total) highlighted
        ("BACKGROUND", (0, -1), (-1, -1), COLOR_ROSE_LIGHT),
        ("LINEABOVE", (0, -1), (-1, -1), 1, COLOR_ROSE),
        ("LINEBELOW", (0, -1), (-1, -1), 0.5, COLOR_BORDER),
    ]))
    story.append(totals_table)
    story.append(Spacer(1, 8 * mm))

    # === MENSAJE DE TARJETA (si existe) ===
    card_msg = payload.get("cardMessage")
    if card_msg:
        card_table = Table(
            [[
                Paragraph(
                    f'<font color="#78716C" size="9">MENSAJE DE TARJETA</font><br/><br/>'
                    f'<font name="Helvetica-Oblique" color="#BE185D" size="10">"{card_msg}"</font>',
                    style_body,
                )
            ]],
            colWidths=[174 * mm],
        )
        card_table.setStyle(TableStyle([
            ("LEFTPADDING", (0, 0), (-1, -1), 12),
            ("RIGHTPADDING", (0, 0), (-1, -1), 12),
            ("TOPPADDING", (0, 0), (-1, -1), 8),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ("BACKGROUND", (0, 0), (-1, -1), COLOR_ROSE_LIGHT),
            ("BOX", (0, 0), (-1, -1), 0.5, COLOR_ROSE),
        ]))
        story.append(card_table)
        story.append(Spacer(1, 6 * mm))

    # === INSTRUCCIONES DE PAGO ===
    payment_method = payload.get("paymentMethod")
    payment_lines = []

    if payment_method == "cash":
        payment_lines.append(
            '<font name="Helvetica-Bold" color="#047857">Pago: Efectivo contra entrega</font><br/>'
            'Por favor ten el monto exacto listo al recibir tu bouquet.'
        )
    elif payment_method == "spei":
        payment_lines.append(
            '<font name="Helvetica-Bold" color="#44403C">Pago: Transferencia SPEI</font><br/>'
            'Banco: Banco Ejemplo<br/>'
            'CLABE: 012 345 67890 1234567<br/>'
            'Titular: Flor by Maria<br/>'
            'Referencia: ' + payload.get("orderNumber", "") + '<br/>'
            '<font color="#78716C">Envía el comprobante por WhatsApp una vez transferido.</font>'
        )
    elif payment_method == "online_link":
        payment_lines.append(
            '<font name="Helvetica-Bold" color="#44403C">Pago: En línea</font><br/>'
            'Recibirás un enlace de pago seguro por WhatsApp en breve.<br/>'
            '<font color="#78716C">El enlace expira en 24 horas.</font>'
        )
    else:
        payment_lines.append(
            '<font color="#78716C">Método de pago por confirmar. Te contactaremos por WhatsApp en breve.</font>'
        )

    payment_html = "<br/>".join(payment_lines)
    payment_table = Table(
        [[Paragraph(payment_html, style_payment)]],
        colWidths=[174 * mm],
    )
    payment_table.setStyle(TableStyle([
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
        ("RIGHTPADDING", (0, 0), (-1, -1), 12),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("BACKGROUND", (0, 0), (-1, -1), COLOR_BG_LIGHT),
        ("BOX", (0, 0), (-1, -1), 0.5, COLOR_BORDER),
    ]))
    story.append(payment_table)
    story.append(Spacer(1, 4 * mm))

    # === NOTA DE AGRADECIMIENTO ===
    story.append(Paragraph(
        '<font color="#78716C" size="9">'
        'Gracias por elegir a Flor by Maria. '
        'Cada bouquet se elabora con amor y cuidado. '
        'Para dudas sobre tu pedido, contáctanos por WhatsApp.'
        '</font>',
        style_small,
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
    build_invoice(payload, output_path)

    print(f"Recibo PDF written to: {output_path}")
    print(f"  Order: {payload.get('orderNumber', '?')}")
    print(f"  Customer: {payload.get('customer', {}).get('name', '?')}")
    print(f"  Line items: {len(payload.get('lineItems', []))}")
    print(f"  Total: ${payload.get('total', 0):,.0f} MXN")


if __name__ == "__main__":
    main()
