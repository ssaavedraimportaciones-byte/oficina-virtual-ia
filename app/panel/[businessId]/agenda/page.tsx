'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { formatDateLabel, splitLocal } from '@/lib/agenda'
import type { Appointment, Service, WeekHours } from '@/lib/types'

const DAY_LABELS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

export default function AgendaPage() {
  const params = useParams<{ businessId: string }>()
  const businessId = params.businessId

  const [hours, setHours] = useState<WeekHours | null>(null)
  const [services, setServices] = useState<Service[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])

  const [name, setName] = useState('')
  const [duration, setDuration] = useState('60')
  const [price, setPrice] = useState('')
  const [savingService, setSavingService] = useState(false)

  const [savingHours, setSavingHours] = useState(false)
  const [hoursSaved, setHoursSaved] = useState(false)
  const [hoursError, setHoursError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await fetch(`/api/businesses/${businessId}/agenda`)
    if (!res.ok) return
    const data = await res.json()
    setHours(data.hours)
    setServices(data.services ?? [])
    setAppointments(data.appointments ?? [])
  }, [businessId])

  useEffect(() => {
    load()
  }, [load])

  function updateDay(index: number, next: { open: string; close: string } | null) {
    setHours((prev) => {
      if (!prev) return prev
      const copy = [...prev]
      copy[index] = next
      return copy
    })
    setHoursSaved(false)
  }

  async function saveHours() {
    if (!hours) return
    setSavingHours(true)
    setHoursError(null)

    const res = await fetch(`/api/businesses/${businessId}/agenda`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hours }),
    })

    setSavingHours(false)
    if (!res.ok) {
      const data = await res.json()
      setHoursError(
        typeof data.error === 'string' ? data.error : 'Revisá los horarios cargados.',
      )
      return
    }
    setHoursSaved(true)
  }

  async function addServiceHandler(e: React.FormEvent) {
    e.preventDefault()
    setSavingService(true)

    await fetch(`/api/businesses/${businessId}/agenda`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, durationMinutes: Number(duration), price }),
    })

    setSavingService(false)
    setName('')
    setPrice('')
    await load()
  }

  async function removeService(id: string) {
    await fetch(`/api/services/${id}`, { method: 'DELETE' })
    await load()
  }

  async function cancel(id: string) {
    if (!window.confirm('¿Cancelar este turno?')) return
    await fetch(`/api/appointments/${id}`, { method: 'DELETE' })
    await load()
  }

  if (!hours) {
    return <div className="px-8 py-12 text-gray-500">Cargando…</div>
  }

  const upcoming = appointments.filter((a) => a.status === 'confirmado')

  return (
    <div className="mx-auto max-w-2xl px-8 py-12">
      <h1 className="text-2xl font-bold text-white">Agenda</h1>
      <p className="mt-2 text-sm text-gray-400">
        Cargá tus servicios y horarios, y el agente va a poder consultar disponibilidad y reservar
        turnos solo, directamente desde el chat.
      </p>

      {services.length === 0 && (
        <div className="mt-6 rounded-lg border border-amber-500/30 bg-amber-500/5 p-5 text-sm text-gray-300">
          Hasta que cargues al menos un servicio, el agente no puede reservar: va a tomar los
          datos y decir que confirma el horario a la brevedad.
        </div>
      )}

      <section className="mt-6 rounded-lg border border-gray-800 p-6">
        <h2 className="font-medium text-white">Servicios</h2>
        <p className="mt-1 text-xs text-gray-500">
          La duración define cada cuánto se puede reservar y cuándo se pisa un turno con otro.
        </p>

        {services.length > 0 && (
          <div className="mt-4 flex flex-col divide-y divide-gray-800 rounded-md border border-gray-800">
            {services.map((service) => (
              <div key={service.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <div className="text-sm text-white">{service.name}</div>
                  <div className="text-xs text-gray-500">
                    {service.durationMinutes} min · {service.price}
                  </div>
                </div>
                <button
                  onClick={() => removeService(service.id)}
                  className="text-xs text-gray-500 hover:text-danger"
                >
                  Eliminar
                </button>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={addServiceHandler} className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Servicio, ej: Semipermanente"
            className="input flex-1"
          />
          <input
            required
            type="number"
            min={5}
            step={5}
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            placeholder="min"
            className="input sm:w-24"
          />
          <input
            required
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="$8000"
            className="input sm:w-28"
          />
          <button
            type="submit"
            disabled={savingService}
            className="shrink-0 rounded-md border border-gray-700 px-4 py-2 text-sm text-gray-200 hover:border-amber-500 hover:text-amber-400 disabled:opacity-50"
          >
            {savingService ? 'Agregando…' : 'Agregar'}
          </button>
        </form>
      </section>

      <section className="mt-6 rounded-lg border border-gray-800 p-6">
        <h2 className="font-medium text-white">Horarios de atención</h2>
        <div className="mt-4 flex flex-col gap-2">
          {DAY_LABELS.map((label, index) => {
            const day = hours[index]
            return (
              <div key={label} className="flex items-center gap-3">
                <label className="flex w-32 items-center gap-2 text-sm text-gray-300">
                  <input
                    type="checkbox"
                    checked={Boolean(day)}
                    onChange={(e) =>
                      updateDay(index, e.target.checked ? { open: '09:00', close: '18:00' } : null)
                    }
                  />
                  {label}
                </label>
                {day ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      value={day.open}
                      onChange={(e) => updateDay(index, { ...day, open: e.target.value })}
                      className="input w-28"
                    />
                    <span className="text-gray-600">a</span>
                    <input
                      type="time"
                      value={day.close}
                      onChange={(e) => updateDay(index, { ...day, close: e.target.value })}
                      className="input w-28"
                    />
                  </div>
                ) : (
                  <span className="text-sm text-gray-600">Cerrado</span>
                )}
              </div>
            )
          })}
        </div>

        {hoursError && <p className="mt-3 text-sm text-danger">{hoursError}</p>}

        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={saveHours}
            disabled={savingHours}
            className="rounded-md bg-amber-500 px-5 py-2 text-sm font-medium text-gray-950 hover:bg-amber-400 disabled:opacity-50"
          >
            {savingHours ? 'Guardando…' : 'Guardar horarios'}
          </button>
          {hoursSaved && <span className="text-sm text-success">Guardado.</span>}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 font-medium text-white">Turnos reservados ({upcoming.length})</h2>
        {upcoming.length === 0 ? (
          <p className="text-sm text-gray-500">Todavía no hay turnos reservados.</p>
        ) : (
          <div className="flex flex-col divide-y divide-gray-800 rounded-lg border border-gray-800">
            {upcoming.map((appointment) => {
              const { date, time } = splitLocal(appointment.startsAt)
              return (
                <div
                  key={appointment.id}
                  className="flex items-center justify-between gap-4 px-5 py-4"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-white">
                      {appointment.contactName} — {appointment.serviceName}
                    </div>
                    <div className="text-xs text-gray-500">
                      {formatDateLabel(date)} a las {time} · {appointment.durationMinutes} min
                    </div>
                  </div>
                  <button
                    onClick={() => cancel(appointment.id)}
                    className="shrink-0 text-xs text-gray-500 hover:text-danger"
                  >
                    Cancelar
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
