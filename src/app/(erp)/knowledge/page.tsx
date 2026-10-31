import { db as prisma } from "@/lib/db"
import { WikiEditDialog } from "./wiki-edit-dialog"
import { ArticleReader } from "./article-reader"
import Link from "next/link"

async function getArticles() {
  return prisma.wikiArticle.findMany({
    orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
    select: {
      id: true,
      slug: true,
      title: true,
      category: true,
      tags: true,
      pinned: true,
      updatedAt: true,
      // Body excluded — fetched separately when an article is selected
    },
  })
}

const CATEGORY_EMOJI: Record<string, string> = {
  general: "📁",
  "cheat-sheet": "📋",
  "flower-care": "🌸",
  substitution: "🔄",
  "supplier-tip": "🏭",
  "recipe-note": "📖",
  seasonal: "📅",
  demo: "🎁",
  other: "📦",
}

export default async function KnowledgePage({
  searchParams,
}: {
  searchParams: Promise<{ article?: string }>
}) {
  const params = await searchParams
  const articles = await getArticles()

  // Resolve the selected article (by slug or id) — defaults to the first one
  let selectedId: string | null = null
  if (params.article) {
    const found =
      params.article.startsWith("c") && params.article.length === 24
        ? articles.find((a) => a.id === params.article)
        : articles.find((a) => a.slug === params.article)
    if (found) selectedId = found.id
  }
  if (!selectedId && articles.length > 0) {
    selectedId = articles[0].id
  }

  // Fetch the full body for the selected article
  let selectedArticle: Awaited<ReturnType<typeof prisma.wikiArticle.findUnique>> = null
  if (selectedId) {
    selectedArticle = await prisma.wikiArticle.findUnique({
      where: { id: selectedId },
    })
  }

  const pinnedCount = articles.filter((a) => a.pinned).length
  const byCategory = articles.reduce((acc, a) => {
    if (!acc[a.category]) acc[a.category] = []
    acc[a.category].push(a)
    return acc
  }, {} as Record<string, typeof articles>)

  return (
    <div>
      <div className="fmd-screen-header">
        <div>
          <h1>Knowledge Base</h1>
          <div className="fmd-subtitle">
            Wiki · personal body of knowledge · {articles.length} article{articles.length !== 1 ? "s" : ""}
            {pinnedCount > 0 && ` · ${pinnedCount} pinned`}
          </div>
        </div>
        <WikiEditDialog
          mode="create"
          trigger={
            <button className="px-4 py-2 text-sm font-medium bg-stone-900 text-white rounded-md hover:bg-stone-800 transition">
              + New article
            </button>
          }
        />
      </div>

      {articles.length === 0 ? (
        <div className="fmd-box" style={{ marginBottom: 0 }}>
          <div className="fmd-box-label">No articles yet</div>
          <div style={{ textAlign: "center", padding: "32px", color: "#9CA3AF" }}>
            <div style={{ fontSize: "32px", marginBottom: "8px" }}>📚</div>
            <div style={{ fontSize: "13px" }}>
              Your wiki is empty. Click <b>+ New article</b> above to write your
              first one — flower care guides, supplier quirks, conditioning
              tricks, anything worth remembering.
            </div>
          </div>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "280px 1fr",
            gap: "16px",
            alignItems: "start",
          }}
        >
          {/* ── Left: article list ───────────────────────────── */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {/* Pinned articles */}
            {pinnedCount > 0 && (
              <div className="fmd-box" style={{ marginBottom: 0 }}>
                <div className="fmd-box-label">📌 Pinned ({pinnedCount})</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  {articles
                    .filter((a) => a.pinned)
                    .map((a) => (
                      <ArticleListItem
                        key={a.id}
                        article={a}
                        selected={a.id === selectedId}
                      />
                    ))}
                </div>
              </div>
            )}

            {/* All articles grouped by category */}
            {Object.entries(byCategory)
              .filter(([cat]) => cat !== "general" || true) // show all categories
              .map(([category, items]) => (
                <div key={category} className="fmd-box" style={{ marginBottom: 0 }}>
                  <div className="fmd-box-label">
                    {CATEGORY_EMOJI[category] ?? "📁"} {category} ({items.filter((i) => !i.pinned).length})
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                    {items
                      .filter((a) => !a.pinned)
                      .map((a) => (
                        <ArticleListItem
                          key={a.id}
                          article={a}
                          selected={a.id === selectedId}
                        />
                      ))}
                  </div>
                </div>
              ))}
          </div>

          {/* ── Right: article reader ────────────────────────── */}
          <div>
            {selectedArticle ? (
              <ArticleReader
                article={{
                  ...selectedArticle,
                  createdAt: selectedArticle.createdAt.toISOString(),
                  updatedAt: selectedArticle.updatedAt.toISOString(),
                }}
              />
            ) : (
              <div className="fmd-box" style={{ marginBottom: 0, textAlign: "center", padding: "32px" }}>
                <div style={{ fontSize: "13px", color: "#9CA3AF" }}>
                  Select an article from the left, or create a new one.
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="fmd-note blue" style={{ marginTop: "12px" }}>
        💡 Markdown is supported — headings (#), bold (**), tables, lists,
        code blocks, links. Click <b>👁️ Preview</b> in the editor to see how
        your article will render.
      </div>
    </div>
  )
}

// ───────────────────────────────────────────────────────────────────────────
// Article list item (server component, renders a Link to the article)
// ───────────────────────────────────────────────────────────────────────────
function ArticleListItem({
  article,
  selected,
}: {
  article: {
    id: string
    slug: string
    title: string
    category: string
    updatedAt: Date
  }
  selected: boolean
}) {
  return (
    <Link
      href={`/knowledge?article=${article.slug}`}
      className={`block px-2 py-1.5 text-xs rounded transition ${
        selected
          ? "bg-rose-50 text-rose-900 font-semibold border border-rose-200"
          : "text-stone-700 hover:bg-stone-100 border border-transparent"
      }`}
      style={{ lineHeight: 1.3 }}
    >
      <div>{article.title}</div>
      <div className="text-[10px] text-stone-400 mt-0.5">
        {new Date(article.updatedAt).toLocaleDateString("es-MX", {
          day: "2-digit",
          month: "short",
        })}
      </div>
    </Link>
  )
}
