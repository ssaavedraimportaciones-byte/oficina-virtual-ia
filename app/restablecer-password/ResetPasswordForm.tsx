'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ResetPasswordForm({ token }: { token: string | null }) {
  const router = useRouter()
  const [newPassword, setNewPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  if (!token) {
    return (
      <div className="flex w-full max-w-sm flex-col gap-4 text-center">
        <span className="font-mono text-lg font-semibold text-amber-400">AgentsApp</span>
        <p className="text-sm text-danger">Este link no es válido. Pedí uno nuevo.</p>
        <a href="/olvide-password" className="text-sm text-amber-400 hover:underline">
          Pedir un link nuevo
        </a>
      </div>
    )
  }

  if (done) {
    return (
      <div className="flex w-full max-w-sm flex-col gap-4 text-center">
        <span className="font-mono text-lg font-semibold text-amber-400">AgentsApp</span>
        <p className="text-sm text-gray-300">Contraseña actualizada. Ya podés ingresar.</p>
        <a href="/login" className="text-sm text-amber-400 hover:underline">
          Ir a ingresar
        </a>
      </div>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)

    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, newPassword }),
    })

    setBusy(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'No se pudo restablecer la contraseña')
      return
    }
    setDone(true)
    setTimeout(() => router.push('/login'), 2000)
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-4">
      <div>
        <span className="font-mono text-lg font-semibold text-amber-400">AgentsApp</span>
        <h1 className="mt-1 text-xl font-bold text-white">Elegí una contraseña nueva</h1>
      </div>
      <input
        required
        autoFocus
        type="password"
        minLength={8}
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        placeholder="Contraseña nueva (mínimo 8 caracteres)"
        className="input"
      />
      {error && <p className="text-sm text-danger">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="rounded-md bg-amber-500 px-6 py-3 font-medium text-gray-950 hover:bg-amber-400 disabled:opacity-50"
      >
        {busy ? 'Guardando…' : 'Guardar contraseña'}
      </button>
    </form>
  )
}
