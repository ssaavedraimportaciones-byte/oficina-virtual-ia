'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { SalesSettings } from '@/lib/types'

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${checked ? 'bg-amber-500' : 'bg-gray-700'}`}
    >
      <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${checked ? 'left-6' : 'left-1'}`} />
    </button>
  )
}

function Block({
  icon,
  title,
  desc,
  checked,
  onToggle,
  children,
}: {
  icon: string
  title: string
  desc: string
  checked: boolean
  onToggle: (v: boolean) => void
  children?: React.ReactNode
}) {
  return (
    <div className={`rounded-lg border p-4 ${checked ? 'border-amber-500/40 bg-amber-500/[0.04]' : 'border-gray-800'}`}>
      <div className="flex items-start gap-3">
        <span className="text-xl" aria-hidden="true">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-white">{title}</p>
          <p className="mt-0.5 text-sm text-gray-400">{desc}</p>
        </div>
        <Toggle checked={checked} onChange={onToggle} label={title} />
      </div>
      {checked && children && <div className="mt-4 flex flex-col gap-3 pl-0 sm:pl-9">{children}</div>}
    </div>
  )
}

const PREORDER_OPTIONS = [0, 15, 30, 45, 60, 90, 120, 180, 240]
const CUTOFF_OPTIONS = [0, 10, 15, 20, 30, 45, 60, 90]

function minutesLabel(m: number): string {
  if (m < 60) return `${m} minutos`
  const h = m / 60
  return Number.isInteger(h) ? `${h} ${h === 1 ? 'hora' : 'horas'}` : `${Math.floor(h)} h ${m % 60} min`
}

