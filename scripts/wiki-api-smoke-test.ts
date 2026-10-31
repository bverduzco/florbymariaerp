/**
 * End-to-end smoke test for the Wiki API.
 *
 * Tests:
 *   A) GET /api/wiki — returns the seeded article
 *   B) POST /api/wiki — create a new article; verify response + uniqueness
 *   C) GET /api/wiki/[id] by ID and by slug
 *   D) PATCH /api/wiki/[id] — update title/body/pinned
 *   E) Slug uniqueness enforcement on create (returns 200 with -2 suffix, not 409)
 *   F) DELETE /api/wiki/[id] — removes the article
 *
 * Cleans up after itself.
 */
import { db } from "../src/lib/db"

const TEST_SLUG_BASE = "smoke-test-wiki"
let createdIds: string[] = []

async function cleanup() {
  if (createdIds.length === 0) return
  console.log(`\nCleanup: deleting ${createdIds.length} test article(s)...`)
  await db.wikiArticle.deleteMany({ where: { id: { in: createdIds } } })
  console.log("  ✓ Cleaned up")
}

let pass = 0
let fail = 0
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a === e) {
    console.log(`  ✓ ${name}`)
    pass++
  } else {
    console.error(`  ✗ ${name}`)
    console.error(`    expected: ${e}`)
    console.error(`    actual:   ${a}`)
    fail++
  }
}

async function main() {
  // ── Test A: list articles (should include seeded) ───────
  console.log("Test A: GET /api/wiki returns seeded article")
  const resA = await fetch("http://localhost:3000/api/wiki")
  const dataA = await resA.json()
  check("status 200", resA.status, 200)
  check("count >= 1", dataA.count >= 1, true)
  const seeded = dataA.articles.find(
    (a: { slug: string }) => a.slug === "vida-en-florero-guia-de-referencia"
  )
  check("seeded article present", !!seeded, true)
  if (seeded) {
    check("seeded pinned", (seeded as { pinned: boolean }).pinned, true)
    check(
      "seeded category",
      (seeded as { category: string }).category,
      "flower-care"
    )
    console.log(
      `  → Found: ${(seeded as { title: string }).title}`
    )
  }

  // ── Test B: create a new article ────────────────────────
  console.log("\nTest B: POST /api/wiki creates a new article")
  const resB = await fetch("http://localhost:3000/api/wiki", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "Smoke Test Wiki Article",
      body: "# Test\n\nThis is a smoke test article.\n\n| A | B |\n|---|---|\n| 1 | 2 |",
      category: "other",
      tags: "smoke, test",
      pinned: false,
    }),
  })
  const dataB = await resB.json()
  check("status 201", resB.status, 201)
  check("title", dataB.article?.title, "Smoke Test Wiki Article")
  check("category", dataB.article?.category, "other")
  check("tags", dataB.article?.tags, "smoke, test")
  check("slug auto-generated", !!dataB.article?.slug, true)
  if (dataB.article) createdIds.push(dataB.article.id)
  console.log(`  → Created: ${dataB.article?.slug}`)

  // ── Test C: fetch by ID and by slug ─────────────────────
  console.log("\nTest C: GET /api/wiki/[id] by ID and by slug")
  const articleId = dataB.article.id
  const articleSlug = dataB.article.slug

  const resC1 = await fetch(`http://localhost:3000/api/wiki/${articleId}`)
  const dataC1 = await resC1.json()
  check("by-id status 200", resC1.status, 200)
  check("by-id body present", !!dataC1.article?.body, true)
  check(
    "by-id body matches",
    dataC1.article?.body?.includes("# Test"),
    true
  )

  const resC2 = await fetch(`http://localhost:3000/api/wiki/${articleSlug}`)
  const dataC2 = await resC2.json()
  check("by-slug status 200", resC2.status, 200)
  check("by-slug same id", dataC2.article?.id, articleId)

  // ── Test D: PATCH — update title + body + pinned ─────────
  console.log("\nTest D: PATCH /api/wiki/[id] updates fields")
  const resD = await fetch(`http://localhost:3000/api/wiki/${articleId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "Smoke Test Wiki Article (UPDATED)",
      body: "# Updated\n\nNew content.",
      pinned: true,
    }),
  })
  const dataD = await resD.json()
  check("status 200", resD.status, 200)
  check("title updated", dataD.article?.title, "Smoke Test Wiki Article (UPDATED)")
  check("body updated", dataD.article?.body, "# Updated\n\nNew content.")
  check("pinned updated", dataD.article?.pinned, true)

  // ── Test E: slug uniqueness on create ───────────────────
  console.log("\nTest E: Create article with duplicate slug → -2 suffix")
  // To trigger the slug-uniqueness check, we need to create an article whose
  // auto-generated slug matches an existing one. The original article (Test B)
  // has slug 'smoke-test-wiki-article' (title was changed in Test D, but the
  // slug wasn't). Create a new article with the SAME title as Test B's
  // ORIGINAL title → same slug → should get a -2 suffix.
  const resE = await fetch("http://localhost:3000/api/wiki", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "Smoke Test Wiki Article", // same as Test B's original title
      body: "Duplicate test",
      category: "other",
    }),
  })
  const dataE = await resE.json()
  check("status 201", resE.status, 201)
  check(
    "slug has -2 suffix",
    dataE.article?.slug?.endsWith("-2"),
    true
  )
  if (dataE.article) createdIds.push(dataE.article.id)
  console.log(`  → Created with slug: ${dataE.article?.slug}`)

  // ── Test F: DELETE ───────────────────────────────────────
  console.log("\nTest F: DELETE /api/wiki/[id] removes the article")
  const resF = await fetch(`http://localhost:3000/api/wiki/${articleId}`, {
    method: "DELETE",
  })
  const dataF = await resF.json()
  check("status 200", resF.status, 200)
  check("deleted id matches", dataF.deleted, articleId)

  // Verify it's gone
  const resF2 = await fetch(`http://localhost:3000/api/wiki/${articleId}`)
  check("after-delete 404", resF2.status, 404)
  // Remove from cleanup list since it's already deleted
  createdIds = createdIds.filter((id) => id !== articleId)

  // ── Test G: GET non-existent article → 404 ──────────────
  console.log("\nTest G: GET /api/wiki/[non-existent] → 404")
  const resG = await fetch("http://localhost:3000/api/wiki/non-existent-slug-xyz")
  check("status 404", resG.status, 404)

  console.log(`\n${pass} passed, ${fail} failed`)
  if (fail > 0) process.exit(1)
}

main()
  .then(() => cleanup().then(() => process.exit(0)))
  .catch((e) => {
    console.error(e)
    cleanup().then(() => process.exit(1))
  })
