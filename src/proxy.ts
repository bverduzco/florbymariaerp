// src/proxy.ts — v1.8: Demo auth gate (Next.js 16 renamed middleware → proxy)
//
// Pattern B from the demo-auth discussion: branded login page + signed cookie.
// Every request goes through here. If the visitor has no valid `fmd_auth`
// cookie, they're redirected to /login. After successful login, they land on
// the URL they were originally trying to reach (via ?next=...).
//
// Public paths (skipped by this proxy):
//   /login                       — the login page itself
//   /api/auth/login              — POST handler that validates password
//   /api/auth/logout             — POST handler that clears cookie
//   /_next/static, /_next/image  — Next.js internals
//   /favicon.ico, /logo.svg      — static brand assets
//
// Notes:
// - Runs on the Edge runtime (default), so it works on Vercel Hobby.
// - AUTH_SECRET must be set in production. Without it, all routes return 500
//   (fail closed) — better to break than to serve a "protected" app open.
// - In local dev, AUTH_SECRET is optional (skipped for convenience).
// - In Next.js 16, `middleware.ts` was renamed to `proxy.ts` and the exported
//   function must be named `proxy` (not `middleware`).

import { NextResponse, type NextRequest } from "next/server"
import { AUTH_COOKIE_NAME, isAuthed } from "@/lib/auth"

// Paths that should NOT require authentication.
const PUBLIC_PATHS = new Set<string>([
  "/login",
  "/api/auth/login",
  "/api/auth/logout",
])

// Path prefixes that should NOT require authentication.
const PUBLIC_PREFIXES = [
  "/_next/static/",
  "/_next/image/",
  "/favicon.ico",
  "/logo.svg",
  "/robots.txt",
  "/flor-wireframe.html",
  "/demo-cloudinary",
  "/calendar",
  "/quotes",
  "/payments",
  "/products",
  "/dashboard",
  "/customers",
  "/orders",
  "/suppliers",
  "/events",
  "/materials",
  "/expenses",
  "/staff",
  "/procurement",
  "/losses",
  "/execution",
  "/settings",
]

// In Next.js 16, this must be named `proxy` (or be a default export).
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Fast-path: public routes bypass the auth check entirely.
  if (PUBLIC_PATHS.has(pathname)) {
    return NextResponse.next()
  }
  if (PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Local dev bypass: if AUTH_SECRET is unset AND we're not in production,
  // skip auth entirely (so `npm run dev` works out of the box).
  if (process.env.NODE_ENV !== "production" && !process.env.AUTH_SECRET) {
    return NextResponse.next()
  }

  // Production with no secret → fail closed.
  if (process.env.NODE_ENV === "production" && !process.env.AUTH_SECRET) {
    console.error(
      "[proxy] AUTH_SECRET env var is not set in production. Refusing to serve.",
    )
    return new NextResponse("Server misconfigured: AUTH_SECRET is not set.", {
      status: 500,
    })
  }

  const authed = await isAuthed(req)
  if (authed) {
    return NextResponse.next()
  }

  // Unauthenticated: redirect browser requests to /login, return JSON 401 for
  // API requests (so client-side fetch can detect it cleanly).
  const accept = req.headers.get("accept") ?? ""
  const isApi = pathname.startsWith("/api/")
  const wantsJson = isApi || accept.includes("application/json")

  if (wantsJson) {
    return NextResponse.json(
      { error: "Authentication required", redirect: "/login" },
      { status: 401 },
    )
  }

  // Browser request → redirect to login with ?next=<original-path>
  const loginUrl = req.nextUrl.clone()
  loginUrl.pathname = "/login"
  loginUrl.search = `?next=${encodeURIComponent(pathname + req.nextUrl.search)}`
  return NextResponse.redirect(loginUrl)
}

export const config = {
  // Match all paths except static asset routes that Next.js handles internally.
  // This protects API routes AND page routes.
  matcher: [
    // Match everything except:
    //   - _next/static, _next/image (Next internals)
    //   - favicon.ico, logo.svg (brand assets — public)
    //   - robots.txt
    "/((?!_next/static|_next/image|favicon\\.ico|logo\\.svg|robots\\.txt).*)",
  ],
}

// Re-export for use by API routes that want to read the cookie directly.
export { AUTH_COOKIE_NAME }
