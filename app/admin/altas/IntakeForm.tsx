'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { IndustryTemplate } from '@/lib/industries'

/**
 * La ficha que se llena mientras se habla con el cliente. El orden de los
 * bloques sigue el orden de la conversación de venta, no el del modelo de
 * datos: primero con quién se habla, después qué vende, después los papeles
 * que hacen falta para Meta, que es la parte que la gente olvida preguntar.
 */

const EMPTY = {
  contactName: '',
  contactEmail: '',
  contactPhone: '',
  businessName: '',
  industry: '',
  legalName: '',
  rut: '',
  address: '',
  whatsappNumber: '',
  whatsappClean: false,
  hours: '',
  payments: '',
  catalog: '',
  escalation: '',
  notes: '',
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-gray-200">{label}</span>
      {hint && <span className="text-xs text-gray-500">{hint}</span>}
      {children}
    </label>
  )
}

export default function IntakeForm({ industries }: { industries: IndustryTemplate[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set<K extends keyof typeof EMPTY>(key: K, value: (typeof EMPTY)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)

    const res = await fetch('/api/admin/altas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)

    if (!res.ok) {
      setError(data.error ?? 'No se pudo guardar la ficha')
      return
    }
    setForm(EMPTY)
    setOpen(false)
    router.refresh()
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md bg-amber-500 px-5 py-2 text-sm font-medium text-gray-950 hover:bg-amber-400"
      >
        Nueva alta
      </button>
    )
  }

  return (
    <form onSubmit={submit} className="rounded-lg border border-gray-800 p-6">
      <h2 className="font-medium text-white">Ficha del cliente nuevo</h2>
      <p className="mt-1 text-sm text-gray-400">
        Lo que hay que preguntar en la reunión de venta. Lo único obligatorio es el contacto y el
        nombre del negocio: el resto se puede completar después en las notas.
      </p>

      <h3 className="mt-6 text-xs uppercase tracking-wide text-gray-500">Con quién hablamos</h3>
      <div className="mt-3 grid gap-4 sm:grid-cols-3">
        <Field label="Nombre del contacto">
          <input
            required
            value={form.contactName}
            onChange={(e) => set('contactName', e.target.value)}
            placeholder="Ej: Pancho Rodríguez"
            className="input"
          />
        </Field>
        <Field label="Mail">
          <input
            required
            type="email"
            value={form.contactEmail}
            onChange={(e) => set('contactEmail', e.target.value)}
            placeholder="pancho@correo.cl"
            className="input"
          />
        </Field>
        <Field label="Teléfono">
          <input
            value={form.contactPhone}
            onChange={(e) => set('contactPhone', e.target.value)}
            placeholder="+56 9 ..."
            className="input"
          />
        </Field>
      </div>

      <h3 className="mt-8 text-xs uppercase tracking-wide text-gray-500">El negocio</h3>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <Field label="Nombre del negocio" hint="Como lo conocen sus clientes.">
          <input
            required
            value={form.businessName}
            onChange={(e) => set('businessName', e.target.value)}
            placeholder="Ej: Pancho Rodante"
            className="input"
          />
        </Field>
        <Field label="Rubro">
          <select
            value={form.industry}
            onChange={(e) => set('industry', e.target.value)}
            className="input"
          >
            <option value="">Elegir…</option>
            {industries.map((item) => (
              <option key={item.id} value={item.id}>
                {item.emoji} {item.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <h3 className="mt-8 text-xs uppercase tracking-wide text-gray-500">
        Papeles para la verificación de Meta
      </h3>
      <p className="mt-1 text-xs text-gray-500">
        Tienen que coincidir letra por letra con el inicio de actividades del SII: si no coinciden,
        Meta rechaza la verificación.
      </p>
      <div className="mt-3 grid gap-4 sm:grid-cols-3">
        <Field label="Razón social">
          <input
            value={form.legalName}
            onChange={(e) => set('legalName', e.target.value)}
            placeholder="Ej: Comercial Pancho SpA"
            className="input"
          />
        </Field>
        <Field label="RUT de la empresa">
          <input
            value={form.rut}
            onChange={(e) => set('rut', e.target.value)}
            placeholder="76.123.456-7"
            className="input"
          />
        </Field>
        <Field label="Domicilio">
          <input
            value={form.address}
            onChange={(e) => set('address', e.target.value)}
            placeholder="Calle, número, comuna"
            className="input"
          />
        </Field>
      </div>

      <h3 className="mt-8 text-xs uppercase tracking-wide text-gray-500">El número</h3>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <Field label="Número de WhatsApp del negocio">
          <input
            value={form.whatsappNumber}
            onChange={(e) => set('whatsappNumber', e.target.value)}
            placeholder="+56 9 ..."
            className="input"
          />
        </Field>
        <label className="flex items-start gap-2 pt-7 text-sm text-gray-300">
          <input
            type="checkbox"
            checked={form.whatsappClean}
            onChange={(e) => set('whatsappClean', e.target.checked)}
            className="mt-0.5"
          />
          <span>
            Confirmó que ese número <strong>no tiene WhatsApp instalado</strong>
            <span className="block text-xs text-gray-500">
              Al conectarlo a la API deja de funcionar en la app del teléfono. Si lo usa a diario,
              hay que conseguir otro número antes de seguir.
            </span>
          </span>
        </label>
      </div>

      <h3 className="mt-8 text-xs uppercase tracking-wide text-gray-500">Cómo atiende</h3>
      <div className="mt-3 flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Horarios">
            <input
              value={form.hours}
              onChange={(e) => set('hours', e.target.value)}
              placeholder="Lun a sáb de 12:00 a 23:00"
              className="input"
            />
          </Field>
          <Field label="Formas de pago">
            <input
              value={form.payments}
              onChange={(e) => set('payments', e.target.value)}
              placeholder="Efectivo, débito, transferencia"
              className="input"
            />
          </Field>
        </div>
        <Field label="Qué vende, con precios" hint="El menú o la lista de servicios.">
          <textarea
            rows={4}
            value={form.catalog}
            onChange={(e) => set('catalog', e.target.value)}
            placeholder={'Completo italiano $3.500\nChurrasco $5.900\n…'}
            className="input"
          />
        </Field>
        <Field
          label="Qué hace el agente cuando no sabe algo"
          hint="Pasar el caso a una persona, pedir el teléfono, avisar que responden mañana…"
        >
          <textarea
            rows={2}
            value={form.escalation}
            onChange={(e) => set('escalation', e.target.value)}
            placeholder="Avisar que un encargado responde dentro del día y pedir el nombre."
            className="input"
          />
        </Field>
        <Field label="Notas">
          <textarea
            rows={2}
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            placeholder="Lo que haya quedado pendiente de la reunión."
            className="input"
          />
        </Field>
      </div>

      {error && <p className="mt-4 text-sm text-danger">{error}</p>}

      <div className="mt-6 flex items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-amber-500 px-5 py-2 text-sm font-medium text-gray-950 hover:bg-amber-400 disabled:opacity-50"
        >
          {busy ? 'Guardando…' : 'Guardar ficha'}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false)
            setError(null)
          }}
          className="text-sm text-gray-500 hover:text-gray-300"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}
