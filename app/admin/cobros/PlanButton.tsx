'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

/** Da o quita el plan PRO a mano (cortesía). Los que pagan por Stripe no se tocan desde acá. */
export default function PlanButton({ userId, email, plan }: { userId: string; email: string; plan: 'FREE' | 'PRO' }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const next = plan === 'PRO' ? 'FREE' : 'PRO'

  async function change() {
    const question =
      next === 'PRO'
        ? `¿Dar el plan PRO de cortesía a ${email}? No se le va a cobrar.`
        : `¿Pasar a ${email} al plan gratis? Se le baja el límite de respuestas y de negocios.`
    if (!window.confirm(question)) return
    setBusy(true)
    await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: next }),
    })
    setBusy(false)
    router.refresh()
  }

  return (
    <button onClick={change} disabled={busy} className="text-xs text-amber-400 hover:underline disabled:opacity-50">
      {busy ? 'Guardando…' : next === 'PRO' ? 'Dar PRO' : 'Pasar a gratis'}
    </button>
  )
}
