// scripts/cleanup-vercel-deployments.ts
//
// One-off script: deletes old Vercel deployments to free up Deployment
// Storage space on the Hobby plan (10 GB combined limit).
//
// Retention policy (matches Vercel's automatic Hobby retention, but
// runs immediately instead of waiting for the next 30-day cycle):
//   - Keep the latest 3 production deployments
//   - Keep the latest 3 deployments of any type
//   - Keep the currently-active production deployment (always protected)
//   - Delete everything else
//
// Usage:
//   VERCEL_TOKEN=... npx tsx scripts/cleanup-vercel-deployments.ts <projectId>
//
// Or set VERCEL_PROJECT_ID env var instead of passing as arg.
//
// By default does a dry run — prints what it WOULD delete but doesn't
// actually delete. Pass --apply to actually delete.

const VERCEL_API = "https://api.vercel.com"

async function listAllDeployments(token: string, projectId: string) {
  const all: Array<{
    uid: string
    url: string
    createdAt: number
    target: string | null
    readyState: string
    state: string
  }> = []
  let until: number | undefined
  // Page through all deployments (limit=100 per page)
  while (true) {
    const url = new URL(`${VERCEL_API}/v6/deployments`)
    url.searchParams.set("projectId", projectId)
    url.searchParams.set("limit", "100")
    if (until) url.searchParams.set("until", String(until))
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Failed to list deployments: ${res.status} ${text}`)
    }
    const data = await res.json() as {
      deployments: Array<{ uid: string; url: string; createdAt: number; target: string | null; readyState: string; state: string }>
      pagination?: { next?: number }
    }
    all.push(...data.deployments)
    if (data.pagination?.next) {
      until = data.pagination.next
    } else {
      break
    }
    // Safety: cap at 500 deployments to avoid infinite loops
    if (all.length >= 500) break
  }
  return all
}

async function deleteDeployment(token: string, deploymentId: string) {
  const res = await fetch(`${VERCEL_API}/v13/deployments/${deploymentId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Failed to delete ${deploymentId}: ${res.status} ${text}`)
  }
  return res.json()
}

async function getCurrentProductionDeployment(token: string, projectId: string) {
  // The currently live production deployment — we never delete this one
  const res = await fetch(`${VERCEL_API}/v9/projects/${projectId}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return null
  const data = await res.json() as { targets?: { production?: { id?: string } } }
  return data.targets?.production?.id ?? null
}

async function main() {
  const token = process.env.VERCEL_TOKEN
  const projectId = process.argv[2] ?? process.env.VERCEL_PROJECT_ID
  const apply = process.argv.includes("--apply")

  if (!token) {
    console.error("Error: VERCEL_TOKEN env var is required")
    process.exit(1)
  }
  if (!projectId) {
    console.error("Usage: VERCEL_TOKEN=... npx tsx scripts/cleanup-vercel-deployments.ts <projectId> [--apply]")
    process.exit(1)
  }

  console.log(`Project ID: ${projectId}`)
  console.log(`Mode: ${apply ? "APPLY (will actually delete)" : "DRY RUN (pass --apply to actually delete)"}`)
  console.log("")

  // 1. Fetch all deployments (paginated)
  console.log("Fetching all deployments...")
  const all = await listAllDeployments(token, projectId)
  console.log(`  Found ${all.length} deployments total`)

  // Only consider READY deployments for retention (other states like ERROR,
  // BLOCKED already don't take up much storage)
  const ready = all.filter((d) => d.readyState === "READY")
  console.log(`  ${ready.length} are READY (eligible for retention policy)`)
  console.log("")

  // 2. Find current live production deployment (always protected)
  const currentProdId = await getCurrentProductionDeployment(token, projectId)
  console.log(`Current live production deployment: ${currentProdId ?? "(unknown)"}`)
  console.log("")

  // 3. Sort ready deployments by createdAt desc (newest first)
  ready.sort((a, b) => b.createdAt - a.createdAt)

  // 4. Identify which to keep:
  //    - Latest 3 production deployments
  //    - Latest 3 deployments of any type
  //    - The current live production deployment (always)
  const keep = new Set<string>()

  // Latest 3 production
  const prod = ready.filter((d) => d.target === "production")
  prod.slice(0, 3).forEach((d) => keep.add(d.uid))
  console.log(`KEEP: latest 3 production deployments:`)
  prod.slice(0, 3).forEach((d, i) => {
    const date = new Date(d.createdAt).toISOString().slice(0, 16)
    console.log(`  ${i + 1}. ${d.uid}  ${date}  ${d.url}`)
  })

  // Latest 3 of any type
  ready.slice(0, 3).forEach((d) => keep.add(d.uid))
  console.log(`\nKEEP: latest 3 deployments of any type:`)
  ready.slice(0, 3).forEach((d, i) => {
    const date = new Date(d.createdAt).toISOString().slice(0, 16)
    console.log(`  ${i + 1}. ${d.uid}  ${date}  ${d.target ?? "preview"}  ${d.url}`)
  })

  // Current live production (always protected)
  if (currentProdId) keep.add(currentProdId)
  console.log(`\nKEEP: current live production deployment: ${currentProdId}`)

  // 5. Delete everything else (only READY ones; ERROR/BLOCKED are auto-purged)
  const toDelete = ready.filter((d) => !keep.has(d.uid))
  console.log(`\n${toDelete.length} deployments will be ${apply ? "DELETED" : "(would be deleted in --apply mode)"}:`)
  toDelete.forEach((d, i) => {
    const date = new Date(d.createdAt).toISOString().slice(0, 16)
    console.log(`  ${i + 1}. ${d.uid}  ${date}  ${d.target ?? "preview"}  ${d.url}`)
  })

  if (!apply) {
    console.log("\n=== DRY RUN ===")
    console.log("Run again with --apply to actually delete these deployments.")
    return
  }

  // 6. Actually delete them
  console.log(`\n=== APPLYING: deleting ${toDelete.length} deployments ===`)
  let deleted = 0
  let failed = 0
  for (const d of toDelete) {
    try {
      await deleteDeployment(token, d.uid)
      deleted++
      console.log(`  ✓ deleted ${d.uid} (${d.target ?? "preview"})`)
    } catch (e) {
      failed++
      console.error(`  ✗ FAILED ${d.uid}: ${e instanceof Error ? e.message : e}`)
    }
  }
  console.log(`\nDone. ${deleted} deleted, ${failed} failed.`)
}

main().catch((e) => {
  console.error("Fatal error:", e instanceof Error ? e.message : e)
  process.exit(1)
})
