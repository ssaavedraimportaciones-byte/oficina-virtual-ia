'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PLAN_LABEL, PLAN_ORDER } from '@/lib/plans'
import type { Plan } from '@/lib/generated/prisma/enums'

/** Da o quita un plan a mano (cortesía). Los que pagan por Stripe no se tocan desde acá. */
export default function PlanButton({ userId, email, plan }: { userId: string; email: string; plan: Plan }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function change(next: Plan) {
    if (next === plan) return
    const question =
      next === 'FREE'
        ? `¿Pasar a ${email} al plan gratis? Se le baja el límite de respuestas y de negocios.`
        : `¿Dar el plan ${PLAN_LABEL[next]} de cortesía a ${email}? No se le va a cobrar.`
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
    <select
      value={plan}
      disabled={busy}
      onChange={(e) => change(e.target.value as Plan)}
      className="rounded-md border border-gray-700 bg-gray-900 px-2 py-1 text-xs text-gray-200 disabled:opacity-50"
    >
      {PLAN_ORDER.map((p) => (
        <option key={p} value={p}>
          {PLAN_LABEL[p]}
        </option>
      ))}
    </select>
  )
}
