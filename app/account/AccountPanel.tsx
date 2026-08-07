'use client'

import { useState } from 'react'
import type { UserProfile } from '@/lib/auth'
import SessionsSection from './SessionsSection'
import TwoFactorSection from './TwoFactorSection'

export default function AccountPanel({ profile }: { profile: UserProfile }) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)
  const [resendError, setResendError] = useState<string | null>(null)

  const [billingBusy, setBillingBusy] = useState(false)
  const [billingError, setBillingError] = useState<string | null>(null)

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setSaved(false)

    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword }),
    })

    setBusy(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'No se pudo cambiar la contraseña')
      return
    }
    setCurrentPassword('')
    setNewPassword('')
    setSaved(true)
  }

  async function handleResend() {
    setResending(true)
    setResendError(null)
    const res = await fetch('/api/auth/resend-verification', { method: 'POST' })
    setResending(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setResendError(data.error ?? 'No se pudo reenviar el mail')
      return
    }
    setResent(true)
  }

  async function handleBilling(path: '/api/billing/checkout' | '/api/billing/portal') {
    setBillingBusy(true)
    setBillingError(null)
    const res = await fetch(path, { method: 'POST' })
    const data = await res.json().catch(() => ({}))
    setBillingBusy(false)
    if (!res.ok) {
      setBillingError(data.error ?? 'No se pudo abrir la facturación')
      return
    }
    window.location.href = data.url
  }

  return (
    <div className="mt-8 flex flex-col gap-8">
      <div className="rounded-lg border border-gray-800 p-6">
        <h2 className="text-sm font-medium text-white">Plan</h2>
        <div className="mt-1 flex items-center gap-3">
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] uppercase ${
              profile.plan === 'PRO'
                ? 'border-amber-700 text-amber-400'
                : 'border-gray-700 text-gray-500'
            }`}
          >
            {profile.plan === 'PRO' ? 'PRO' : 'Free (1 negocio)'}
          </span>
          {profile.plan === 'FREE' ? (
            <button
              onClick={() => handleBilling('/api/billing/checkout')}
              disabled={billingBusy}
              className="text-xs text-amber-400 hover:underline disabled:opacity-50"
            >
              {billingBusy ? 'Abriendo…' : 'Pasar a PRO'}
            </button>
          ) : (
            <button
              onClick={() => handleBilling('/api/billing/portal')}
              disabled={billingBusy}
              className="text-xs text-amber-400 hover:underline disabled:opacity-50"
            >
              {billingBusy ? 'Abriendo…' : 'Gestionar suscripción'}
            </button>
          )}
        </div>
        {billingError && <p className="mt-2 text-xs text-danger">{billingError}</p>}
      </div>

      <div className="rounded-lg border border-gray-800 p-6">
        <h2 className="text-sm font-medium text-white">Email</h2>
        <p className="mt-1 text-sm text-gray-400">{profile.email}</p>
        <div className="mt-3 flex items-center gap-3">
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] uppercase ${
              profile.emailVerifiedAt
                ? 'border-emerald-800 text-emerald-500'
                : 'border-gray-700 text-gray-500'
            }`}
          >
            {profile.emailVerifiedAt ? 'Verificado' : 'Sin verificar'}
          </span>
          {!profile.emailVerifiedAt && !resent && (
            <button
              onClick={handleResend}
              disabled={resending}
              className="text-xs text-amber-400 hover:underline disabled:opacity-50"
            >
              {resending ? 'Enviando…' : 'Reenviar verificación'}
            </button>
          )}
          {resent && <span className="text-xs text-gray-500">Mail enviado.</span>}
        </div>
        {resendError && <p className="mt-2 text-xs text-danger">{resendError}</p>}
      </div>

      <TwoFactorSection enabled={profile.totpEnabled} />

      <form
        onSubmit={handleChangePassword}
        className="flex flex-col gap-3 rounded-lg border border-gray-800 p-6"
      >
        <h2 className="text-sm font-medium text-white">Cambiar contraseña</h2>
        <input
          required
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          placeholder="Contraseña actual"
          className="input"
        />
        <input
          required
          type="password"
          minLength={8}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="Contraseña nueva (mínimo 8 caracteres)"
          className="input"
        />
        {error && <p className="text-sm text-danger">{error}</p>}
        {saved && <p className="text-sm text-emerald-500">Contraseña actualizada.</p>}
        <button
          type="submit"
          disabled={busy}
          className="self-start rounded-md bg-amber-500 px-5 py-2 text-sm font-medium text-gray-950 hover:bg-amber-400 disabled:opacity-50"
        >
          {busy ? 'Guardando…' : 'Guardar'}
        </button>
        <p className="text-xs text-gray-600">
          Cierra las demás sesiones activas; esta sesión sigue abierta.
        </p>
      </form>

      <SessionsSection />
    </div>
  )
}