/** Cobro antes de preparar, horario de pedidos, ticket de cocina y avisos de inventario: todo activable por separado. */
export default function SalesSettingsPanel({
  businessId,
  initial,
  onSaved,
  food = false,
}: {
  businessId: string
  initial: SalesSettings
  onSaved: (s: SalesSettings) => void
  /** Local de comida: ve el horario para recibir pedidos. */
  food?: boolean
}) {
  const [s, setS] = useState(initial)
  const [mpToken, setMpToken] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  async function save(patch: Record<string, unknown>) {
    setSaving(true)
    setMsg(null)
    const res = await fetch(`/api/businesses/${businessId}/ventas`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    const data = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) {
      setMsg({ ok: false, text: data.error ?? 'No se pudo guardar.' })
      return false
    }
    setS(data.settings)
    onSaved(data.settings)
    setMsg({ ok: true, text: 'Guardado.' })
    return true
  }

  return (
    <section className="mt-6 rounded-lg border border-gray-800 p-6">
      <h2 className="font-medium text-white">{food ? 'Cobros, horario de pedidos, cocina e inventario' : 'Cobros, cocina e inventario'}</h2>
      <p className="mt-1 text-sm text-gray-400">Activa solo lo que te sirva. Puedes apagarlo cuando quieras.</p>

      <div className="mt-4 flex flex-col gap-3">
        <Block
          icon="💳"
          title="Cobrar antes de preparar"
          desc="El agente da las formas de pago al tomar el pedido. Recién pagado entra a cocina; si no pagan a tiempo, se anula solo y el stock vuelve."
          checked={s.paymentsEnabled}
          onToggle={(v) => save({ paymentsEnabled: v, transferInfo: s.transferInfo })}
        >
          <label className="flex flex-col gap-1 text-sm text-gray-300">
            Datos para transferir
            <textarea
              value={s.transferInfo}
              onChange={(e) => setS({ ...s, transferInfo: e.target.value })}
              rows={4}
              placeholder={'Banco Estado · Cuenta RUT 12.345.678-9\nNombre: Completos Don Tito SpA\nMail: pagos@donito.cl'}
              className="input"
            />
            <span className="text-xs text-gray-500">
              El agente los copia tal cual. Cuando el cliente avise que transfirió, te llega un correo y confirmas con «Pago recibido».
            </span>
          </label>
          <label className="flex flex-wrap items-center gap-2 text-sm text-gray-300">
            Plazo para pagar
            <input
              type="number"
              min={5}
              max={240}
              value={s.holdMinutes}
              onChange={(e) => setS({ ...s, holdMinutes: Number(e.target.value) })}
              className="input" style={{ width: '5.5rem' }}
            />
            minutos
          </label>
          <div className="rounded-md border border-gray-800 p-3">
            <p className="text-sm font-medium text-gray-200">
              Mercado Pago {s.mercadoPagoConnected && <span className="ml-1 text-xs text-emerald-400">✓ conectado</span>}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Opcional: el agente manda un link para pagar con tarjeta y el pago se confirma solo, sin que revises nada. Usa el
              access token de producción de tu cuenta (Mercado Pago → Tus integraciones → Credenciales). Mercado Pago cobra su comisión.
            </p>
            {s.mercadoPagoConnected ? (
              <button type="button" onClick={() => save({ mercadoPagoToken: null })} className="mt-2 text-xs text-gray-400 hover:text-danger">
                Desconectar Mercado Pago
              </button>
            ) : (
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <input
                  type="password"
                  autoComplete="off"
                  value={mpToken}
                  onChange={(e) => setMpToken(e.target.value)}
                  placeholder="APP_USR-…"
                  className="input flex-1"
                />
                <button
                  type="button"
                  disabled={saving || mpToken.trim().length < 10}
                  onClick={async () => {
                    if (await save({ mercadoPagoToken: mpToken.trim() })) setMpToken('')
                  }}
                  className="rounded-md border border-gray-700 px-4 py-2 text-sm text-gray-200 hover:border-amber-500 disabled:opacity-50"
                >
                  Conectar
                </button>
              </div>
            )}
          </div>
          <div className="rounded-md border border-gray-800 p-3">
            <p className="text-sm font-medium text-gray-200">🧾 Comprobantes</p>
            <p className="mt-1 text-xs text-gray-500">
              Cuando el cliente manda la foto del comprobante, el agente la lee y revisa que calcen el monto, la cuenta o RUT de
              destino, la fecha y el estado, y que el código de operación no se haya usado en otro pedido. Te llega el resultado y
              la imagen queda en el pedido.
            </p>
            <label className="mt-3 flex items-start gap-3 text-sm text-gray-300">
              <input
                type="checkbox"
                checked={s.autoConfirmReceipts}
                onChange={(e) => {
                  const v = e.target.checked
                  if (
                    v &&
                    !window.confirm(
                      'Con esto el pedido pasa a cocina solo si el comprobante calza en todo, sin que revises tu cuenta. Una imagen bien editada podría pasar. ¿Activar igual?',
                    )
                  )
                    return
                  save({ autoConfirmReceipts: v })
                }}
                className="mt-0.5 h-5 w-5 shrink-0 accent-amber-500"
              />
              <span>
                Confirmar el pago automáticamente cuando el comprobante calza en todo
                <span className="block text-xs text-amber-400/80">
                  Más rápido, pero con riesgo: una imagen editada podría pasar. Recomendado solo si confías en tus clientes.
                </span>
              </span>
            </label>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={() => save({ transferInfo: s.transferInfo, holdMinutes: s.holdMinutes })}
            className="w-fit rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-gray-950 hover:bg-amber-400 disabled:opacity-50"
          >
            Guardar datos de pago
          </button>
        </Block>

        {(food || s.ordersOnlyInHours) && (
        <Block
          icon="🕕"
          title="Recibir pedidos solo en horario"
          desc="Para locales de comida. Apagado, el agente toma pedidos a cualquier hora. Encendido, solo en tu horario, y puedes recibirlos antes de abrir (ej.: un sushi que abre a las 13:00 recibe desde las 12:00 y prepara al abrir) o dejar de tomarlos antes de cerrar."
          checked={s.ordersOnlyInHours}
          onToggle={(v) => save({ ordersOnlyInHours: v })}
        >
          <label className="flex flex-wrap items-center gap-2 text-sm text-gray-300">
            Empezar a recibir pedidos
            <select
              value={s.preorderMinutes}
              onChange={(e) => save({ preorderMinutes: Number(e.target.value) })}
              className="input"
              style={{ width: 'auto' }}
            >
              {PREORDER_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {m === 0 ? 'al abrir' : `${minutesLabel(m)} antes de abrir`}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-wrap items-center gap-2 text-sm text-gray-300">
            Dejar de recibir pedidos
            <select
              value={s.orderCutoffMinutes}
              onChange={(e) => save({ orderCutoffMinutes: Number(e.target.value) })}
              className="input"
              style={{ width: 'auto' }}
            >
              {CUTOFF_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {m === 0 ? 'al cerrar' : `${minutesLabel(m)} antes de cerrar`}
                </option>
              ))}
            </select>
          </label>
          <span className="text-xs text-gray-500">
            Los pedidos que llegan antes de abrir quedan anotados como «pedido anticipado» y el agente le dice al cliente a qué
            hora se empiezan a preparar. Fuera de horario igual responde dudas y muestra la carta, y le dice desde qué hora puede
            pedir. Usa el horario que tienes en{' '}
            <Link href={`/panel/${businessId}/agenda`} className="text-amber-300 hover:text-amber-200">
              Agenda y horas
            </Link>
            .
          </span>
        </Block>
        )}

        <Block
          icon="🧾"
          title="Ticket para la cocina"
          desc="Una pantalla de cocina que muestra e imprime el ticket de cada pedido apenas está pagado (o al tomarlo, si no cobras antes)."
          checked={s.kitchenEnabled}
          onToggle={(v) => save({ kitchenEnabled: v })}
        >
          <Link href={`/panel/${businessId}/cocina`} className="w-fit text-sm font-medium text-amber-300 hover:text-amber-200">
            Abrir la pantalla de cocina →
          </Link>
          <span className="text-xs text-gray-500">
            Ábrela en el computador o tablet conectado a la impresora (térmica de 80 mm o normal) y deja activada la impresión automática.
          </span>
        </Block>

        <Block
          icon="📦"
          title="Avisos de inventario"
          desc="Te avisamos por correo cuando un producto baja del mínimo o se agota. El agente ya no ofrece lo agotado."
          checked={s.stockAlertsEnabled}
          onToggle={(v) => save({ stockAlertsEnabled: v })}
        >
          <label className="flex flex-wrap items-center gap-2 text-sm text-gray-300">
            Avisarme cuando queden
            <input
              type="number"
              min={0}
              value={s.stockAlertThreshold}
              onChange={(e) => setS({ ...s, stockAlertThreshold: Number(e.target.value) })}
              onBlur={() => save({ stockAlertThreshold: s.stockAlertThreshold })}
              className="input" style={{ width: '5.5rem' }}
            />
            unidades o menos
          </label>
          <span className="text-xs text-gray-500">Funciona con los productos que tienen stock cargado.</span>
        </Block>
      </div>

      {msg && <p className={`mt-3 text-sm ${msg.ok ? 'text-success' : 'text-danger'}`}>{msg.text}</p>}
    </section>
  )
}
