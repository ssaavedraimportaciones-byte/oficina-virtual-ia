'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { AgentConfig, Channel, Tone } from '@/lib/types'

const TONE_OPTIONS: { value: Tone; label: string }[] = [
  { value: 'cercano', label: 'Cercano y amigable' },
  { value: 'formal', label: 'Profesional y formal' },
  { value: 'directo', label: 'Directo y resolutivo' },
]

const CHANNEL_OPTIONS: { value: Channel; label: string }[] = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'instagram', label: 'Instagram' },
]

type FormState = Omit<AgentConfig, 'configuredAt' | 'channels'> & { channels: Channel[] }

const EMPTY_FORM: FormState = {
  agentName: '',
  businessName: '',
  industry: '',
  description: '',
  goals: '',
  tone: 'cercano',
  channels: ['whatsapp'],
}

export default function ConfigurarPage() {
  const router = useRouter()
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/config')
      .then((res) => res.json())
      .then((data: { config: AgentConfig | null }) => {
        if (data.config) setForm(data.config)
      })
  }, [])

  function toggleChannel(channel: Channel) {
    setForm((prev) => ({
      ...prev,
      channels: prev.channels.includes(channel)
        ? prev.channels.filter((c) => c !== channel)
        : [...prev.channels, channel],
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const res = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })

    setSaving(false)

    if (!res.ok) {
      setError('Revisá que todos los campos estén completos.')
      return
    }

    router.push('/panel')
  }

  return (
    <div className="mx-auto max-w-2xl px-8 py-12">
      <h1 className="text-2xl font-bold text-white">Configurá tu agente</h1>
      <p className="mt-2 text-sm text-gray-400">
        Contanos de tu empresa y qué necesitás que haga el agente. Con eso se auto-estructura su
        forma de hablar y de vender.
      </p>

      <form onSubmit={handleSubmit} className="mt-10 flex flex-col gap-6">
        <Field label="Nombre del agente" hint="Así se va a presentar en el chat, ej: Sofía">
          <input
            required
            value={form.agentName}
            onChange={(e) => setForm({ ...form, agentName: e.target.value })}
            className="input"
            placeholder="Sofía"
          />
        </Field>

        <Field label="Nombre de tu empresa">
          <input
            required
            value={form.businessName}
            onChange={(e) => setForm({ ...form, businessName: e.target.value })}
            className="input"
            placeholder="Inmobiliaria Del Sur"
          />
        </Field>

        <Field label="Rubro / a qué se dedica">
          <input
            required
            value={form.industry}
            onChange={(e) => setForm({ ...form, industry: e.target.value })}
            className="input"
            placeholder="Inmobiliaria, venta y alquiler de propiedades"
          />
        </Field>

        <Field label="Descripción de la empresa" hint="Contexto que el agente necesita saber">
          <textarea
            required
            rows={3}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="input"
            placeholder="Vendemos y alquilamos propiedades en Buenos Aires hace 15 años, atendemos particulares e inversores."
          />
        </Field>

        <Field label="Qué necesitás que haga el agente" hint="Su objetivo en cada conversación">
          <textarea
            required
            rows={4}
            value={form.goals}
            onChange={(e) => setForm({ ...form, goals: e.target.value })}
            className="input"
            placeholder="Calificar si busca comprar o alquilar, qué zona y presupuesto, y agendar una visita con el equipo."
          />
        </Field>

        <Field label="Tono de comunicación">
          <div className="flex flex-col gap-2">
            {TONE_OPTIONS.map((option) => (
              <label key={option.value} className="flex items-center gap-2 text-sm text-gray-300">
                <input
                  type="radio"
                  name="tone"
                  checked={form.tone === option.value}
                  onChange={() => setForm({ ...form, tone: option.value })}
                />
                {option.label}
              </label>
            ))}
          </div>
        </Field>

        <Field label="Canales">
          <div className="flex gap-4">
            {CHANNEL_OPTIONS.map((option) => (
              <label key={option.value} className="flex items-center gap-2 text-sm text-gray-300">
                <input
                  type="checkbox"
                  checked={form.channels.includes(option.value)}
                  onChange={() => toggleChannel(option.value)}
                />
                {option.label}
              </label>
            ))}
          </div>
        </Field>

        {error && <p className="text-sm text-danger">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-amber-500 px-6 py-3 font-medium text-gray-950 hover:bg-amber-400 disabled:opacity-50"
        >
          {saving ? 'Guardando…' : 'Guardar y estructurar agente'}
        </button>
      </form>
    </div>
  )
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
