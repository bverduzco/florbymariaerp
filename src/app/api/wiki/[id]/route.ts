import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/wiki/[id]
 * Returns the full article (including body) by ID.
 * Also supports lookup-by-slug: if the id param looks like a cuid
 * (starts with "c" and is 20+ chars), look up by id; otherwise by slug.
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params

  // Heuristic: Prisma cuid IDs start with "c" and are 20+ chars.
  // Slugs are typically shorter and/or don't start with "c" alone.
  const looksLikeCuid = id.startsWith("c") && id.length >= 20 && /^[a-z0-9]+$/i.test(id)

  const article = looksLikeCuid
    ? await db.wikiArticle.findUnique({ where: { id } })
    : await db.wikiArticle.findUnique({ where: { slug: id } })

  if (!article) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 })
  }
  return NextResponse.json({ article })
}

/**
 * PATCH /api/wiki/[id]
 * Body: { title?, body?, category?, tags?, pinned? }
 * Updates any of the article fields. Slug is NOT auto-updated when title
 * changes (would break existing links); Maria can edit the slug separately
 * if she really wants to.
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  const { id } = await params
  const body = await request.json().catch(() => null)

  if (!body || !Object.keys(body).some((k) => ["title", "body", "category", "tags", "pinned", "slug"].includes(k))) {
    return NextResponse.json(
      { error: "Nothing to update — provide title, body, category, tags, pinned, or slug" },
      { status: 400 }
    )
  }

  // Find the article (by id or slug)
  const looksLikeCuid = id.startsWith("c") && id.length >= 20 && /^[a-z0-9]+$/i.test(id)
  const existing = looksLikeCuid
    ? await db.wikiArticle.findUnique({ where: { id } })
    : await db.wikiArticle.findUnique({ where: { slug: id } })

  if (!existing) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 })
  }

  // If changing slug, ensure uniqueness
  if (body.slug && body.slug !== existing.slug) {
    const slugConflict = await db.wikiArticle.findUnique({ where: { slug: body.slug } })
    if (slugConflict) {
      return NextResponse.json(
        { error: `Slug '${body.slug}' is already in use by another article` },
        { status: 409 }
      )
    }
  }

  const data: Record<string, unknown> = {}
  if (body.title !== undefined) data.title = body.title.trim()
  if (body.body !== undefined) data.body = body.body
  if (body.category !== undefined) data.category = body.category
  if (body.tags !== undefined) data.tags = body.tags ?? null
  if (body.pinned !== undefined) data.pinned = body.pinned
  if (body.slug !== undefined) data.slug = body.slug

  try {
    const article = await db.wikiArticle.update({
      where: { id: existing.id },
      data,
    })
    return NextResponse.json({ article })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

/**
 * DELETE /api/wiki/[id]
 * Permanently deletes an article. No soft-delete — wiki articles are
 * meant to be edited, not deleted. Use with caution.
 */
export async function DELETE(_request: Request, { params }: RouteParams) {
  const { id } = await params
  const looksLikeCuid = id.startsWith("c") && id.length >= 20 && /^[a-z0-9]+$/i.test(id)
  const existing = looksLikeCuid
    ? await db.wikiArticle.findUnique({ where: { id } })
    : await db.wikiArticle.findUnique({ where: { slug: id } })

  if (!existing) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 })
  }

  try {
    await db.wikiArticle.delete({ where: { id: existing.id } })
    return NextResponse.json({ deleted: existing.id, slug: existing.slug })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
