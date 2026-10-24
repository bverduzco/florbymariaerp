// src/lib/auth.ts — v1.8: Demo auth (cookie-based, signed with HMAC-SHA256)
//
// This is NOT a full auth system — it's a lightweight gate for demo/staging
// environments. The password is shared (one env var DEMO_PASSWORD), and the
// cookie is a signed token that proves "the visitor entered the correct
// password at some point in the last 30 days".
//
// Cookie format:
//   <base64url(payload)>.<base64url(hmac-sha256(payload, AUTH_SECRET))>
//
// Where payload is a JSON string: {"v":1,"iat":<epoch-seconds>}
//
// Uses Web Crypto (globalThis.crypto.subtle) so it runs on the Edge runtime
// (Vercel middleware) without Node-specific imports.

import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

export const AUTH_COOKIE_NAME = "fmd_auth"
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30 // 30 days

interface TokenPayload {
  v: 1
  iat: number // issued-at epoch seconds
}

// === Encoding helpers (base64url, no padding) ===

function bytesToBase64url(bytes: Uint8Array): string {
  // Use Node Buffer when available (server), else fall back to btoa (browser/edge)
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64url")
  }
  let bin = ""
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function base64urlToBytes(s: string): Uint8Array {
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(s, "base64url"))
  }
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"))
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function base64urlToString(s: string): string {
  const bytes = base64urlToBytes(s)
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("utf8")
  }
  let bin = ""
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return bin
}

// === Crypto ===

async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  )
}

async function sign(data: string, secret: string): Promise<string> {
  const key = await importKey(secret)
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(data),
  )
  return bytesToBase64url(new Uint8Array(sig))
}

// === Token issue / verify ===

export async function issueAuthCookieValue(secret: string): Promise<string> {
  const payload: TokenPayload = { v: 1, iat: Math.floor(Date.now() / 1000) }
  const payloadJson = JSON.stringify(payload)
  const payloadB64 = bytesToBase64url(new TextEncoder().encode(payloadJson))
  const sig = await sign(payloadB64, secret)
  return `${payloadB64}.${sig}`
}

export async function verifyAuthCookieValue(
  token: string | undefined,
  secret: string,
): Promise<boolean> {
  if (!token) return false
  const dot = token.lastIndexOf(".")
  if (dot < 1 || dot === token.length - 1) return false
  const payloadB64 = token.slice(0, dot)
  const sig = token.slice(dot + 1)

  try {
    const expectedSig = await sign(payloadB64, secret)
    if (expectedSig.length !== sig.length) return false
    // Constant-time compare
    let diff = 0
    for (let i = 0; i < expectedSig.length; i++) {
      diff |= expectedSig.charCodeAt(i) ^ sig.charCodeAt(i)
    }
    if (diff !== 0) return false

    const payloadJson = base64urlToString(payloadB64)
    const payload = JSON.parse(payloadJson) as TokenPayload
    if (payload.v !== 1 || typeof payload.iat !== "number") return false

    // Check expiry
    const now = Math.floor(Date.now() / 1000)
    if (now - payload.iat > MAX_AGE_SECONDS) return false

    return true
  } catch {
    return false
  }
}

export function authCookieMaxAge(): number {
  return MAX_AGE_SECONDS
}

// === Middleware convenience ===

/**
 * Check the request's auth cookie. Returns true if the visitor is authenticated.
 * In non-production without AUTH_SECRET, returns true (no auth enforced locally).
 */
export async function isAuthed(req: NextRequest): Promise<boolean> {
  // Local dev bypass: skip auth if AUTH_SECRET is not set AND we're not in prod.
  if (process.env.NODE_ENV !== "production" && !process.env.AUTH_SECRET) {
    return true
  }
  const secret = process.env.AUTH_SECRET
  if (!secret) {
    // Production with no secret → fail closed.
    return false
  }
  const cookie = req.cookies.get(AUTH_COOKIE_NAME)?.value
  return verifyAuthCookieValue(cookie, secret)
}

/**
 * Verify a candidate password against the configured DEMO_PASSWORD.
 * In non-production without DEMO_PASSWORD, accepts anything.
 */
export function verifyPassword(candidate: string): boolean {
  if (process.env.NODE_ENV !== "production" && !process.env.DEMO_PASSWORD) {
    return true
  }
  const expected = process.env.DEMO_PASSWORD
  if (!expected) return false
  if (typeof candidate !== "string") return false
  if (candidate.length !== expected.length) return false
  // Constant-time compare
  let diff = 0
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ candidate.charCodeAt(i)
  }
  return diff === 0
}

/**
 * Issue a 401 response that the browser interprets as "redirect to /login".
 * (Used by API routes when the caller is unauthenticated and the URL was
 * hit directly rather than through the SPA redirect flow.)
 */
export function unauthorizedJsonResponse(): NextResponse {
  return NextResponse.json(
    { error: "Authentication required" },
    { status: 401 },
  )
}
