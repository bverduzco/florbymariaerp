// src/app/login/login-form.tsx — v1.8: Client-side form for the login page
//
// Single-password input. On submit, POSTs to /api/auth/login. On success,
// redirects to `next` (defaults to "/"). On failure, shows the Spanish error
// from the API response.
//
// UX details:
// - Password can be shown/hidden via a button (for typing confidence)
// - Enter submits the form
// - Disabled state while the request is in flight
// - After successful submit, we do a hard navigation (window.location.href)
//   rather than a Next router push — this ensures the cookie set by the API
//   response is picked up by the next middleware run cleanly.

"use client"

import { useState, type FormEvent } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Eye, EyeOff, Lock } from "lucide-react"

interface LoginFormProps {
  next: string
}

export function LoginForm({ next }: LoginFormProps) {
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (submitting || password.length === 0) return

    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, next }),
      })

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        setError(data.error ?? `HTTP ${res.status}`)
        setSubmitting(false)
        return
      }

      const data = (await res.json()) as { ok: boolean; next: string }
      if (data.ok) {
        // Hard navigation — picks up the cookie set in the response.
        window.location.href = data.next || "/"
        return
      }

      setError("Respuesta inesperada del servidor")
      setSubmitting(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="password" className="text-stone-700">
          Contraseña
        </Label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            autoComplete="current-password"
            disabled={submitting}
            placeholder="••••••••"
            className="pl-9 pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-stone-400 hover:text-stone-600 transition-colors"
            aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            tabIndex={-1}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {error && (
        <p className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-md px-3 py-2">
          {error}
        </p>
      )}

      <Button
        type="submit"
        disabled={submitting || password.length === 0}
        className="w-full bg-rose-600 hover:bg-rose-700 text-white gap-2"
      >
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Entrando…
          </>
        ) : (
          "Entrar"
        )}
      </Button>

      <p className="text-xs text-stone-400 text-center pt-2">
        La sesión se mantiene por 30 días.
      </p>
    </form>
  )
}
