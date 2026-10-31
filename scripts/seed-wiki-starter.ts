/**
 * Seed the Vida en florero starter article into the Wiki.
 *
 * Run with: npx tsx scripts/seed-wiki-starter.ts
 *
 * Idempotent: if an article with slug 'vida-en-florero-guia-de-referencia'
 * already exists, the script updates it instead of creating a duplicate.
 */

import { db } from "../src/lib/db"

const ARTICLE = {
  slug: "vida-en-florero-guia-de-referencia",
  title: "Vida en florero — guía de referencia",
  category: "flower-care",
  tags: "vase-life, hardy, etileno, reference",
  pinned: true,
  createdBy: "Maria (seeded from @FeiKax reference)",
  body: `# Vida en florero: guía de referencia

Oct 30, 2026 · @FeiKax

## Cómo usar esta página

Los días de vida en florero son **referencias de mejor caso**, no garantías: en la práctica suelen ser unos días menos que en las pruebas de laboratorio.

- Los datos vienen de un post de Facebook (Aprende Floreria) contrastado con guías de floristerías y estudios de universidades. Los rangos varían según variedad, temporada, proveedor y manejo.
- La columna "Rango práctico" es una **sugerencia conservadora**, no un dato publicado. Ajústala con lo que observes en tu taller (ver registro al final).
- Vida en florero cuenta desde que la flor llega con el cliente. No es lo mismo que la vida en tu cámara fría ni debe usarse para cálculos de inventario o precios.

## Tabla de referencia

Las ocho flores del post están bien situadas, pero el orden 1 a 8 no es un ranking real: el lisianthus, por ejemplo, suele rendir tanto o más que varias de las primeras.

| Flor | Post (Aprende Floreria) | Otras fuentes (mejor caso) | Rango práctico sugerido | Notas |
| --- | --- | --- | --- | --- |
| Crisantemo | 2 a 3 semanas | 21 a 28 días; un estudio japonés midió unos 20 días | 14 a 21 días | La más duradera en casi todas las fuentes; algunas guías dan solo 7 a 14 días según variedad |
| Clavel | 2 a 3 semanas | 14 a 21 días | 12 a 18 días | Sensible al etileno (fruta) |
| Astromelia | 2 semanas o más | 12 a 16 días | 10 a 14 días | Sensible al etileno; los botones siguen abriendo |
| Cymbidium | 2 a 3 semanas | Orquídeas en general: 2 a 3 semanas | 14 a 18 días | Dato general de orquídeas, no específico de cymbidium en todas las fuentes |
| Lisianthus | 10 a 14 días | 10 a 14 días; hasta 16 en pruebas de variedades específicas | 8 a 12 días | Se beneficia de alimento floral; una prueba de NC State midió mínimos de 5 a 7 días |
| Alcatraz | 1 a 2 semanas | Hasta 2 semanas (una guía dice 3); un estudio japonés midió menos de 10 días | 7 a 10 días | Agua fresca a diario; no abre más después del corte |
| Lirio | 1 a 2 semanas | 8 a 14 días; otra guía dice 4 a 8 | 7 a 10 días | Cortar con botones; abren de forma escalonada |
| Limonium | 2 semanas y luego se seca | 14 días o más | 10 a 14 días | Se seca bien y se puede dejar como flor seca |

## Cuidados que alargan la vida

Cinco hábitos sencillos alargan la vida de cualquier flor.

- Corta el tallo en diagonal justo antes de ponerlo en agua.
- Usa agua limpia y cámbiala cada 2 o 3 días (a diario para alcatraz); lava bien el florero.
- Agrega alimento floral, sobre todo en lisianthus.
- Aleja las flores de la fruta (etileno), del calor y del sol directo. Astromelia y clavel son especialmente sensibles.
- Quita flores y hojas que empiecen a morir.

## Registro de lo observado

Anota aquí cuánto duran realmente las flores de tus proveedores; con el tiempo estos datos valdrán más que cualquier fuente externa.

| Flor | Proveedor | Fecha de compra | Días que lució bien | Notas |
| --- | --- | --- | --- | --- |
|  |  |  |  |  |
|  |  |  |  |  |
|  |  |  |  |  |

## Fuentes

Consultadas el 30 de octubre de 2026 mediante búsqueda web (resultados revisados, páginas no leídas completas). Más el post original de Aprende Floreria en Facebook.

- [Floraly: longest-lasting flowers](https://www.floraly.com.au/blogs/news/longest-lasting-flowers)
- [SendFlowers: vase life by flower](https://sendflowers.io/blog/long-lasting-flowers)
- [NARO Japón: vida en florero por estación](https://repository.naro.go.jp/records/1475)
- [ASCFG / NC State: reporte postcosecha 2008](https://www.ascfg.org/wp-content/uploads/2008-Postharvest-Report.pdf)
- [NC State: evaluación de vida en florero de flores nuevas](https://hortscans.ces.ncsu.edu/file/../uploads/e/v/evaluati_51cb1d716a1c2.pdf)
- [Appleyard Flowers: long-lasting flowers](https://www.appleyardflowers.com/flowerdiaries/long-lasting-flowers)
- [Flowers of Charlotte: which cut flowers last the longest](https://www.flowersofcharlotte.com/blog/which-cut-flowers-last-the-longest)
- [Floralife: vase life comparison](https://floralife.com/?p=206)
- [Epic Gardening: long-lasting cut flowers](https://www.epicgardening.com/long-lasting-cut-flowers/)
`,
}

async function main() {
  const existing = await db.wikiArticle.findUnique({
    where: { slug: ARTICLE.slug },
  })

  if (existing) {
    console.log(`Article '${ARTICLE.slug}' already exists (id: ${existing.id})`)
    console.log(`  → Updating body + metadata to match seed source.`)
    const updated = await db.wikiArticle.update({
      where: { id: existing.id },
      data: {
        title: ARTICLE.title,
        body: ARTICLE.body,
        category: ARTICLE.category,
        tags: ARTICLE.tags,
        pinned: ARTICLE.pinned,
      },
    })
    console.log(`✓ Updated: ${updated.title}`)
    console.log(`  category: ${updated.category}, pinned: ${updated.pinned}`)
  } else {
    const created = await db.wikiArticle.create({
      data: {
        slug: ARTICLE.slug,
        title: ARTICLE.title,
        body: ARTICLE.body,
        category: ARTICLE.category,
        tags: ARTICLE.tags,
        pinned: ARTICLE.pinned,
        createdBy: ARTICLE.createdBy,
      },
    })
    console.log(`✓ Created: ${created.title}`)
    console.log(`  slug: ${created.slug}`)
    console.log(`  category: ${created.category}, pinned: ${created.pinned}`)
  }

  // Verify it shows up
  const count = await db.wikiArticle.count()
  console.log(`\nWiki article count: ${count}`)
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
