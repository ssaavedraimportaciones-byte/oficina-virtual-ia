'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export interface BusinessRow {
  businessId: string
  name: string
  ownerEmails: string[]
  plan: 'FREE' | 'PRO'
  used: number
  planLimit: number | null
  replyLimitOverride: number | null
  adminNotes: string
}

function Row({ row }: { row: BusinessRow }) {
  const router = useRouter()
  const [limit, setLimit] = useState(row.replyLimitOverride === null ? '' : String(row.replyLimitOverride))
  const [notes, setNotes] = useState(row.adminNotes)
  const [busy, setBusy] = useState(false)
  const [state, setState] = useState<'idle' | 'saved' | 'error'>('idle')

  const dirty = limit !== (row.replyLimitOverride === null ? '' : String(row.replyLimitOverride)) || notes !== row.adminNotes

  async function save() {
    setBusy(true)
    setState('idle')
    const res = await fetch(`/api/admin/businesses/${row.businessId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminNotes: notes, replyLimitOverride: limit.trim() === '' ? null : Number(limit) }),
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
        <div className="text-gray-600">plan {row.plan === 'PRO' ? 'PRO' : 'gratis'}</div>
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
