// src/components/floristry/logout-button.tsx — v1.8: Demo auth logout button
//
// Small icon button that lives in the app header next to BackupButton.
// POSTs to /api/auth/logout, then hard-navigates to /login so the cleared
// cookie is picked up by the middleware on the next page load.

"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { LogOut, Loader2 } from "lucide-react"
import { toast } from "sonner"

export function LogoutButton() {
  const [busy, setBusy] = useState(false)

  async function logout() {
    if (busy) return
    setBusy(true)
    try {
      const res = await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      })
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(err.error ?? `HTTP ${res.status}`)
      }
      // Hard navigation — middleware will see no cookie and redirect to /login.
      window.location.href = "/login"
    } catch (e) {
      toast.error("No se pudo cerrar la sesión", {
        description: e instanceof Error ? e.message : String(e),
      })
      setBusy(false)
    }
  }

  return (
    <Button
      onClick={logout}
      disabled={busy}
      variant="outline"
      size="sm"
      className="gap-1.5"
      title="Cerrar sesión"
    >
      {busy ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <LogOut className="h-3.5 w-3.5" />
      )}
      <span className="hidden sm:inline">Salir</span>
    </Button>
  )
}
