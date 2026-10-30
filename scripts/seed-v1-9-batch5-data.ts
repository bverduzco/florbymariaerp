// scripts/seed-v1-9-batch5-data.ts
//
// Seeds demo data for Batch 5 (final batch):
//   - Legal templates (LT-001 to LT-004 with full text)
//   - Template variables (placeholder → data source mapping)

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const LEGAL_TEMPLATES = [
  {
    templateNumber: "LT-001",
    name: "Aviso de Privacidad (Corto)",
    appliesTo: "all_quotes",
    trigger: "Shown at the bottom of every quote/estimate. Customer accepts by accepting the quote.",
    templateText: "Aviso de Privacidad. [Nombre o razón social], con domicilio en [domicilio], es responsable de sus datos personales, que usamos para cotizar, elaborar, entregar y facturar su pedido, y para cumplir obligaciones legales. Podemos compartirlos con proveedores de entrega, montaje y renta, y con autoridades fiscales, solo cuando sea necesario para el servicio. Si no desea que los usemos para promociones o para publicar fotos de su evento, escríbanos a [correo]. Puede ejercer sus derechos de acceso, rectificación, supresión, oposición, limitación y portabilidad, o revocar su consentimiento, en ese mismo correo. Aviso integral: [URL] · [QR] Al aceptar esta cotización, usted confirma haber leído el Aviso de Privacidad.",
    placeholdersNeeded: "Nombre o razón social, domicilio, correo, URL, QR",
    version: "v1.0",
    lastUpdated: new Date("2026-10-24"),
  },
  {
    templateNumber: "LT-002",
    name: "Condiciones de Pedidos Pequeños",
    appliesTo: "small_orders",
    trigger: "Attached to small/bouquet orders (not events). Customer accepts by paying.",
    templateText: "Condiciones de Pedidos Pequeños\n\nAl confirmar tu pedido aceptas estas condiciones.\n\nPago: el pedido se paga al 100% al confirmarlo. Sin pago, no se aparta la fecha ni se compran las flores.\n\nAnticipación: necesitamos al menos [48 horas]. Si es con menos tiempo, aplica un cargo por urgencia de [20%] y depende de disponibilidad.\n\nCancelaciones: el pago no es reembolsable. Si avisas con [48 horas] o más, podemos reprogramar tu pedido a otra fecha, sujeto a disponibilidad.\n\nFlores naturales: pueden variar un poco en tono y tamaño según la temporada. Si alguna flor no está disponible, la sustituimos por otra de igual o mayor valor, respetando tu paleta de colores.\n\nEntrega: coordina que alguien reciba el pedido en la dirección y horario acordados. Si no hay quien reciba y debemos regresar, se cobra una nueva entrega.\n\nRevisión: revisa tu pedido al recibirlo y avísanos de inmediato por WhatsApp con una foto si hay algún problema.\n\nCuidado: después de la entrega, las flores son tu responsabilidad. Te daremos tips de cuidado para que duren más.\n\nDudas por WhatsApp: [TELÉFONO].",
    placeholdersNeeded: "48 horas, 20%, TELÉFONO",
    version: "v1.0",
    lastUpdated: new Date("2026-10-24"),
  },
  {
    templateNumber: "LT-003",
    name: "Condiciones del Servicio (Eventos)",
    appliesTo: "event_quotes",
    trigger: "Attached to event quotes (weddings, corporate, etc.). Customer signs to accept.",
    templateText: "Condiciones del Servicio\n\nEstas condiciones forman parte de tu cotización y aplican cuando la aceptas.\n\n1. Reservar tu fecha y pagar\nTu fecha queda apartada hasta que recibimos el anticipo. El esquema depende de cuánto falta para tu evento al momento de aceptar:\n- Si tu evento es en menos de 6 meses: 50% al aceptar y 50% a más tardar 15 días antes del evento.\n- Si tu evento es en más de 6 meses: 30% al aceptar, 50% a más tardar [90] días antes y 20% a más tardar 15 días antes.\nPagos por transferencia: [BANCO] · CLABE [CLABE] · [TITULAR]. Envíanos tu comprobante por WhatsApp. El saldo debe estar liquidado antes de la entrega.\n\n2. Eventos con poco tiempo\nNecesitamos más de 2 semanas para preparar tu pedido. Si tu evento es en menos de 14 días, aplica un cargo por urgencia del 20% sobre el total. En ese caso pagas 50% al aceptar y el resto [3] días antes, y sujeto a disponibilidad de flores.\n\n3. Cancelaciones\nEl anticipo no se reembolsa. Con él apartamos tu fecha y compramos flores e insumos. Si cancelas con 15 días o más de anticipación, no debes nada más, y los pagos hechos no se devuelven. Si cancelas con menos de 15 días, se cubre el total de la cotización. Avísanos por escrito (correo o WhatsApp).\n\n4. Cambios y conteo final\nPuedes pedir cambios al diseño sin costo hasta [30] días antes del evento. Después dependen de disponibilidad y pueden ajustar el precio. Confirma tu conteo final (invitados, mesas, ramos y flores personales) a más tardar 15 días antes.\n\n5. Flores naturales\nLas flores cambian según temporada y proveedor. Si alguna no está disponible o no llega en buen estado, la sustituimos por otra de igual o mayor valor, respetando tu paleta y estilo.\n\n6. Entrega y montaje\nNecesitamos acceso libre al lugar en el horario de montaje acordado (llaves, permisos y estacionamiento). Avísanos de cualquier restricción del lugar, como no flama, no pétalos o no clavos, y de cuotas que cobre a proveedores externos.\n\n7. Equipo en renta\nBases, arcos, floreros y demás equipo siguen siendo nuestros. Si se pierde o se daña, se cobra su costo de reposición. Podemos pedir un depósito, que se devuelve en [7] días al recuperar el equipo en buen estado.\n\n8. Factura\nSi necesitas factura, envíanos tus datos fiscales antes del primer pago.\n\n9. Imprevistos\nSi algo fuera de nuestro control impide el evento (desastre natural, emergencia, orden de autoridad), buscamos juntos otra fecha y aplicamos tus pagos, descontando las flores ya compradas.\n\n10. Vigencia y aceptación\nEsta cotización es válida por [15] días. Al aceptarla, o al hacer tu anticipo, confirmas que leíste y aceptas estas condiciones.\n\nNombre del cliente: ____________________\nFecha: ____________\nFirma: ____________________\n\nPara cualquier duda, escríbenos por WhatsApp al [TELÉFONO].",
    placeholdersNeeded: "90, BANCO, CLABE, TITULAR, 3, 30, 7, 15, TELÉFONO",
    version: "v1.0",
    lastUpdated: new Date("2026-10-24"),
  },
  {
    templateNumber: "LT-004",
    name: "Aviso de Privacidad Integral (LFPDPPP)",
    appliesTo: "all_customers",
    trigger: "Full privacy notice per Mexican law. Linked from short version. Hosted on website + stored here as source of truth.",
    templateText: "AVISO DE PRIVACIDAD INTEGRAL\n\n1. Responsable del tratamiento de sus datos\n[Nombre completo o razón social], con domicilio en [calle, número, colonia, C.P., municipio, estado], es responsable del tratamiento de sus datos personales conforme a la Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP).\n\n2. Datos personales que recabamos\nPodemos recabar los siguientes datos, directamente de usted por WhatsApp, correo, teléfono, redes sociales, formularios o en persona: nombre, teléfono, WhatsApp, correo electrónico, datos del evento, datos de facturación (RFC, razón social), datos de pago, datos de terceros (personas que recibirán arreglos).\n\n3. Finalidades del tratamiento\nFinalidades necesarias: cotizar, elaborar, entregar e instalar los arreglos florales, cobrar, emitir comprobantes, cumplir obligaciones legales.\nFinalidades adicionales: enviar promociones, usar fotografías de los arreglos en portafolio, redes sociales.\n\n4. Transferencias de datos\nCompartimos sus datos únicamente cuando es necesario para prestar el servicio: proveedores de entrega, salones, autoridades fiscales. No vendemos sus datos.\n\n5. Derechos de las personas titulares\nPuede solicitar acceso, rectificación, supresión, oposición, limitación, portabilidad. Para ejercer estos derechos, envíe su solicitud a [correo del responsable de datos].\n\n6. Revocación del consentimiento\nPuede revocar en cualquier momento el consentimiento que nos dio.\n\n7. Conservación de los datos\nConservaremos sus datos el tiempo necesario para cumplir las finalidades y obligaciones legales.\n\n8. Medidas de seguridad\nContamos con medidas administrativas, técnicas y físicas para proteger sus datos.\n\n9. Cambios al aviso de privacidad\nEste aviso puede modificarse. Publicaremos la versión vigente en [URL del sitio].\n\nÚltima actualización: [día] de [mes] de [año].",
    placeholdersNeeded: "Nombre completo o razón social, calle número colonia C.P. municipio estado, correo del responsable de datos, URL del sitio, día, mes, año",
    version: "v1.0",
    lastUpdated: new Date("2026-10-24"),
  },
]

