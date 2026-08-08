'use client'

import { useState } from 'react'

/**
 * Requiere un click explícito en vez de confirmar solo con visitar la
 * página: los prefetchers de link (o un antivirus/proxy que sigue links
 * automáticamente) no deben poder "gastar" el token de un solo uso sin que
 * la persona haga nada.
 */
export default function VerifyEmailPanel({ token }: { token: string | null }) {
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<'ok' | 'error' | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!token) {
    return (
      <div className="flex w-full max-w-sm flex-col gap-4 text-center">
        <span className="font-mono text-lg font-semibold text-amber-400">AgentsApp</span>
        <p className="text-sm text-danger">Este link no es válido.</p>
      </div>
    )
  }

  if (result === 'ok') {
    return (
      <div className="flex w-full max-w-sm flex-col gap-4 text-center">
        <span className="font-mono text-lg font-semibold text-amber-400">AgentsApp</span>
        <p className="text-sm text-gray-300">Email verificado correctamente.</p>
        <a href="/panel" className="text-sm text-amber-400 hover:underline">
          Ir al panel
        </a>
      </div>
    )
  }

  async function handleConfirm() {
    setBusy(true)
    setError(null)

    const res = await fetch('/api/auth/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })

    setBusy(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'No se pudo verificar el email')
      setResult('error')
      return
    }
    setResult('ok')
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-4 text-center">
      <span className="font-mono text-lg font-semibold text-amber-400">AgentsApp</span>
      <h1 className="text-xl font-bold text-white">Verificar email</h1>
      {error && <p className="text-sm text-danger">{error}</p>}
      <button
        onClick={handleConfirm}
        disabled={busy}
        className="rounded-md bg-amber-500 px-6 py-3 font-medium text-gray-950 hover:bg-amber-400 disabled:opacity-50"
      >
        {busy ? 'Verificando…' : 'Confirmar mi email'}
      </button>
    </div>
  )
}
