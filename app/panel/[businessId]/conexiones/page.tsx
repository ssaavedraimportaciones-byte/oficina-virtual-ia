'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import type { Business, ChannelCredentials } from '@/lib/types'

const EMPTY: ChannelCredentials = {
  whatsappPhoneNumberId: null,
  whatsappAccessToken: null,
  instagramPageId: null,
  instagramAccessToken: null,
}

export default function ConexionesPage() {
  const params = useParams<{ businessId: string }>()
  const businessId = params.businessId

  const [credentials, setCredentials] = useState<ChannelCredentials | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [appUrl, setAppUrl] = useState('')

  useEffect(() => {
    setAppUrl(window.location.origin)
    fetch(`/api/businesses/${businessId}`)
      .then((res) => res.json())
      .then((data: { business?: Business }) => {
        setCredentials(data.business?.credentials ?? EMPTY)
      })
  }, [businessId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!credentials) return

    setSaving(true)
    setSaved(false)

    const res = await fetch(`/api/businesses/${businessId}/credentials`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    })

    setSaving(false)
    if (res.ok) setSaved(true)
  }

  function update(field: keyof ChannelCredentials, value: string) {
    setCredentials((prev) => ({ ...(prev ?? EMPTY), [field]: value || null }))
  }

  if (!credentials) {
    return <div className="px-8 py-12 text-gray-500">Cargando…</div>
  }

  return (
    <div className="mx-auto max-w-2xl px-8 py-12">
      <h1 className="text-2xl font-bold text-white">Conexiones</h1>
      <p className="mt-2 text-sm text-gray-400">
        El ID identifica a este negocio: es lo que permite que un mismo webhook atienda a todos
        tus clientes y le mande cada mensaje al agente correcto.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-6">
        <section className="rounded-lg border border-gray-800 p-6">
          <h2 className="font-medium text-white">WhatsApp Business</h2>
          <div className="mt-4 flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm text-gray-200">Phone number ID</span>
              <input
                value={credentials.whatsappPhoneNumberId ?? ''}
                onChange={(e) => update('whatsappPhoneNumberId', e.target.value)}
                placeholder="123456789012345"
                className="input"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm text-gray-200">
                Access token <span className="text-gray-500">(opcional)</span>
              </span>
              <span className="text-xs text-gray-500">
                Si lo dejás vacío se usa el token general de las variables de entorno, que sirve
                cuando todos tus clientes están bajo la misma app de Meta.
              </span>
              <input
                type="password"
                value={credentials.whatsappAccessToken ?? ''}
                onChange={(e) => update('whatsappAccessToken', e.target.value)}
                className="input"
              />
            </label>
          </div>
          <p className="mt-4 text-xs text-gray-500">
            Webhook:{' '}
            <code className="break-all text-amber-400">{appUrl}/api/webhooks/whatsapp</code>
            {' — '}verify token: <code className="text-amber-400">WHATSAPP_VERIFY_TOKEN</code>
          </p>
        </section>

        <section className="rounded-lg border border-gray-800 p-6">
          <h2 className="font-medium text-white">Instagram</h2>
          <div className="mt-4 flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm text-gray-200">
                ID de la cuenta de Instagram (Business o Creator)
              </span>
              <input
                value={credentials.instagramPageId ?? ''}
                onChange={(e) => update('instagramPageId', e.target.value)}
                placeholder="17841400000000000"
                className="input"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm text-gray-200">
                Access token <span className="text-gray-500">(opcional)</span>
              </span>
              <input
                type="password"
                value={credentials.instagramAccessToken ?? ''}
                onChange={(e) => update('instagramAccessToken', e.target.value)}
                className="input"
              />
            </label>
          </div>
          <p className="mt-4 text-xs text-gray-500">
            Webhook:{' '}
            <code className="break-all text-amber-400">{appUrl}/api/webhooks/instagram</code>
            {' — '}verify token: <code className="text-amber-400">INSTAGRAM_VERIFY_TOKEN</code>
          </p>
        </section>

        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-amber-500 px-6 py-3 font-medium text-gray-950 hover:bg-amber-400 disabled:opacity-50"
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
          {saved && <span className="text-sm text-success">Guardado.</span>}
        </div>
      </form>

      <p className="mt-8 text-xs text-gray-600">
        Nota: en este prototipo los tokens se guardan en texto plano en el archivo de datos. Antes
        de usarlo en producción con clientes reales, conviene moverlos a un gestor de secretos o
        cifrarlos en la base.
      </p>
    </div>
  )
}
