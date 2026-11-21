'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import type { StockAlerts } from '@/lib/stockAlerts'

const EVERY_MS = 60_000

/**
 * Aviso de inventario arriba de todas las pantallas del panel. Se refresca solo
 * (cada minuto y al volver a la pestaña): si algo se acaba mientras el dueño
 * tiene el panel abierto, lo ve sin recargar. Desaparece al reponer.
 */
export default function StockAlertBanner({ businessId, initial }: { businessId: string; initial: StockAlerts }) {
  const [alerts, setAlerts] = useState(initial)
  const [open, setOpen] = useState(false)

  const refresh = useCallback(async () => {
    if (document.hidden) return
    const res = await fetch(`/api/businesses/${businessId}/alertas`, { cache: 'no-store' }).catch(() => null)
    if (res?.ok) setAlerts(await res.json())
  }, [businessId])

  useEffect(() => {
    const id = window.setInterval(refresh, EVERY_MS)
    const onVisible = () => {
      if (!document.hidden) refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [refresh])

  const out = alerts.ingredients.filter((i) => i.out)
  const low = alerts.ingredients.filter((i) => !i.out)
  if (alerts.ingredients.length === 0 && alerts.soldOut.length === 0) return null

  const urgent = out.length > 0 || alerts.soldOut.length > 0
  const headline = [
    out.length > 0 && `Se acabó ${out.map((i) => i.name).join(', ')}`,
    alerts.soldOut.length > 0 && `${alerts.soldOut.length === 1 ? '1 producto' : `${alerts.soldOut.length} productos`} sin stock`,
    low.length > 0 && `${low.length === 1 ? '1 ingrediente' : `${low.length} ingredientes`} por reponer`,
  ]
    .filter(Boolean)
    .join(' · ')
  const href = alerts.inventory ? `/panel/${businessId}/inventario` : `/panel/${businessId}/pedidos`

  return (
    <div
      role="alert"
      className={`border-b px-4 py-3 text-sm sm:px-8 ${urgent ? 'border-danger/40 bg-danger/10 text-red-100' : 'border-amber-500/40 bg-amber-500/10 text-amber-100'}`}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span aria-hidden="true">{urgent ? '🚨' : '⚠️'}</span>
        <p className="min-w-0 flex-1 font-medium">{headline}</p>
        <button type="button" onClick={() => setOpen(!open)} className="text-xs underline-offset-2 hover:underline">
          {open ? 'Ocultar detalle' : 'Ver detalle'}
        </button>
        <Link href={href} className="rounded-md bg-white/10 px-3 py-1.5 text-xs font-medium hover:bg-white/20">
          Reponer →
        </Link>
      </div>
      {open && (
        <ul className="mt-2 space-y-1 pl-7 text-xs opacity-90">
          {alerts.ingredients.map((i) => (
            <li key={i.name}>
              {i.name}: {i.text}
            </li>
          ))}
          {alerts.soldOut.length > 0 && <li>El agente dejó de ofrecer: {alerts.soldOut.join(', ')}. Vuelven solos al reponer.</li>}
        </ul>
      )}
    </div>
  )
}
