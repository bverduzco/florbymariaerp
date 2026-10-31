import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

/**
 * GET /api/wiki
 * Returns all wiki articles, ordered pinned-first then most-recently-updated.
 * Optional query: ?category=flower-care to filter.
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const category = url.searchParams.get("category")

  const articles = await db.wikiArticle.findMany({
    where: category ? { category } : undefined,
    orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
    select: {
      id: true,
      slug: true,
      title: true,
      category: true,
      tags: true,
      pinned: true,
      updatedAt: true,
      // Don't return body in the list view — it could be large
    },
  })
  return NextResponse.json({ articles, count: articles.length })
}

/**
 * POST /api/wiki
 * Body: { title, body, category?, tags?, pinned?, slug? }
 * Creates a new wiki article. Slug is auto-generated from title if not provided.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body?.title || !body?.body) {
    return NextResponse.json(
      { error: "Missing required fields: title, body" },
      { status: 400 }
    )
  }

  // Auto-generate slug from title if not provided
  let slug = body.slug?.trim()
  if (!slug) {
    slug = slugify(body.title)
  }

  // Ensure slug is unique — append -2, -3, etc. if taken
  const existing = await db.wikiArticle.findUnique({ where: { slug } })
  if (existing) {
    let i = 2
    let candidate = `${slug}-${i}`
    while (await db.wikiArticle.findUnique({ where: { slug: candidate } })) {
      i++
      candidate = `${slug}-${i}`
    }
    slug = candidate
  }

  try {
    const article = await db.wikiArticle.create({
      data: {
        slug,
        title: body.title.trim(),
        body: body.body,
        category: body.category ?? "general",
        tags: body.tags ?? null,
        pinned: body.pinned ?? false,
        createdBy: body.createdBy ?? "Maria",
      },
    })
    return NextResponse.json({ article }, { status: 201 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

/** Simple slugify: lowercase, accents removed, non-alphanumeric → dashes */
function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .replace(/[^a-z0-9]+/g, "-") // non-alphanumeric → dash
    .replace(/^-+|-+$/g, "") // trim leading/trailing dashes
    .slice(0, 80) // cap length
}