const TEMPLATE_VARIABLES = [
  { placeholder: "[Nombre o razón social]", dataSource: "Business config", sheet: "Assumptions", cellOrField: "B5 (Business name)", notes: "Flor by Maria — from Assumptions sheet" },
  { placeholder: "[domicilio]", dataSource: "Business config", sheet: "Assumptions", cellOrField: "B6 (Address)", notes: "Business address from Assumptions sheet" },
  { placeholder: "[correo]", dataSource: "Business config", sheet: "Assumptions", cellOrField: "B8 (Email)", notes: "Business email from Assumptions sheet" },
  { placeholder: "[TELÉFONO]", dataSource: "Business config", sheet: "Assumptions", cellOrField: "B7 (Phone/WhatsApp)", notes: "Business WhatsApp/phone from Assumptions sheet" },
  { placeholder: "[URL]", dataSource: "Business config", sheet: "Workbook Settings", cellOrField: "key=website_url", notes: "Website URL for privacy notice hosting" },
  { placeholder: "[QR]", dataSource: "Generated", sheet: "N/A", cellOrField: "Auto-generated", notes: "QR code linking to URL — generated by UI at render time" },
  { placeholder: "[BANCO]", dataSource: "Business config", sheet: "Assumptions", cellOrField: "(new field needed)", notes: "Bank name for SPEI transfers" },
  { placeholder: "[CLABE]", dataSource: "Business config", sheet: "Assumptions", cellOrField: "(new field needed)", notes: "CLABE interbancaria (18 digits)" },
  { placeholder: "[TITULAR]", dataSource: "Business config", sheet: "Assumptions", cellOrField: "(new field needed)", notes: "Account holder name" },
  { placeholder: "[48 horas]", dataSource: "Configurable", sheet: "Assumptions", cellOrField: "(new field: min_lead_hours)", notes: "Minimum lead time for small orders — default 48 hours" },
  { placeholder: "[20%]", dataSource: "Configurable", sheet: "Assumptions", cellOrField: "(new field: rush_fee_pct)", notes: "Rush fee percentage — default 20%" },
  { placeholder: "[15]", dataSource: "Configurable", sheet: "Assumptions", cellOrField: "(new field: quote_validity_days)", notes: "Quote validity in days — default 15" },
]

async function main() {
  console.log("Seeding Batch 5 demo data (legal templates + variables)...")

  console.log("\n[1] Legal Templates...")
  for (const t of LEGAL_TEMPLATES) {
    const result = await prisma.legalTemplate.upsert({
      where: { templateNumber: t.templateNumber },
      update: t,
      create: t,
    })
    console.log(`  ✓ ${result.templateNumber}: ${result.name} (${result.placeholdersNeeded?.split(",").length ?? 0} placeholders)`)
  }

  console.log("\n[2] Template Variables...")
  for (const v of TEMPLATE_VARIABLES) {
    const result = await prisma.templateVariable.upsert({
      where: { placeholder: v.placeholder },
      update: v,
      create: v,
    })
    console.log(`  ✓ ${result.placeholder} → ${result.sheet}!${result.cellOrField}`)
  }

  console.log("\n✅ Batch 5 demo data seeded.")
  console.log("\nSummary:")
  console.log(`  LegalTemplates:    ${await prisma.legalTemplate.count()}`)
  console.log(`  TemplateVariables: ${await prisma.templateVariable.count()}`)
}

main()
  .catch((e) => {
    console.error("Seed failed:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
