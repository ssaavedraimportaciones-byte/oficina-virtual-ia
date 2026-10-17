'use client'

import { useState } from 'react'

interface DiscoveredAccount {
  id: string
  displayPhoneNumber?: string
  verifiedName?: string
  username?: string
  pageName?: string
}

/**
 * Guía paso a paso para conseguir el token, en español llano y bien de a poco:
 * el link a los docs de Meta (en inglés, pensado para desarrolladores) no
 * alcanza para alguien que nunca entró a Meta for Developers. Cada paso dice
 * exactamente qué botón apretar y qué letrero buscar, porque "configura tu
 * app" sin más detalle es donde la gente se pierde. Esto no reemplaza la
 * verificación de Meta (eso lo exige Meta, no nosotros), pero evita que el
 * dueño del negocio quede dando vueltas.
 */
const STEPS: Record<'whatsapp' | 'instagram', { title: string; intro: string; items: string[]; note: string }> = {
  whatsapp: {
    title: 'Cómo conseguir el token de WhatsApp',
    intro:
      'Tranquilo 🙂 Parece largo, pero es solo ir apretando botones en orden, uno por uno. No te saltes ningún paso y va a salir bien.',
    items: [
      'Abre developers.facebook.com en el computador (en el celular es más incómodo) y entra con tu cuenta de Facebook.',
      'Arriba a la derecha, aprieta "Mis apps".',
      'Aprieta el botón "Crear app". Cuando pregunte qué tipo de app es, elige "Negocio".',
      'Dentro de tu app nueva, busca el cuadro que dice "WhatsApp" y aprieta "Configurar".',
      'Antes de seguir: ve a "Configuración de la empresa" → "Información del negocio" y completa tu nombre, dirección y teléfono. Si saltas este paso, Meta no te deja avanzar más adelante.',
      'Vuelve a "Configuración de la empresa" → "Usuarios del sistema" → "Agregar". Ponle un nombre (por ejemplo "mi-bot") y elige el rol "Administrador".',
      'Con ese usuario ya elegido, aprieta "Asignar activos" DOS veces, una por una: la primera vez elige tu app y dale "Acceso total"; la segunda vez elige tu cuenta de WhatsApp y dale también "Acceso total". Si las dos quedan en una sola pasada, de todos modos revisa que ambas aparezcan asignadas antes de seguir.',
      'Ahora sí, aprieta "Generar token". Elige tu app, elige que el token no expire nunca ("Nunca" en vez de "60 días"), y marca los permisos de WhatsApp que te deje marcar (no todas las apps dejan marcar los mismos; está bien si solo aparecen un par).',
      'Te va a aparecer un código largo que empieza con "EAA". Cópialo completo, sin dejar nada afuera.',
      'Pégalo aquí abajo, en el primer cuadro ("1. Pega tu token de acceso de Meta"), y aprieta "Buscar mis cuentas".',
      'Si tu número aparece en una lista, apriétalo y listo. Si no aparece nada: no es un error, es normal. Más abajo hay un cuadrito chico que dice "O pega el Phone number ID" — ahí va el número de identificación de tu WhatsApp (lo encuentras en Meta, en la página de tu cuenta de WhatsApp), nunca el token. Pégalo ahí y aprieta el botón "Conectar" que está al lado de ese cuadrito, no el de "Buscar mis cuentas".',
    ],
    note: 'Con el número de prueba que da Meta solo pueden escribirte hasta 5 contactos que tú agregues a mano. Para que te escriba cualquier cliente, hace falta tu propio número de WhatsApp y que Meta verifique tu negocio — eso lo hace Meta, no nosotros, y puede tardar hasta 5 días. Mientras tanto puedes seguir probando el sistema con el simulador de conversación del panel.',
  },
  instagram: {
    title: 'Cómo conseguir el token de Instagram',
    intro: 'Tranquilo 🙂 Son los mismos pasos que con WhatsApp, solo cambian algunos nombres.',
    items: [
      'La cuenta de Instagram tiene que ser "Profesional" (Business o Creador) y estar vinculada a una página de Facebook — si no, Instagram no deja conectar nada por fuera de la app oficial.',
      'En developers.facebook.com, en tu app (o en una nueva tipo "Negocio") agrega el producto "Instagram".',
      'En "Configuración de la empresa" → "Cuentas" → "Instagram", vincula tu página de Facebook y tu cuenta de Instagram.',
      'En "Usuarios del sistema" → "Generar nuevo token", marca los permisos instagram_basic, instagram_manage_messages y pages_messaging. Elige que no expire.',
      'Copia ese token completo y pégalo abajo.',
    ],
    note: 'Igual que con WhatsApp, Meta pide verificar el negocio antes de que puedas responder mensajes de cualquier persona — eso puede tardar unos días.',
  },
}

function accountLabel(channel: 'whatsapp' | 'instagram', account: DiscoveredAccount) {
  if (channel === 'whatsapp') {
    return account.verifiedName
      ? `${account.displayPhoneNumber} — ${account.verifiedName}`
      : account.displayPhoneNumber ?? account.id
  }
  return account.pageName ? `@${account.username} — ${account.pageName}` : `@${account.username}`
}

