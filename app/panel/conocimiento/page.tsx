'use client'

import { useEffect, useState } from 'react'
import type { KnowledgeEntry } from '@/lib/types'

export default function ConocimientoPage() {
  const [entries, setEntries] = useState<KnowledgeEntry[]>([])
  const [loading, setLoading] = useState(true)

  const [url, setUrl] = useState('')
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)

  const [refreshingId, setRefreshingId] = useState<string | null>(null)

  async function load() {
    const res = await fetch('/api/knowledge')
    const data = await res.json()
    setEntries(data.knowledge ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function handleImport(e: React.FormEvent) {
    e.preventDefault()
    setImporting(true)
    setImportError(null)

    const res = await fetch('/api/knowledge/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    })
    const data = await res.json()

    setImporting(false)
    if (!res.ok) {
      setImportError(data.error ?? 'No se pudo importar la página')
      return
    }
    setUrl('')
    await load()
  }

  async function handleRefresh(entry: KnowledgeEntry) {
    if (!entry.sourceUrl) return
    setRefreshingId(entry.id)
    await fetch('/api/knowledge/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: entry.sourceUrl, entryId: entry.id }),
    })
    setRefreshingId(null)
    await load()
  }

  async function handleAddManual(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    await fetch('/api/knowledge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, content }),
    })

    setSaving(false)
    setTitle('')
    setContent('')
    await load()
  }

  async function handleDelete(id: string) {
    await fetch(`/api/knowledge/${id}`, { method: 'DELETE' })
    await load()
  }

  return (
    <div className="mx-auto max-w-2xl px-8 py-12">
      <h1 className="text-2xl font-bold text-white">Base de conocimiento</h1>
      <p className="mt-2 text-sm text-gray-400">
        Todo lo que cargues acá (precios, catálogo, preguntas frecuentes, tu sitio web) el agente
        lo va a usar para responder con datos reales en vez de inventar.
      </p>

      <section className="mt-8 rounded-lg border border-gray-800 p-6">
        <h2 className="font-medium text-white">Importar desde tu sitio web</h2>
        <p className="mt-1 text-xs text-gray-500">
          Pegá la URL de tu landing, la página de precios, o cualquier página pública.
        </p>
        <form onSubmit={handleImport} className="mt-4 flex gap-3">
          <input
            required
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://tuempresa.com/precios"
            className="input flex-1"
          />
          <button
            type="submit"
            disabled={importing}
            className="shrink-0 rounded-md bg-amber-500 px-5 py-2 text-sm font-medium text-gray-950 hover:bg-amber-400 disabled:opacity-50"
          >
            {importing ? 'Importando…' : 'Importar'}
          </button>
        </form>
        {importError && <p className="mt-2 text-sm text-danger">{importError}</p>}
      </section>

      <section className="mt-6 rounded-lg border border-gray-800 p-6">
        <h2 className="font-medium text-white">Agregar información manualmente</h2>
        <p className="mt-1 text-xs text-gray-500">
          Por ejemplo tu lista de precios, horarios de atención o preguntas frecuentes.
        </p>
        <form onSubmit={handleAddManual} className="mt-4 flex flex-col gap-3">
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título, ej: Lista de precios"
            className="input"
          />
          <textarea
            required
            rows={5}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={'Corte de pelo: $8000\nCorte + barba: $12000\nColoración: desde $15000'}
            className="input"
          />
          <button
            type="submit"
            disabled={saving}
            className="self-start rounded-md border border-gray-700 px-5 py-2 text-sm text-gray-200 hover:border-amber-500 hover:text-amber-400 disabled:opacity-50"
          >
            {saving ? 'Guardando…' : 'Agregar'}
          </button>
        </form>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 font-medium text-white">Cargado ({entries.length})</h2>
        {loading ? (
          <p className="text-sm text-gray-500">Cargando…</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-gray-500">Todavía no cargaste información.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {entries.map((entry) => (
              <div key={entry.id} className="rounded-lg border border-gray-800 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="font-medium text-white">{entry.title}</h3>
                    {entry.sourceUrl && (
                      <a
                        href={entry.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-amber-400 hover:underline"
                      >
                        {entry.sourceUrl}
                      </a>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {entry.sourceUrl && (
                      <button
                        onClick={() => handleRefresh(entry)}
                        disabled={refreshingId === entry.id}
                        className="text-xs text-gray-400 hover:text-amber-400 disabled:opacity-50"
                      >
                        {refreshingId === entry.id ? 'Actualizando…' : 'Actualizar'}
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(entry.id)}
                      className="text-xs text-gray-400 hover:text-danger"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
                <p className="mt-2 line-clamp-3 whitespace-pre-line text-sm text-gray-500">
                  {entry.content}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
