'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [totpCode, setTotpCode] = useState('')
  const [needsTotp, setNeedsTotp] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, totpCode: needsTotp ? totpCode : undefined }),
    })
    const data = await res.json().catch(() => ({}))

    setBusy(false)

    if (data.requiresTotp) {
      setNeedsTotp(true)
      setError(res.ok ? null : (data.error ?? null))
      return
    }
    if (!res.ok) {
      setError(data.error ?? 'No se pudo iniciar sesión')
      return
    }
    router.push('/panel')
    router.refresh()
  }

  if (needsTotp) {
    return (
      <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-4">
        <div>
          <span className="font-mono text-lg font-semibold text-amber-400">AgentsApp</span>
          <h1 className="mt-1 text-xl font-bold text-white">Código de verificación</h1>
          <p className="mt-1 text-sm text-gray-500">Ingresá el código de tu app de autenticación.</p>
        </div>
        <input
          required
          autoFocus
          inputMode="numeric"
          pattern="\d{6}"
          maxLength={6}
          value={totpCode}
          onChange={(e) => setTotpCode(e.target.value)}
          placeholder="000000"
          className="input text-center tracking-[0.5em]"
        />
        {error && <p className="text-sm text-danger">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-amber-500 px-6 py-3 font-medium text-gray-950 hover:bg-amber-400 disabled:opacity-50"
        >
          {busy ? 'Verificando…' : 'Confirmar'}
        </button>
      </form>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-4">
      <div>
        <span className="font-mono text-lg font-semibold text-amber-400">AgentsApp</span>
        <h1 className="mt-1 text-xl font-bold text-white">Ingresar</h1>
      </div>
      <input
        required
        autoFocus
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        className="input"
      />
      <input
        required
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
      <a href="/olvide-password" className="text-center text-sm text-gray-500 hover:text-amber-400">
        ¿Olvidaste tu contraseña?
      </a>
    </form>
  )
}
