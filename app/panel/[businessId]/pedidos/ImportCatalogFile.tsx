'use client'

import { useRef, useState } from 'react'
import { formatPrice } from '@/lib/catalog'

interface PreviewItem {
  name: string
  price: number
  stock: number | null
}

/**
 * Sube una foto de la carta, un PDF o un Excel/CSV y la IA la convierte en
 * productos con precio. Nunca se guarda directo: primero se muestra una
 * vista previa editable, porque una lectura automática de precios puede
 * equivocarse y acá se habla de plata real. El dueño revisa, corrige o saca
 * líneas, y recién ahí confirma.
 */
export default function ImportCatalogFile({ businessId, onImported }: { businessId: string; onImported: () => void }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [items, setItems] = useState<(PreviewItem & { include: boolean })[] | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  function reset() {
    setItems(null)
    setError(null)
    setDone(null)
  }

  async function handleFile(file: File) {
    setBusy(true)
    setError(null)
    setDone(null)
    setItems(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(`/api/businesses/${businessId}/import-file`, { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'No se pudo leer el archivo.')
      } else {
        setItems((data.items as PreviewItem[]).map((it) => ({ ...it, include: true })))
      }
    } catch {
      setError('No se pudo subir el archivo. Inténtalo de nuevo.')
    }
    setBusy(false)
  }

  function updateItem(i: number, patch: Partial<PreviewItem & { include: boolean }>) {
    setItems((prev) => prev && prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)))
  }

  async function confirm() {
    if (!items) return
    const chosen = items.filter((it) => it.include && it.name.trim() && it.price > 0)
    if (chosen.length === 0) {
      setError('No dejaste ningún producto seleccionado.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/businesses/${businessId}/import-file`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: chosen.map(({ name, price, stock }) => ({ name: name.trim(), price, stock })),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'No se pudo guardar.')
      } else {
        const s = data.summary
        setDone(`Listo: ${s.created} nuevo${s.created === 1 ? '' : 's'} y ${s.updated} actualizado${s.updated === 1 ? '' : 's'}.`)
        setItems(null)
        onImported()
      }
    } catch {
      setError('No se pudo guardar. Inténtalo de nuevo.')
    }
    setBusy(false)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-3 flex items-center gap-2 rounded-md border border-amber-500/50 bg-amber-500/5 px-4 py-2.5 text-sm font-medium text-amber-300 hover:bg-amber-500/10"
      >
        📷 Subir una foto, PDF o Excel de tu carta
      </button>
    )
  }

  return (
    <div className="mt-4 rounded-md border border-gray-800 bg-gray-900/40 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-200">Subir una foto, PDF o Excel de tu carta</h3>
        <button
          onClick={() => {
            setOpen(false)
            reset()
          }}
          className="text-xs text-gray-500 hover:text-gray-300"
        >
          Cerrar
        </button>
      </div>
      <p className="mt-1 text-xs text-gray-500">
        Sácale una foto a tu carta, o sube el PDF o Excel que ya tengas. La IA la lee y te muestra los
        productos y precios que encontró, para que revises antes de guardar — no se carga nada solo.
      </p>

      {items === null && (
        <div className="mt-3 flex flex-col gap-2">
          <input
            ref={fileInput}
            type="file"
            accept="image/*,.pdf,.xlsx,.xls,.csv"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleFile(file)
            }}
            className="text-sm text-gray-300 file:mr-3 file:rounded-md file:border file:border-gray-700 file:bg-transparent file:px-3 file:py-1.5 file:text-xs file:text-gray-200 hover:file:border-amber-500"
          />
          {busy && <p className="text-xs text-gray-500">Leyendo el archivo… puede tardar unos segundos.</p>}
        </div>
      )}

      {items !== null && items.length > 0 && (
        <div className="mt-4 flex flex-col gap-3">
          <p className="text-sm font-medium text-gray-200">
            Encontramos {items.length} producto{items.length === 1 ? '' : 's'}. Revisa, corrige lo que haga
            falta y saca lo que no quieras cargar.
          </p>
          <div className="flex max-h-96 flex-col gap-1.5 overflow-y-auto rounded-md border border-gray-800 p-2">
            {items.map((it, i) => (
              <div
                key={i}
                className={`flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 ${
                  it.include ? 'border-gray-700' : 'border-gray-800 opacity-40'
                }`}
              >
                <input
                  type="checkbox"
                  checked={it.include}
                  onChange={(e) => updateItem(i, { include: e.target.checked })}
                  className="h-4 w-4 shrink-0 accent-amber-500"
                />
                <input
                  value={it.name}
                  onChange={(e) => updateItem(i, { name: e.target.value })}
                  className="input min-w-[9rem] flex-1 py-1 text-sm"
                />
                <input
                  type="number"
                  min={0}
                  value={it.price}
                  onChange={(e) => updateItem(i, { price: Number(e.target.value) })}
                  className="input w-24 py-1 text-sm"
                />
                <input
                  type="number"
                  min={0}
                  value={it.stock ?? ''}
                  placeholder="stock ∞"
                  onChange={(e) => updateItem(i, { stock: e.target.value === '' ? null : Number(e.target.value) })}
                  className="input w-20 py-1 text-sm"
                />
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-600">
            Al guardar, actualiza por nombre lo que ya tengas cargado y agrega lo nuevo. No borra nada de tu
            catálogo actual.
          </p>
          <div className="flex gap-3">
            <button
              onClick={confirm}
              disabled={busy}
              className="rounded-md bg-amber-500 px-5 py-2 text-sm font-medium text-gray-950 hover:bg-amber-400 disabled:opacity-50"
            >
              {busy ? 'Guardando…' : `Guardar ${items.filter((i) => i.include).length} en mi catálogo`}
            </button>
            <button type="button" onClick={reset} className="text-sm text-gray-500 hover:text-gray-300">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      {done && <p className="mt-3 text-sm text-success">{done}</p>}
      {items === null && !busy && !error && (
        <p className="mt-2 text-xs text-gray-600">
          Ejemplo de lo que detecta: {formatPrice(1500)} “Completo mediano”, {formatPrice(2500)} “Completo
          grande”, etc. — cada tamaño o variante queda como un producto separado.
        </p>
      )}
    </div>
  )
}
