'use client'

import type { Channel, Tone } from '@/lib/types'

const TONE_OPTIONS: { value: Tone; label: string }[] = [
  { value: 'cercano', label: 'Cercano y amigable' },
  { value: 'formal', label: 'Profesional y formal' },
  { value: 'directo', label: 'Directo y resolutivo' },
]

const CHANNEL_OPTIONS: { value: Channel; label: string }[] = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'instagram', label: 'Instagram' },
]

export interface ConfigFormState {
  agentName: string
  businessName: string
  industry: string
  description: string
  goals: string
  tone: Tone
  channels: Channel[]
}

export function Field({
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

export default function AgentConfigForm({
  form,
  onChange,
}: {
  form: ConfigFormState
  onChange: (form: ConfigFormState) => void
}) {
  function toggleChannel(channel: Channel) {
    onChange({
      ...form,
      channels: form.channels.includes(channel)
        ? form.channels.filter((c) => c !== channel)
        : [...form.channels, channel],
    })
  }

  return (
    <>
      <Field label="Nombre del agente" hint="Así se va a presentar en el chat, ej: Sofía">
        <input
          required
          value={form.agentName}
          onChange={(e) => onChange({ ...form, agentName: e.target.value })}
          className="input"
          placeholder="Sofía"
        />
      </Field>

      <Field label="Nombre del negocio">
        <input
          required
          value={form.businessName}
          onChange={(e) => onChange({ ...form, businessName: e.target.value })}
          className="input"
          placeholder="Estudio de uñas Bella"
        />
      </Field>

      <Field label="Rubro / a qué se dedica">
        <input
          required
          value={form.industry}
          onChange={(e) => onChange({ ...form, industry: e.target.value })}
          className="input"
          placeholder="Manicura y esmaltado semipermanente"
        />
      </Field>

      <Field label="Descripción del negocio" hint="Contexto que el agente necesita saber">
        <textarea
          required
          rows={3}
          value={form.description}
          onChange={(e) => onChange({ ...form, description: e.target.value })}
          className="input"
        />
      </Field>

      <Field label="Qué necesitás que haga el agente" hint="Su objetivo en cada conversación">
        <textarea
          required
          rows={4}
          value={form.goals}
          onChange={(e) => onChange({ ...form, goals: e.target.value })}
          className="input"
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
                onChange={() => onChange({ ...form, tone: option.value })}
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
    </>
  )
}
