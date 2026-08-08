'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import type { Business } from '@/lib/types'
import AgentConfigForm, { type ConfigFormState } from '../../AgentConfigForm'

export default function ConfigurarPage() {
  const params = useParams<{ businessId: string }>()
  const router = useRouter()
  const [form, setForm] = useState<ConfigFormState | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch(`/api/businesses/${params.businessId}`)
      .then((res) => res.json())
      .then((data: { business?: Business }) => {
        if (data.business) {
          const { configuredAt: _configuredAt, ...rest } = data.business.config
          setForm(rest)
        }
      })
  }, [params.businessId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form) return

    setSaving(true)
    setError(null)
    setSaved(false)

    const res = await fetch(`/api/businesses/${params.businessId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })

    setSaving(false)

    if (!res.ok) {
      setError('Revisá que todos los campos estén completos.')
      return
    }

    setSaved(true)
    router.refresh()
  }

  if (!form) {
    return <div className="px-8 py-12 text-gray-500">Cargando…</div>
  }

  return (
    <div className="mx-auto max-w-2xl px-8 py-12">
      <h1 className="text-2xl font-bold text-white">Configurá tu agente</h1>
      <p className="mt-2 text-sm text-gray-400">
        Esto define cómo habla y qué busca lograr. Los datos concretos (precios, catálogo, tu
        sitio web) se cargan aparte en{' '}
        <Link
          href={`/panel/${params.businessId}/conocimiento`}
          className="text-amber-400 hover:underline"
        >
          Base de conocimiento
        </Link>
        .
      </p>

      <form onSubmit={handleSubmit} className="mt-10 flex flex-col gap-6">
        <AgentConfigForm form={form} onChange={setForm} />

        {error && <p className="text-sm text-danger">{error}</p>}
        {saved && <p className="text-sm text-success">Guardado.</p>}

        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-amber-500 px-6 py-3 font-medium text-gray-950 hover:bg-amber-400 disabled:opacity-50"
        >
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </form>
    </div>
  )
}
