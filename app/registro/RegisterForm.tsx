'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BRAND } from '@/lib/brand'

export default function RegisterForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)

    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, acceptTerms }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)

    if (!res.ok) {
      setError(data.error ?? 'No se pudo crear la cuenta')
      return
    }
    // Cuenta nueva: no tiene negocios todavía, así que va directo a crear el primero.
    router.push('/panel/nuevo')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-4">
      <div>
        <span className="font-mono text-lg font-semibold text-amber-400">{BRAND.name}</span>
        <h1 className="mt-1 text-xl font-bold text-white">Crea tu cuenta</h1>
        <p className="mt-1 text-sm text-gray-500">{BRAND.tagline}. Pruébalo gratis con tu negocio.</p>
      </div>
      <input
        required
        type="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        className="input"
      />
      <input
        required
        type="password"
        autoComplete="new-password"
        minLength={8}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Contraseña (mínimo 8 caracteres)"
        className="input"
      />
      <label className="flex items-start gap-2 text-xs text-gray-400">
        <input
          type="checkbox"
          checked={acceptTerms}
          onChange={(e) => setAcceptTerms(e.target.checked)}
          className="mt-0.5"
        />
        <span>
          Acepto los{' '}
          <Link href="/terminos" target="_blank" className="text-amber-400 hover:underline">
            Términos de servicio
          </Link>{' '}
          y la{' '}
          <Link href="/privacidad" target="_blank" className="text-amber-400 hover:underline">
            Política de privacidad
          </Link>
          .
        </span>
      </label>
      {error && <p className="text-sm text-danger">{error}</p>}
      <button
        type="submit"
        disabled={busy || !acceptTerms}
        className="rounded-md bg-amber-500 px-6 py-3 font-medium text-gray-950 hover:bg-amber-400 disabled:opacity-50"
      >
        {busy ? 'Creando…' : 'Crear cuenta'}
      </button>
      <Link href="/login" className="text-center text-sm text-gray-500 hover:text-amber-400">
        ¿Ya tienes cuenta? Ingresa
      </Link>
    </form>
  )
}
