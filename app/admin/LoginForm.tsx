'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginForm({
  scope = 'admin',
  title = 'Panel de administración',
}: {
  scope?: 'admin' | 'panel'
  title?: string
}) {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)

    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, scope }),
    })

    setBusy(false)
    if (!res.ok) {
      setError('Contraseña incorrecta')
      return
    }
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-4">
      <h1 className="text-xl font-bold text-white">{title}</h1>
      <input
        required
        autoFocus
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Contraseña"
        className="input"
      />
      {error && <p className="text-sm text-danger">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="rounded-md bg-amber-500 px-6 py-3 font-medium text-gray-950 hover:bg-amber-400 disabled:opacity-50"
      >
        {busy ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  )
}
