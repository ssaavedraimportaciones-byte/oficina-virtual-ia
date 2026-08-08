'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { INDUSTRY_TEMPLATES, type IndustryTemplate } from '@/lib/industries'
import AgentConfigForm, { type ConfigFormState } from '../AgentConfigForm'

export default function NuevoNegocioPage() {
  const router = useRouter()
  const [template, setTemplate] = useState<IndustryTemplate | null>(null)
  const [form, setForm] = useState<ConfigFormState | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function pickTemplate(picked: IndustryTemplate) {
    setTemplate(picked)
    setForm({
      agentName: '',
      businessName: '',
      industry: picked.industry,
      description: picked.description,
      goals: picked.goals,
      tone: picked.tone,
      channels: ['whatsapp'],
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form || !template) return

    setSaving(true)
    setError(null)

    const res = await fetch('/api/businesses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ templateId: template.id, config: form }),
    })

    setSaving(false)

    if (!res.ok) {
      setError('Revisá que todos los campos estén completos.')
      return
    }

    const { business } = await res.json()
    router.push(`/panel/${business.id}/conocimiento`)
  }

  if (!template || !form) {
    return (
      <div className="mx-auto max-w-3xl px-8 py-12">
        <Link href="/panel" className="text-sm text-gray-500 hover:text-gray-300">
          ← Volver
        </Link>
        <h1 className="mt-4 text-2xl font-bold text-white">¿A qué se dedica el negocio?</h1>
        <p className="mt-2 text-sm text-gray-400">
          Elegí el rubro y el agente arranca preconfigurado. Después podés editar todo, y si tu
          rubro no está en la lista, usá &ldquo;Otro rubro&rdquo; y escribilo vos.
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {INDUSTRY_TEMPLATES.map((option) => (
            <button
              key={option.id}
              onClick={() => pickTemplate(option)}
              className="flex items-center gap-3 rounded-lg border border-gray-800 px-5 py-4 text-left hover:border-amber-500/60 hover:bg-gray-900/60"
            >
              <span className="text-2xl">{option.emoji}</span>
              <span className="font-medium text-white">{option.label}</span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-8 py-12">
      <button
        onClick={() => setTemplate(null)}
        className="text-sm text-gray-500 hover:text-gray-300"
      >
        ← Cambiar rubro
      </button>

      <h1 className="mt-4 text-2xl font-bold text-white">
        {template.emoji} {template.label}
      </h1>
      <p className="mt-2 text-sm text-gray-400">
        Ya viene precargado para este rubro. Completá el nombre y ajustá lo que quieras.
      </p>

      <form onSubmit={handleSubmit} className="mt-10 flex flex-col gap-6">
        <AgentConfigForm form={form} onChange={setForm} />

        {error && <p className="text-sm text-danger">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-amber-500 px-6 py-3 font-medium text-gray-950 hover:bg-amber-400 disabled:opacity-50"
        >
          {saving ? 'Creando…' : 'Crear negocio'}
        </button>
      </form>
    </div>
  )
}
