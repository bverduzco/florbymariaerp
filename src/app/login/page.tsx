// src/app/login/page.tsx — v1.8: Branded login page for demo auth
//
// URL: /login?next=<path>
//
// Single-password form. On submit, POSTs to /api/auth/login. If successful,
// sets the `fmd_auth` cookie and redirects to `next` (defaults to "/").
//
// Visual style: matches the Flor by Maria brand — rose accent, ✿ logo,
// gradient hero strip, stone body text on cream background.
//
// This page is rendered server-side (no "use client" at top), but it has a
// client-side child component for form state. This split keeps the page
// itself lightweight and SEO-friendly while the form is interactive.

import { Suspense } from "react"
import { LoginForm } from "./login-form"

export const dynamic = "force-dynamic"

interface PageProps {
  searchParams: Promise<{ next?: string }>
}

export default async function LoginPage({ searchParams }: PageProps) {
  const { next } = await searchParams
  const safeNext =
    typeof next === "string" &&
    next.startsWith("/") &&
    !next.startsWith("//") &&
    !next.startsWith("/login") &&
    !next.startsWith("/api/")
      ? next
      : "/"

  return (
    <div className="min-h-screen flex flex-col bg-stone-50">
      {/* Top decorative band (matches the main app's rose accent) */}
      <div className="h-1.5 bg-rose-600 w-full" />

      <main className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          {/* Logo block */}
          <div className="text-center mb-8">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-600 text-white shadow-sm">
              <span className="text-2xl" aria-hidden="true">✿</span>
            </div>
            <h1 className="mt-4 text-2xl font-semibold text-stone-800">
              Flor by Maria
            </h1>
            <p className="mt-1 text-sm text-stone-500">
              ERP · Demo access
            </p>
          </div>

          {/* Card */}
          <div className="bg-white border border-rose-100 rounded-xl shadow-sm p-6 sm:p-8">
            <Suspense fallback={<div className="text-sm text-stone-500">Cargando…</div>}>
              <LoginForm next={safeNext} />
            </Suspense>
          </div>

          {/* Footer */}
          <p className="mt-6 text-center text-xs text-stone-400">
            Acceso restringido · Solo para demostración
            <br />
            Si tienes la contraseña, ingrésala arriba.
          </p>
        </div>
      </main>
    </div>
  )
}
