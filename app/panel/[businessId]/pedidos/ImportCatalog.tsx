'use client'

import { useState } from 'react'

type Source = 'woocommerce' | 'jumpseller'

const FIELDS: Record<Source, { key: string; label: string; placeholder: string; password?: boolean }[]> = {
  woocommerce: [
    { key: 'storeUrl', label: 'Dirección de la tienda', placeholder: 'https://mitienda.cl' },
    { key: 'consumerKey', label: 'Consumer Key', placeholder: 'ck_…' },
    { key: 'consumerSecret', label: 'Consumer Secret', placeholder: 'cs_…', password: true },
  ],
  jumpseller: [
    { key: 'login', label: 'Email de la cuenta', placeholder: 'tu@correo.cl' },
    { key: 'authToken', label: 'API token', placeholder: 'tu token', password: true },
  ],
}

const HELP: Record<Source, string> = {
  woocommerce: 'En tu tienda: WooCommerce → Ajustes → Avanzado → API REST → «Añadir clave», con permiso de solo lectura.',
  jumpseller: 'En Jumpseller: Cuenta → API. Copia tu email y el authtoken.',
}

export default function ImportCatalog({ businessId, onImported }: { businessId: string; onImported: () => void }) {
  const [open, setOpen] = useState(false)
  const [source, setSource] = useState<Source>('woocommerce')
  const [creds, setCreds] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  function pick(next: Source) {
    setSource(next)
    setCreds({})
    setError(null)
    setDone(null)
  }

  async function run(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setDone(null)
    try {
      const res = await fetch(`/api/businesses/${businessId}/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source, credentials: creds }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'No se pudo importar.')
      } else {
        const s = data.summary
        setDone(`Listo: ${s.created} nuevo${s.created === 1 ? '' : 's'} y ${s.updated} actualizado${s.updated === 1 ? '' : 's'}.`)
        setCreds({})
        onImported()
      }
    } catch {
      setError('No se pudo conectar. Revisa los datos e inténtalo de nuevo.')
    }
    setBusy(false)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-4 text-sm text-amber-400 hover:underline"
      >
        Importar catálogo desde tu tienda →
      </button>
    )
  }

  return (
    <div className="mt-4 rounded-md border border-gray-800 bg-gray-900/40 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-200">Importar desde tu tienda</h3>
        <button onClick={() => setOpen(false)} className="text-xs text-gray-500 hover:text-gray-300">
          Cerrar
        </button>
      </div>
      <p className="mt-1 text-xs text-gray-500">
        Trae tus productos y precios. Actualiza los que ya tengas (por nombre) y agrega los nuevos, sin
        borrar lo que cargaste a mano. Las credenciales se usan solo para esto; no se guardan.
      </p>

      <div className="mt-3 flex gap-2">
        {(['woocommerce', 'jumpseller'] as Source[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => pick(s)}
            className={`rounded-md border px-3 py-1.5 text-xs ${
              source === s ? 'border-amber-500 text-amber-400' : 'border-gray-700 text-gray-400 hover:border-gray-600'
            }`}
          >
            {s === 'woocommerce' ? 'WooCommerce' : 'Jumpseller'}
          </button>
        ))}
      </div>

      <form onSubmit={run} className="mt-3 flex flex-col gap-3">
        {FIELDS[source].map((f) => (
          <label key={f.key} className="flex flex-col gap-1">
            <span className="text-xs text-gray-400">{f.label}</span>
            <input
              required
              type={f.password ? 'password' : 'text'}
              value={creds[f.key] ?? ''}
              onChange={(e) => setCreds((c) => ({ ...c, [f.key]: e.target.value }))}
              placeholder={f.placeholder}
              className="input"
            />
          </label>
        ))}
        <p className="text-xs text-gray-600">{HELP[source]}</p>
        <div>
          <button
            type="submit"
            disabled={busy}
            className="rounded-md bg-amber-500 px-5 py-2 text-sm font-medium text-gray-950 hover:bg-amber-400 disabled:opacity-50"
          >
            {busy ? 'Importando…' : 'Importar catálogo'}
          </button>
        </div>
      </form>

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      {done && <p className="mt-3 text-sm text-success">{done}</p>}
    </div>
  )
}
