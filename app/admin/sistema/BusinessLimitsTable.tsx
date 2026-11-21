'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PLAN_LABEL, SETUP_FEE_BY_TIER, SETUP_TIER_DESC, SETUP_TIER_LABEL, SETUP_TIER_ORDER } from '@/lib/plans'
import type { Plan, SetupTier } from '@/lib/generated/prisma/enums'

const clp = (n: number) => `$${n.toLocaleString('es-CL')}`

export interface BusinessRow {
  businessId: string
  name: string
  ownerEmails: string[]
  plan: Plan
  used: number
  planLimit: number | null
  replyLimitOverride: number | null
  adminNotes: string
  rut: string | null
  setupTier: SetupTier
  setupFeePaidAt: Date | null
}

function Row({ row }: { row: BusinessRow }) {
  const router = useRouter()
  const [limit, setLimit] = useState(row.replyLimitOverride === null ? '' : String(row.replyLimitOverride))
  const [notes, setNotes] = useState(row.adminNotes)
  const [rut, setRut] = useState(row.rut ?? '')
  const [tier, setTier] = useState<SetupTier>(row.setupTier)
  const [busy, setBusy] = useState(false)
  const [state, setState] = useState<'idle' | 'saved' | 'error'>('idle')

  const dirty =
    limit !== (row.replyLimitOverride === null ? '' : String(row.replyLimitOverride)) ||
    notes !== row.adminNotes ||
    rut !== (row.rut ?? '') ||
    tier !== row.setupTier

  async function save() {
    setBusy(true)
    setState('idle')
    const res = await fetch(`/api/admin/businesses/${row.businessId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        adminNotes: notes,
        replyLimitOverride: limit.trim() === '' ? null : Number(limit),
        rut: rut.trim() === '' ? null : rut,
        setupTier: tier,
      }),
    })
    setBusy(false)
    setState(res.ok ? 'saved' : 'error')
    if (res.ok) router.refresh()
  }

  return (
    <tr className="align-top">
      <td className="px-4 py-3">
        <div className="text-white">{row.name}</div>
        <div className="text-xs text-gray-500">{row.ownerEmails.join(', ') || 'sin dueño (lo administra la plataforma)'}</div>
      </td>
      <td className="px-4 py-3 text-xs text-gray-300">
        {row.used} / {row.replyLimitOverride ?? row.planLimit ?? '∞'}
        <div className="text-gray-600">plan {PLAN_LABEL[row.plan]}</div>
      </td>
      <td className="px-4 py-3">
        <input
          type="number"
          min={0}
          value={limit}
          onChange={(e) => setLimit(e.target.value)}
          placeholder={row.planLimit === null ? 'plan' : String(row.planLimit)}
          className="input w-24"
          aria-label={`Límite mensual de ${row.name}`}
        />
      </td>
      <td className="px-4 py-3">
        <input
          value={rut}
          onChange={(e) => setRut(e.target.value)}
          placeholder="76.543.210-K"
          className="input w-32"
          aria-label={`RUT de ${row.name}`}
        />
      </td>
      <td className="px-4 py-3">
        <select
          value={tier}
          onChange={(e) => setTier(e.target.value as SetupTier)}
          className="input w-32"
          aria-label={`Nivel de implementación de ${row.name}`}
          title={SETUP_TIER_DESC[tier]}
        >
          {SETUP_TIER_ORDER.map((t) => (
            <option key={t} value={t}>
              {SETUP_TIER_LABEL[t]} · {clp(SETUP_FEE_BY_TIER[t])}
            </option>
          ))}
        </select>
        <div className="mt-1 text-[0.65rem] text-gray-600">
          {row.setupFeePaidAt ? 'Ya pagada: no cambia lo cobrado' : 'Pendiente de pagar'}
        </div>
      </td>
      <td className="px-4 py-3">
        <textarea
          rows={2}
          maxLength={2000}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notas internas (el cliente no las ve)"
          className="input min-w-56"
          aria-label={`Notas internas de ${row.name}`}
        />
      </td>
      <td className="px-4 py-3 text-right">
        <button onClick={save} disabled={busy || !dirty} className="text-xs text-amber-400 hover:underline disabled:opacity-40">
          {busy ? 'Guardando…' : 'Guardar'}
        </button>
        {state === 'saved' && <div className="text-xs text-emerald-500">Guardado</div>}
        {state === 'error' && <div className="text-xs text-danger">Error</div>}
      </td>
    </tr>
  )
}

export default function BusinessLimitsTable({ rows }: { rows: BusinessRow[] }) {
  if (rows.length === 0) return <p className="text-sm text-gray-500">Todavía no hay empresas.</p>
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-800">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-gray-800 text-xs uppercase tracking-wide text-gray-500">
          <tr>
            <th className="px-4 py-3 font-medium">Empresa</th>
            <th className="px-4 py-3 font-medium">Respuestas del mes</th>
            <th className="px-4 py-3 font-medium">Límite manual</th>
            <th className="px-4 py-3 font-medium">RUT</th>
            <th className="px-4 py-3 font-medium">Implementación</th>
            <th className="px-4 py-3 font-medium">Notas internas</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800">
          {rows.map((row) => (
            <Row key={row.businessId} row={row} />
          ))}
        </tbody>
      </table>
    </div>
  )
}