export default function ChannelConnect({
  businessId,
  channel,
  title,
  connected,
  accountId,
  helpUrl,
  onChanged,
}: {
  businessId: string
  channel: 'whatsapp' | 'instagram'
  title: string
  connected: boolean
  accountId: string | null
  helpUrl: string
  onChanged: () => void
}) {
  const [open, setOpen] = useState(false)
  const [token, setToken] = useState('')
  const [accounts, setAccounts] = useState<DiscoveredAccount[] | null>(null)
  const [manualId, setManualId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setOpen(false)
    setToken('')
    setAccounts(null)
    setManualId('')
    setError(null)
  }

  async function handleDiscover(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)

    const res = await fetch('/api/meta/discover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel, token }),
    })
    const data = await res.json()
    setBusy(false)

    if (!res.ok) {
      // El token puede no tener permisos para listar, pero sí para operar una
      // cuenta puntual: se ofrece igual la carga manual del ID.
      setError(`${data.error ?? 'No se pudieron leer las cuentas'}. Puedes cargar el ID a mano.`)
      setAccounts([])
      return
    }
    setAccounts(data.accounts ?? [])
  }

  async function connect(id: string) {
    setBusy(true)
    setError(null)

    const res = await fetch(`/api/businesses/${businessId}/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel, accountId: id, token }),
    })
    const data = await res.json()
    setBusy(false)

    if (!res.ok) {
      setError(data.error ?? 'No se pudo conectar')
      return
    }
    reset()
    onChanged()
    if (data.warning) window.alert(`Conectado, pero ojo: ${data.warning}`)
  }

  async function handleDisconnect() {
    if (!window.confirm(`¿Desconectar ${title}? El agente deja de responder por este canal.`)) {
      return
    }
    setBusy(true)
    await fetch(`/api/businesses/${businessId}/connect`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel }),
    })
    setBusy(false)
    onChanged()
  }

  return (
    <section className="rounded-lg border border-gray-800 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={`inline-block h-2 w-2 rounded-full ${connected ? 'bg-success' : 'bg-gray-600'}`}
            />
            <h2 className="font-medium text-white">{title}</h2>
          </div>
          <p className="mt-1 text-sm text-gray-400">
            {connected ? `Conectado — cuenta ${accountId}` : 'Sin conectar'}
          </p>
        </div>
        {connected ? (
          <button
            onClick={handleDisconnect}
            disabled={busy}
            className="shrink-0 text-sm text-gray-400 hover:text-danger disabled:opacity-50"
          >
            Desconectar
          </button>
        ) : (
          !open && (
            <button
              onClick={() => setOpen(true)}
              className="shrink-0 rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-gray-950 hover:bg-amber-400"
            >
              Conectar
            </button>
          )
        )}
      </div>

      {open && !connected && (
        <div className="mt-6 border-t border-gray-800 pt-6">
          {accounts === null ? (
            <form onSubmit={handleDiscover} className="flex flex-col gap-3">
              <details className="rounded-md border border-gray-800 bg-gray-900/60 open:pb-3">
                <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-amber-400">
                  ¿Cómo consigo el token? — {STEPS[channel].title.replace('Cómo conseguir el token de ', '')}
                </summary>
                <p className="mx-4 mt-1 text-xs leading-relaxed text-gray-300">{STEPS[channel].intro}</p>
                <ol className="mx-4 mt-3 list-decimal space-y-2 pl-4 text-xs leading-relaxed text-gray-400">
                  {STEPS[channel].items.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ol>
                <p className="mx-4 mt-3 text-xs text-gray-500">⚠️ {STEPS[channel].note}</p>
                <p className="mx-4 mt-2 text-xs text-gray-500">
                  <a href={helpUrl} target="_blank" rel="noreferrer" className="text-amber-400 hover:underline">
                    Ver la guía oficial de Meta
                  </a>{' '}
                  si algún paso cambió o quieres más detalle.
                </p>
              </details>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-gray-200">
                  1. Pega tu token de acceso de Meta
                </span>
                <span className="text-xs text-gray-500">
                  Es el token de larga duración, sin fecha de expiración, de tu app.
                </span>
                <input
                  required
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="EAAG..."
                  className="input"
                />
              </label>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-md bg-amber-500 px-5 py-2 text-sm font-medium text-gray-950 hover:bg-amber-400 disabled:opacity-50"
                >
                  {busy ? 'Buscando cuentas…' : 'Buscar mis cuentas'}
                </button>
                <button
                  type="button"
                  onClick={reset}
                  className="text-sm text-gray-500 hover:text-gray-300"
                >
                  Cancelar
                </button>
              </div>
            </form>
          ) : (
            <div className="flex flex-col gap-3">
              <span className="text-sm font-medium text-gray-200">2. Elige la cuenta</span>

              {accounts.length > 0 && (
                <div className="flex flex-col gap-2">
                  {accounts.map((account) => (
                    <button
                      key={account.id}
                      onClick={() => connect(account.id)}
                      disabled={busy}
                      className="rounded-md border border-gray-700 px-4 py-3 text-left text-sm text-gray-200 hover:border-amber-500 hover:text-amber-400 disabled:opacity-50"
                    >
                      {accountLabel(channel, account)}
                    </button>
                  ))}
                </div>
              )}

              <div className="mt-2 flex gap-2">
                <input
                  value={manualId}
                  onChange={(e) => setManualId(e.target.value)}
                  placeholder={
                    channel === 'whatsapp' ? 'O pega el Phone number ID' : 'O pega el ID de la cuenta'
                  }
                  className="input flex-1"
                />
                <button
                  onClick={() => manualId && connect(manualId)}
                  disabled={busy || !manualId}
                  className="shrink-0 rounded-md border border-gray-700 px-4 py-2 text-sm text-gray-200 hover:border-amber-500 disabled:opacity-50"
                >
                  {busy ? 'Validando…' : 'Conectar'}
                </button>
              </div>

              <button
                type="button"
                onClick={reset}
                className="self-start text-sm text-gray-500 hover:text-gray-300"
              >
                Cancelar
              </button>
            </div>
          )}

          {error && <p className="mt-3 text-sm text-danger">{error}</p>}
        </div>
      )}
    </section>
  )
}
