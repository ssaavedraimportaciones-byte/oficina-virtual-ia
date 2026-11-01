'use client'

import { useState } from 'react'
import type { UserProfile } from '@/lib/auth'
import { BUSINESS_LIMIT, PAID_PLANS, PLAN_LABEL, PLAN_MONTHLY_CLP, SETUP_FEE_CLP, type PaidPlan } from '@/lib/plans'
import SessionsSection from './SessionsSection'
import TwoFactorSection from './TwoFactorSection'

const clp = (n: number) => `$${n.toLocaleString('es-CL')}`

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

  async function handleCheckout(plan: PaidPlan) {
    setBillingBusy(true)
    setBillingError(null)
    const res = await fetch('/api/billing/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan }),
    })
    const data = await res.json().catch(() => ({}))
    setBillingBusy(false)
    if (!res.ok) {
      setBillingError(data.error ?? 'No se pudo abrir la facturación')
      return
    }
    window.location.href = data.url
  }

  async function handlePortal() {
    setBillingBusy(true)
    setBillingError(null)
    const res = await fetch('/api/billing/portal', { method: 'POST' })
    const data = await res.json().catch(() => ({}))
    setBillingBusy(false)
    if (!res.ok) {
      setBillingError(data.error ?? 'No se pudo abrir la facturación')
      return
    }
    window.location.href = data.url
  }

  const isPaid = profile.plan !== 'FREE'

  return (
    <div className="mt-8 flex flex-col gap-8">
      <div className="rounded-lg border border-gray-800 p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium text-white">Plan</h2>
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] uppercase ${
              isPaid ? 'border-amber-700 text-amber-400' : 'border-gray-700 text-gray-500'
            }`}
          >
            {PLAN_LABEL[profile.plan]}
            {!isPaid && ` (${BUSINESS_LIMIT.FREE} negocio)`}
          </span>
        </div>

        {isPaid ? (
          <>
            <button
              onClick={handlePortal}
              disabled={billingBusy}
              className="mt-3 text-xs text-amber-400 hover:underline disabled:opacity-50"
            >
              {billingBusy ? 'Abriendo…' : 'Gestionar o cambiar de plan'}
            </button>
            {profile.unbilledBusinesses > 0 && (
              <p className="mt-2 text-xs text-gray-500">
                Tienes {profile.unbilledBusinesses}{' '}
                {profile.unbilledBusinesses === 1 ? 'negocio nuevo' : 'negocios nuevos'} sin el cobro de
                implementación ({clp(SETUP_FEE_CLP)} cada uno). Escríbenos a{' '}
                <a href="mailto:contacto@zerovistochile.com" className="text-amber-400 hover:underline">
                  contacto@zerovistochile.com
                </a>{' '}
                para que te lo cobremos.
              </p>
            )}
          </>
        ) : (
          <>
            <p className="mt-1 text-xs text-gray-500">
              Más de un negocio, cupo mayor de respuestas del agente y soporte prioritario. La
              implementación ({clp(SETUP_FEE_CLP)}) se cobra una vez por cada negocio: dejamos su
              WhatsApp conectado y su información cargada.
              {profile.unbilledBusinesses > 0 &&
                ` Al elegir un plan se te cobra la de ${profile.unbilledBusinesses === 1 ? 'tu negocio actual' : `tus ${profile.unbilledBusinesses} negocios`}.`}
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {PAID_PLANS.map((plan) => {
                const limit = BUSINESS_LIMIT[plan]
                return (
                  <div key={plan} className="rounded-lg border border-gray-800 p-4">
                    <p className="text-sm font-medium text-white">{PLAN_LABEL[plan]}</p>
                    <p className="mt-1 text-lg font-semibold text-amber-400">
                      {clp(PLAN_MONTHLY_CLP[plan])}
                      <span className="text-xs font-normal text-gray-500">/mes</span>
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      {limit === null ? 'Negocios sin límite' : limit === 1 ? '1 negocio' : `Hasta ${limit} negocios`}
                    </p>
                    <button
                      onClick={() => handleCheckout(plan)}
                      disabled={billingBusy}
                      className="mt-3 w-full rounded-md bg-amber-500 px-3 py-1.5 text-xs font-medium text-gray-950 hover:bg-amber-400 disabled:opacity-50"
                    >
                      {billingBusy ? 'Abriendo…' : 'Elegir'}
                    </button>
                  </div>
                )
              })}
            </div>
          </>
        )}
        {billingError && <p className="mt-3 text-xs text-danger">{billingError}</p>}
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
