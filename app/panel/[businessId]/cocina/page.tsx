'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { formatPrice } from '@/lib/catalog'
import type { Order } from '@/lib/types'

const POLL_MS = 8000
const AUTO_KEY = 'zv-cocina-auto'

const time = (iso: string) => new Date(iso).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Santiago' })
const shortId = (id: string) => id.slice(0, 4).toUpperCase()

function Ticket({ order, businessName }: { order: Order; businessName: string }) {
  return (
    <div className="zv-ticket">
      <p className="zv-ticket-c zv-ticket-b">{businessName}</p>
      <p className="zv-ticket-c">PEDIDO #{shortId(order.id)}</p>
      <p className="zv-ticket-c">{time(order.paidAt ?? order.createdAt)}</p>
      <hr />
      <p className="zv-ticket-b">{order.contactName}</p>
      <hr />
      {order.items.map((i) => (
        <p key={i.productId} className="zv-ticket-row">
          <span className="zv-ticket-b">
            {i.quantity} x {i.name}
          </span>
        </p>
      ))}
      {order.note && (
        <>
          <hr />
          <p>NOTA: {order.note}</p>
        </>
      )}
      <hr />
      <p className="zv-ticket-row">
        <span>TOTAL</span>
        <span>{formatPrice(order.total)}</span>
      </p>
      <p className="zv-ticket-c zv-ticket-b">
        {order.paymentStatus === 'pagado' ? `PAGADO${order.paymentMethod === 'mercadopago' ? ' · MERCADO PAGO' : ' · TRANSFERENCIA'}` : 'PAGA AL RETIRAR'}
      </p>
    </div>
  )
}

/**
 * Pantalla de cocina: se deja abierta en el computador o tablet con impresora.
 * Cada pedido listo para preparar (pagado, o sin cobro previo) aparece solo y,
 * con la impresión automática activa, sale su ticket una vez.
 */
