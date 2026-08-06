'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import type { PublicBusiness } from '@/lib/publicBusiness'
import ChannelConnect from './ChannelConnect'
import CopyField from './CopyField'

const WHATSAPP_HELP = 'https://developers.facebook.com/docs/whatsapp/cloud-api/get-started'
const INSTAGRAM_HELP = 'https://developers.facebook.com/docs/messenger-platform/instagram'

export default function ConexionesPage() {
  const params = useParams<{ businessId: string }>()
  const businessId = params.businessId

  const [business, setBusiness] = useState<PublicBusiness | null>(null)
  const [appUrl, setAppUrl] = useState('')

  const load = useCallback(async () => {
    const res = await fetch(`/api/businesses/${businessId}`)
    if (res.ok) setBusiness((await res.json()).business)
  }, [businessId])

  useEffect(() => {
    setAppUrl(window.location.origin)
    load()
  }, [load])

  if (!business) {
    return <div className="px-8 py-12 text-gray-500">Cargando…</div>
  }

  return (
    <div className="mx-auto max-w-2xl px-8 py-12">
      <h1 className="text-2xl font-bold text-white">Conexiones</h1>
      <p className="mt-2 text-sm text-gray-400">
        Pegá tu token de Meta una vez y elegí la cuenta de la lista. Se valida contra Meta antes de
        guardar, así no te enterás de que algo estaba mal recién cuando escribe un cliente.
      </p>

      <div className="mt-8 flex flex-col gap-4">
        <ChannelConnect
          businessId={businessId}
          channel="whatsapp"
          title="WhatsApp Business"
          connected={business.channels.whatsapp.connected}
          accountId={business.channels.whatsapp.accountId}
          helpUrl={WHATSAPP_HELP}
          onChanged={load}
        />

        <ChannelConnect
          businessId={businessId}
          channel="instagram"
          title="Instagram"
          connected={business.channels.instagram.connected}
          accountId={business.channels.instagram.accountId}
          helpUrl={INSTAGRAM_HELP}
          onChanged={load}
        />
      </div>

      <section className="mt-8 rounded-lg border border-gray-800 p-6">
        <h2 className="font-medium text-white">Webhooks en Meta</h2>
        <p className="mt-1 text-xs text-gray-500">
          Pegá estas URLs en la configuración de webhooks de tu app de Meta. Son las mismas para
          todos tus negocios: el sistema reconoce solo a cuál corresponde cada mensaje.
        </p>
        <div className="mt-4 flex flex-col gap-4">
          <CopyField label="URL de webhook — WhatsApp" value={`${appUrl}/api/webhooks/whatsapp`} />
          <CopyField label="URL de webhook — Instagram" value={`${appUrl}/api/webhooks/instagram`} />
        </div>
        <p className="mt-4 text-xs text-gray-500">
          El verify token es el valor de{' '}
          <code className="text-amber-400">WHATSAPP_VERIFY_TOKEN</code> /{' '}
          <code className="text-amber-400">INSTAGRAM_VERIFY_TOKEN</code> en tus variables de
          entorno. Suscribite al campo <span className="text-gray-300">messages</span>.
        </p>
      </section>

      <p className="mt-8 text-xs text-gray-600">
        Nota: en este prototipo los tokens se guardan en texto plano en el archivo de datos. Antes
        de usarlo en producción con clientes reales, conviene moverlos a un gestor de secretos o
        cifrarlos en la base.
      </p>
    </div>
  )
}
