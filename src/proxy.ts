// src/proxy.ts — v1.8: Demo auth gate (Next.js 16 renamed middleware → proxy)
//
// Pattern B: branded login page + signed cookie.
// Every request goes through here. If the visitor has no valid `fmd_auth`
// cookie, they're redirected to /login.
//
// In local dev (NODE_ENV !== "production" && no AUTH_SECRET), auth is skipped
// entirely so `npm run dev` works out of the box.
// In production, AUTH_SECRET must be set — without it, all routes return 500.

import { NextResponse, type NextRequest } from "next/server"
import { AUTH_COOKIE_NAME, isAuthed } from "@/lib/auth"

// Paths that NEVER require authentication — even in production.
const PUBLIC_PATHS = new Set<string>([
  "/login",
  "/api/auth/login",
  "/api/auth/logout",
])

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Fast-path: public routes bypass the auth check entirely.
  if (PUBLIC_PATHS.has(pathname)) {
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

  // Check if the visitor is authenticated.
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
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|logo\\.svg|robots\\.txt).*)",
  ],
}

export { AUTH_COOKIE_NAME }
