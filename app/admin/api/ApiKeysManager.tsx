'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ApiKeyInfo } from '@/lib/apiKeys'

const STATE_LABEL: Record<ApiKeyInfo['state'], { text: string; style: string }> = {
  activa: { text: 'Activa', style: 'text-emerald-400 border-emerald-500/40' },
  por_vencer: { text: 'Por vencer', style: 'text-amber-300 border-amber-500/40' },
  revocada: { text: 'Revocada', style: 'text-gray-500 border-gray-700' },
}

/** Formato fijo (dd-mm-aaaa hh:mm, hora de Chile): `toLocaleString` varía entre servidor y navegador y rompe la hidratación. */
const FMT = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Santiago', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
const when = (iso: string | null) => {
  if (!iso) return '—'
  const p = Object.fromEntries(FMT.formatToParts(new Date(iso)).map((x) => [x.type, x.value]))
  return `${p.day}-${p.month}-${p.year} ${p.hour}:${p.minute}`
}

/** Crear, rotar y revocar claves. El texto de una clave nueva se muestra una sola vez. */
export default function ApiKeysManager({ initialKeys, graceHours }: { initialKeys: ApiKeyInfo[]; graceHours: number }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [secret, setSecret] = useState<{ value: string; title: string } | null>(null)
  const [copied, setCopied] = useState(false)

  async function call(url: string, init?: RequestInit) {
    const res = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json' } })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error ?? 'No se pudo completar.')
    return data
  }

  async function create() {
    setBusy('new')
    setError(null)
    try {
      const data = await call('/api/admin/api-keys', { method: 'POST', body: JSON.stringify({ name }) })
      setSecret({ value: data.secret, title: `Clave «${data.key.name}» creada` })
      setName('')
      setCopied(false)
      router.refresh()
    } catch (e) {
      setError((e as Error).message)
    }
    setBusy(null)
  }

  async function rotate(k: ApiKeyInfo) {
    if (!window.confirm(`Se crea una clave nueva y la actual (${k.prefix}…) sigue sirviendo ${graceHours} horas para que la cambies sin corte. ¿Rotar?`)) return
    setBusy(k.id)
    setError(null)
    try {
      const data = await call(`/api/admin/api-keys/${k.id}/rotate`, { method: 'POST' })
      setSecret({ value: data.secret, title: `Clave «${data.key.name}» rotada: la anterior vence en ${graceHours} horas` })
      setCopied(false)
      router.refresh()
    } catch (e) {
      setError((e as Error).message)
    }
    setBusy(null)
  }

  async function revoke(k: ApiKeyInfo) {
    if (!window.confirm(`Revocar ${k.prefix}… ahora mismo: el sistema que la use deja de poder leer. ¿Seguro?`)) return
    setBusy(k.id)
    setError(null)
    try {
      await call(`/api/admin/api-keys/${k.id}/revoke`, { method: 'POST' })
      router.refresh()
    } catch (e) {
      setError((e as Error).message)
    }
    setBusy(null)
  }

  return (
    <section className="mt-8">
      <h2 className="mb-3 font-medium text-white">Claves</h2>

      {secret && (
        <div className="mb-4 rounded-lg border border-amber-500/60 bg-amber-500/10 p-4">
          <p className="font-medium text-amber-300">{secret.title}</p>
          <p className="mt-1 text-sm text-gray-300">
            Cópiala ahora: <strong>no se vuelve a mostrar</strong>. Si la pierdes, rota la clave para tener otra.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input readOnly value={secret.value} onFocus={(e) => e.currentTarget.select()} className="input flex-1 font-mono text-sm" aria-label="Clave nueva" />
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(secret.value)
                  setCopied(true)
                } catch {
                  /* el usuario puede copiarla a mano */
                }
              }}
              className="rounded-md border border-amber-500/60 px-4 py-2 text-sm text-amber-300 hover:bg-amber-500/10"
            >
              {copied ? 'Copiada ✓' : 'Copiar'}
            </button>
            <button onClick={() => setSecret(null)} className="rounded-md border border-gray-700 px-4 py-2 text-sm text-gray-300">
              Ya la guardé
            </button>
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nombre de la clave, ej. Houston Ops"
          maxLength={80}
          className="input flex-1"
          aria-label="Nombre de la clave"
        />
        <button
          onClick={create}
          disabled={busy !== null || name.trim() === ''}
          className="rounded-md bg-amber-500 px-5 py-2 text-sm font-semibold text-gray-950 hover:bg-amber-400 disabled:opacity-50"
        >
          {busy === 'new' ? 'Creando…' : 'Generar clave'}
        </button>
      </div>
      {error && <p className="mb-3 text-sm text-danger">{error}</p>}

      {initialKeys.length === 0 ? (
        <p className="text-sm text-gray-500">Todavía no hay claves. Genera una para conectar Houston Ops.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-800">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-800 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="px-4 py-3 font-medium">Clave</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Creada</th>
                <th className="px-4 py-3 font-medium">Último uso</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {initialKeys.map((k) => (
                <tr key={k.id} className={k.state === 'revocada' ? 'opacity-50' : ''}>
                  <td className="px-4 py-3 text-white">{k.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-300">{k.prefix}…</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full border px-2 py-0.5 text-xs ${STATE_LABEL[k.state].style}`}>{STATE_LABEL[k.state].text}</span>
                    {k.state === 'por_vencer' && <div className="mt-1 text-xs text-gray-500">vence {when(k.revokedAt)}</div>}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">{when(k.createdAt)}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{when(k.lastUsedAt)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    {k.state !== 'revocada' && (
                      <>
                        {k.state === 'activa' && (
                          <button onClick={() => rotate(k)} disabled={busy !== null} className="mr-4 text-xs text-amber-400 hover:underline disabled:opacity-40">
                            Rotar
                          </button>
                        )}
                        <button onClick={() => revoke(k)} disabled={busy !== null} className="text-xs text-red-400 hover:underline disabled:opacity-40">
                          Revocar
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