export default function CocinaPage() {
  const { businessId } = useParams<{ businessId: string }>()
  const [orders, setOrders] = useState<Order[]>([])
  const [businessName, setBusinessName] = useState('')
  const [auto, setAuto] = useState(false)
  const [printing, setPrinting] = useState<Order | null>(null)
  const [error, setError] = useState<string | null>(null)
  const busy = useRef(false)

  useEffect(() => {
    try {
      setAuto(localStorage.getItem(AUTO_KEY) === '1')
    } catch {}
    fetch(`/api/businesses/${businessId}`)
      .then((r) => r.json())
      .then((d) => setBusinessName(d.business?.config?.businessName ?? ''))
      .catch(() => {})
  }, [businessId])

  const print = useCallback(
    async (order: Order) => {
      busy.current = true
      setPrinting(order)
      // Deja que React pinte el ticket antes de abrir el diálogo de impresión.
      await new Promise((r) => setTimeout(r, 150))
      window.print()
      await fetch(`/api/businesses/${businessId}/cocina`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id }),
      }).catch(() => {})
      setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, kitchenPrintedAt: new Date().toISOString() } : o)))
      busy.current = false
    },
    [businessId],
  )

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/businesses/${businessId}/cocina`, { cache: 'no-store' })
      if (!res.ok) throw new Error()
      const data: { orders: Order[] } = await res.json()
      setOrders(data.orders)
      setError(null)
      return data.orders
    } catch {
      setError('Sin conexión: reintentando…')
      return null
    }
  }, [businessId])

  useEffect(() => {
    let alive = true
    const tick = async () => {
      const list = await load()
      if (!alive || !list || !auto || busy.current) return
      const next = list.find((o) => !o.kitchenPrintedAt)
      if (next) await print(next)
    }
    tick()
    const t = setInterval(tick, POLL_MS)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [load, auto, print])

  function toggleAuto(v: boolean) {
    setAuto(v)
    try {
      localStorage.setItem(AUTO_KEY, v ? '1' : '0')
    } catch {}
  }

  const toPrint = orders.filter((o) => !o.kitchenPrintedAt)
  const printed = orders.filter((o) => o.kitchenPrintedAt)

  return (
    <>
      <style>{`
        .zv-ticket { font-family: ui-monospace, 'Courier New', monospace; font-size: 13px; line-height: 1.35; color: #000; background: #fff; width: 72mm; padding: 4mm; }
        .zv-ticket hr { border: 0; border-top: 1px dashed #000; margin: 6px 0; }
        .zv-ticket-c { text-align: center; }
        .zv-ticket-b { font-weight: 700; font-size: 15px; }
        .zv-ticket-row { display: flex; justify-content: space-between; gap: 8px; }
        .zv-print-area { display: none; }
        @media print {
          @page { size: 80mm auto; margin: 0; }
          body * { visibility: hidden !important; }
          .zv-print-area, .zv-print-area * { visibility: visible !important; }
          .zv-print-area { display: block; position: absolute; left: 0; top: 0; }
        }
      `}</style>

      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-8 sm:py-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">🧾 Cocina</h1>
            <p className="mt-1 text-sm text-gray-400">
              Aquí aparecen solos los pedidos listos para preparar. Déjala abierta en el equipo conectado a la impresora.
            </p>
          </div>
          <label className="flex items-center gap-3 rounded-lg border border-gray-800 px-4 py-3 text-sm text-gray-200">
            <input type="checkbox" checked={auto} onChange={(e) => toggleAuto(e.target.checked)} className="h-5 w-5 accent-amber-500" />
            Imprimir automáticamente
          </label>
        </div>
        {auto && (
          <p className="mt-3 text-xs text-gray-500">
            Consejo: en Chrome, abre el panel con <code>--kiosk-printing</code> para que imprima sin preguntar. Si no, confirma cada ticket en el diálogo.
          </p>
        )}
        {error && <p className="mt-3 text-sm text-amber-400">{error}</p>}

        <h2 className="mt-8 text-sm font-semibold uppercase tracking-wider text-amber-400">
          Por preparar ({toPrint.length})
        </h2>
        {toPrint.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">Nada pendiente. Los pedidos nuevos aparecen aquí solos.</p>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {toPrint.map((o) => (
              <div key={o.id} className="rounded-xl border border-amber-500/50 bg-amber-500/[0.06] p-4">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">
                    #{shortId(o.id)} · {o.contactName}
                  </span>
                  <span className="text-xs text-gray-400">{time(o.paidAt ?? o.createdAt)}</span>
                </div>
                <ul className="mt-2 text-sm text-gray-200">
                  {o.items.map((i) => (
                    <li key={i.productId}>
                      {i.quantity} × {i.name}
                    </li>
                  ))}
                </ul>
                {o.note && <p className="mt-1 text-xs text-gray-400">Nota: {o.note}</p>}
                <button
                  onClick={() => print(o)}
                  className="mt-3 rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-gray-950 hover:bg-amber-400"
                >
                  Imprimir ticket
                </button>
              </div>
            ))}
          </div>
        )}

        {printed.length > 0 && (
          <>
            <h2 className="mt-10 text-sm font-semibold uppercase tracking-wider text-gray-500">Ya impresos hoy</h2>
            <div className="mt-3 flex flex-col divide-y divide-gray-800 rounded-lg border border-gray-800">
              {printed.map((o) => (
                <div key={o.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <span className="text-gray-300">
                    #{shortId(o.id)} · {o.contactName} · {o.items.reduce((n, i) => n + i.quantity, 0)} productos
                  </span>
                  <button onClick={() => print(o)} className="text-xs text-gray-400 hover:text-amber-300">
                    Reimprimir
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="zv-print-area" aria-hidden="true">
        {printing && <Ticket order={printing} businessName={businessName} />}
      </div>
    </>
  )
}
