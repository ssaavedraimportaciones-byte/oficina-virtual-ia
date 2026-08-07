'use client'

import { useState } from 'react'

export default function TwoFactorSection({ enabled: initialEnabled }: { enabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [enrollment, setEnrollment] = useState<{ secret: string; otpauthUrl: string } | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleStart() {
    setBusy(true)
    setError(null)
    const res = await fetch('/api/auth/totp/setup', { method: 'POST' })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) {
      setError(data.error ?? 'No se pudo empezar la activación')
      return
    }
    setEnrollment(data)
  }

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const res = await fetch('/api/auth/totp/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) {
      setError(data.error ?? 'Código incorrecto')
      return
    }
    setEnabled(true)
    setEnrollment(null)
    setCode('')
  }

  async function handleDisable(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const res = await fetch('/api/auth/totp/disable', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) {
      setError(data.error ?? 'Código incorrecto')
      return
    }
    setEnabled(false)
    setCode('')
  }

  return (
    <div className="rounded-lg border border-gray-800 p-6">
      <div className="flex items-center gap-3">
        <h2 className="text-sm font-medium text-white">Verificación en dos pasos</h2>
        <span
          className={`rounded-full border px-2 py-0.5 text-[10px] uppercase ${
            enabled ? 'border-emerald-800 text-emerald-500' : 'border-gray-700 text-gray-500'
          }`}
        >
          {enabled ? 'Activada' : 'Desactivada'}
        </span>
      </div>

      {enabled ? (
        <form onSubmit={handleDisable} className="mt-3 flex flex-col gap-3">
          <p className="text-xs text-gray-500">
            Para desactivarla, ingresá el código actual de tu app de autenticación.
          </p>
          <input
            required
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="000000"
            className="input w-32 text-center tracking-[0.4em]"
          />
          {error && <p className="text-sm text-danger">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="self-start rounded-md border border-danger px-4 py-1.5 text-sm text-danger hover:bg-danger/10 disabled:opacity-50"
          >
            {busy ? 'Verificando…' : 'Desactivar'}
          </button>
        </form>
      ) : enrollment ? (
        <form onSubmit={handleConfirm} className="mt-3 flex flex-col gap-3">
          <p className="text-xs text-gray-500">
            Agregá esta clave a tu app de autenticación (Google Authenticator, Authy, 1Password…),
            ya sea escaneando o pegando el texto a mano, y confirmá con el código que te muestre.
          </p>
          <code className="block select-all break-all rounded-md border border-gray-800 bg-gray-900 px-3 py-2 text-xs text-amber-400">
            {enrollment.secret}
          </code>
          <input
            required
            autoFocus
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="000000"
            className="input w-32 text-center tracking-[0.4em]"
          />
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={busy}
              className="self-start rounded-md bg-amber-500 px-4 py-1.5 text-sm font-medium text-gray-950 hover:bg-amber-400 disabled:opacity-50"
            >
              {busy ? 'Confirmando…' : 'Confirmar y activar'}
            </button>
            <button
              type="button"
              onClick={() => setEnrollment(null)}
              className="text-sm text-gray-500 hover:text-gray-300"
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <div className="mt-3">
          <p className="text-xs text-gray-500">
            Pide un código extra de tu celular además de la contraseña al iniciar sesión.
          </p>
          <button
            onClick={handleStart}
            disabled={busy}
            className="mt-3 text-xs text-amber-400 hover:underline disabled:opacity-50"
          >
            {busy ? 'Generando…' : 'Activar verificación en dos pasos'}
          </button>
          {error && <p className="mt-2 text-xs text-danger">{error}</p>}
        </div>
      )}
    </div>
  )
}
