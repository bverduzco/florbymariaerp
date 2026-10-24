// src/app/api/auth/login/route.ts — v1.8: Demo auth login endpoint
//
// POST /api/auth/login
//   body: { password: string, next?: string }
//
// On success: 200 + sets `fmd_auth` HttpOnly signed cookie. The body also
// includes { ok: true, next: <sanitized-path> } so the client knows where to
// redirect.
//
// On failure: 401 with { error: "Invalid password" }.
//
// Security notes:
// - Cookie is HttpOnly (not readable from JS), Secure in production, SameSite=Lax
// - Signed with HMAC-SHA256(AUTH_SECRET) — tampering invalidates the cookie
// - 30-day max age
// - Rate limiting is NOT implemented here (Vercel Edge would need a separate
//   KV store). For a demo gate with a shared password, this is acceptable —
//   the worst case is a brute force on a long shared password.

import { NextResponse, type NextRequest } from "next/server"
import {
  AUTH_COOKIE_NAME,
  authCookieMaxAge,
  issueAuthCookieValue,
  verifyPassword,
} from "@/lib/auth"

export const dynamic = "force-dynamic"
export const runtime = "nodejs" // we need crypto.subtle — works on both, but be explicit

interface LoginBody {
  password?: unknown
  next?: unknown
}

// Allowlist of safe redirect targets. Anything that isn't an internal path
// starting with "/" (and not "//" to avoid protocol-relative URLs) gets
// replaced with "/".
function sanitizeNext(next: unknown): string {
  if (typeof next !== "string" || next.length === 0) return "/"
  if (!next.startsWith("/")) return "/"
  if (next.startsWith("//")) return "/" // protocol-relative URL → reject
  if (next.startsWith("/login")) return "/" // prevent redirect loop
  if (next.startsWith("/api/")) return "/" // don't redirect to API routes
  return next
}

export async function POST(request: NextRequest) {
  let body: LoginBody
  try {
    body = (await request.json()) as LoginBody
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const password = typeof body.password === "string" ? body.password : ""
  const next = sanitizeNext(body.next)

  if (!verifyPassword(password)) {
    // Small artificial delay to make brute-forcing annoying.
    // Not real rate limiting — just a small throttle.
    await new Promise((r) => setTimeout(r, 250))
    return NextResponse.json(
      { error: "Contraseña incorrecta" },
      { status: 401 },
    )
  }

  // In production, AUTH_SECRET is required. If it's missing (misconfigured),
  // refuse to issue a token — better to fail than to issue an unsigned cookie.
  const secret = process.env.AUTH_SECRET
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "Server misconfigured: AUTH_SECRET is not set" },
        { status: 500 },
      )
    }
    // Local dev with DEMO_PASSWORD set but no AUTH_SECRET — skip the cookie,
    // just redirect. The middleware also bypasses auth in this case.
    return NextResponse.json({ ok: true, next })
  }

  const cookieValue = await issueAuthCookieValue(secret)

  const response = NextResponse.json({ ok: true, next })
  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: cookieValue,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: authCookieMaxAge(),
  })
  return response
}
