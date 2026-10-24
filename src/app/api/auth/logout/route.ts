// src/app/api/auth/logout/route.ts — v1.8: Demo auth logout endpoint
//
// POST /api/auth/logout
//   body: (empty)
//
// Clears the `fmd_auth` cookie. Always returns 200 — even if the visitor
// had no cookie, the post-condition (no cookie) is satisfied.

import { NextResponse } from "next/server"
import { AUTH_COOKIE_NAME } from "@/lib/auth"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST() {
  const response = NextResponse.json({ ok: true })
  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0, // immediately expires the cookie
  })
  return response
}
