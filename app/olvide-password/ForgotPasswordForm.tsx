'use client'

import { useState } from 'react'

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)

    const res = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })

    setBusy(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'No se pudo procesar el pedido')
      return
    }
    setSent(true)
  }

  if (sent) {
    return (
      <div className="flex w-full max-w-sm flex-col gap-4 text-center">
        <span className="font-mono text-lg font-semibold text-amber-400">AgentsApp</span>
        <p className="text-sm text-gray-300">
          Si <strong className="text-white">{email}</strong> tiene una cuenta, te llegó un mail con
          instrucciones para restablecer la contraseña.
        </p>
        <a href="/login" className="text-sm text-amber-400 hover:underline">
          Volver a ingresar
        </a>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-4">
      <div>
        <span className="font-mono text-lg font-semibold text-amber-400">AgentsApp</span>
        <h1 className="mt-1 text-xl font-bold text-white">Recuperar contraseña</h1>
        <p className="mt-1 text-sm text-gray-500">
          Te mandamos un link para elegir una contraseña nueva.
        </p>
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
      {error && <p className="text-sm text-danger">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="rounded-md bg-amber-500 px-6 py-3 font-medium text-gray-950 hover:bg-amber-400 disabled:opacity-50"
      >
        {busy ? 'Enviando…' : 'Enviar instrucciones'}
      </button>
      <a href="/login" className="text-center text-sm text-gray-500 hover:text-amber-400">
        Volver a ingresar
      </a>
    </form>
  )
}
