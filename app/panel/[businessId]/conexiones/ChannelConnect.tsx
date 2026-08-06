'use client'

import { useState } from 'react'

interface DiscoveredAccount {
  id: string
  displayPhoneNumber?: string
  verifiedName?: string
  username?: string
  pageName?: string
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
      setError(`${data.error ?? 'No se pudieron leer las cuentas'}. Podés cargar el ID a mano.`)
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
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-gray-200">
                  1. Pegá tu token de acceso de Meta
                </span>
                <span className="text-xs text-gray-500">
                  Es el token de larga duración de tu app.{' '}
                  <a
                    href={helpUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-amber-400 hover:underline"
                  >
                    Dónde encontrarlo
                  </a>
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
              <span className="text-sm font-medium text-gray-200">2. Elegí la cuenta</span>

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
                    channel === 'whatsapp' ? 'O pegá el Phone number ID' : 'O pegá el ID de la cuenta'
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
