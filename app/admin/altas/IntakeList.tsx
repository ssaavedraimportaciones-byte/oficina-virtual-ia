'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { INTAKE_STEPS, type ClientIntake } from '@/lib/intake'
import { getIndustryTemplate } from '@/lib/industries'

/**
 * Una ficha por cliente, con la lista de lo que falta para que su WhatsApp
 * responda de verdad. Los pasos se marcan a mano: no se pueden deducir del
 * sistema porque la mitad ocurre fuera (trámites del SII, verificación de
 * Meta, el acuerdo de cobro).
 */

function Row({ label, value }: { label: string; value: string }) {
  if (!value) return null
  return (
    <div className="flex gap-2 py-1">
      <span className="w-40 shrink-0 text-gray-500">{label}</span>
      <span className="whitespace-pre-line text-gray-300">{value}</span>
    </div>
  )
}

function Card({
  intake,
  businesses,
}: {
  intake: ClientIntake
  businesses: { id: string; name: string }[]
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const done = INTAKE_STEPS.filter((step) => intake.steps.includes(step.id)).length
  const complete = done === INTAKE_STEPS.length
  const industry = getIndustryTemplate(intake.industry)

  async function patch(body: Record<string, unknown>) {
    setBusy(true)
    await fetch(`/api/admin/altas/${intake.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setBusy(false)
    router.refresh()
  }

  function toggleStep(stepId: string, checked: boolean) {
    const steps = checked
      ? [...intake.steps, stepId]
      : intake.steps.filter((item) => item !== stepId)
    return patch({ steps })
  }

  async function remove() {
    if (!window.confirm(`¿Borrar la ficha de ${intake.businessName}? No se puede deshacer.`)) return
    setBusy(true)
    await fetch(`/api/admin/altas/${intake.id}`, { method: 'DELETE' })
    setBusy(false)
    router.refresh()
  }

  return (
    <section className="rounded-lg border border-gray-800 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="font-medium text-white">
            {industry?.emoji} {intake.businessName}
          </h3>
          <p className="mt-1 text-sm text-gray-400">
            {intake.contactName} · {intake.contactEmail}
            {intake.contactPhone && ` · ${intake.contactPhone}`}
          </p>
          <p className="text-xs text-gray-600">
            Alta del{' '}
            {new Date(intake.createdAt).toLocaleDateString('es-CL', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
            })}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-4">
          <span className={`text-sm ${complete ? 'text-success' : 'text-amber-400'}`}>
            {done} de {INTAKE_STEPS.length}
          </span>
          <button
            onClick={remove}
            disabled={busy}
            className="text-xs text-gray-600 hover:text-danger disabled:opacity-50"
          >
            Borrar
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-x-8 gap-y-2 sm:grid-cols-2">
        {INTAKE_STEPS.map((step) => {
          const checked = intake.steps.includes(step.id)
          return (
            <label key={step.id} className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={checked}
                disabled={busy}
                onChange={(e) => toggleStep(step.id, e.target.checked)}
                className="mt-0.5"
              />
              <span className={checked ? 'text-gray-500 line-through' : 'text-gray-300'}>
                {step.label}
              </span>
            </label>
          )
        })}
      </div>

      {intake.whatsappNumber && !intake.whatsappClean && (
        <p className="mt-4 rounded-md border border-amber-700/40 bg-amber-500/5 px-3 py-2 text-xs text-amber-200">
          Falta confirmar que {intake.whatsappNumber} no tenga WhatsApp instalado. Si lo usa a
          diario, al conectarlo lo pierde en el teléfono.
        </p>
      )}

      <details className="mt-4">
        <summary className="cursor-pointer select-none text-sm text-amber-400">
          Ver los datos que dio
        </summary>
        <div className="mt-3 text-xs">
          <Row label="Razón social" value={intake.legalName} />
          <Row label="RUT" value={intake.rut} />
          <Row label="Domicilio" value={intake.address} />
          <Row label="WhatsApp" value={intake.whatsappNumber} />
          <Row label="Horarios" value={intake.hours} />
          <Row label="Formas de pago" value={intake.payments} />
          <Row label="Qué vende" value={intake.catalog} />
          <Row label="Si no sabe algo" value={intake.escalation} />
          <Row label="Notas" value={intake.notes} />
        </div>
      </details>

      <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-gray-800 pt-4 text-sm">
        <span className="text-gray-500">Negocio en la plataforma:</span>
        <select
          value={intake.businessId ?? ''}
          disabled={busy}
          onChange={(e) => patch({ businessId: e.target.value || null })}
          className="input w-auto py-1 text-sm"
        >
          <option value="">Todavía no creado</option>
          {businesses.map((business) => (
            <option key={business.id} value={business.id}>
              {business.name}
            </option>
          ))}
        </select>
        {intake.businessId && (
          <Link
            href={`/panel/${intake.businessId}`}
            className="text-amber-400 hover:underline"
          >
            Abrir su panel →
          </Link>
        )}
      </div>
    </section>
  )
}

export default function IntakeList({
  intakes,
  businesses,
}: {
  intakes: ClientIntake[]
  businesses: { id: string; name: string }[]
}) {
  if (intakes.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-gray-800 px-6 py-10 text-center text-sm text-gray-500">
        Todavía no hay altas. Crea una al cerrar la próxima venta y te queda la lista de lo que
        falta pedirle al cliente.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {intakes.map((intake) => (
        <Card key={intake.id} intake={intake} businesses={businesses} />
      ))}
    </div>
  )
}
