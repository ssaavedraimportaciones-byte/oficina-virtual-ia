'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function MaintenanceCard({ initialEnabled, initialMessage }: { initialEnabled: boolean; initialMessage: string }) {
  const router = useRouter()
  const [enabled, setEnabled] = useState(initialEnabled)
  const [message, setMessage] = useState(initialMessage)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  async function save(nextEnabled: boolean) {
    setBusy(true)
    setError(null)
    setSaved(false)
    const res = await fetch('/api/admin/platform', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: nextEnabled, message }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) {
      setError(data.error ?? 'No se pudo guardar')
      return
    }
    setEnabled(data.maintenance.enabled)
    setSaved(true)
    router.refresh()
  }

  async function toggle() {
    const question = enabled
      ? '¿Volver a encender los agentes en todas las empresas?'
      : 'Esto apaga a los agentes en TODAS las empresas. Los clientes finales recibirán el mensaje de abajo. ¿Continuar?'
    if (!window.confirm(question)) return
    await save(!enabled)
  }

  return (
    <section className={`rounded-lg border p-6 ${enabled ? 'border-red-900/70 bg-red-950/20' : 'border-gray-800'}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-medium text-white">Modo mantenimiento</h2>
          <p className="mt-1 text-sm text-gray-400">
            El interruptor de emergencia: apaga a los agentes en todas las empresas (por ejemplo, para reparar algo o si
            se acaba el saldo de la IA). Los mensajes de los clientes se guardan y ellos reciben el aviso de abajo en vez
            de quedar en visto.
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full border px-3 py-1 text-xs uppercase ${
            enabled ? 'border-red-800 text-red-400' : 'border-emerald-800 text-emerald-500'
          }`}
        >
          {enabled ? 'Agentes apagados' : 'Funcionando'}
        </span>
      </div>

      <label className="mt-4 block text-xs text-gray-500">
        Mensaje para los clientes finales (también se usa cuando la IA falla)
        <textarea
          rows={3}
          maxLength={500}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="input mt-1"
        />
      </label>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      {saved && <p className="mt-2 text-sm text-emerald-500">Guardado.</p>}
      <div className="mt-4 flex gap-3">
        <button
          onClick={toggle}
          disabled={busy}
          className={`rounded-md px-5 py-2 text-sm font-medium disabled:opacity-50 ${
            enabled ? 'bg-emerald-600 text-white hover:bg-emerald-500' : 'bg-red-600 text-white hover:bg-red-500'
          }`}
        >
          {enabled ? 'Encender los agentes' : 'Activar mantenimiento'}
        </button>
        <button
          onClick={() => save(enabled)}
          disabled={busy}
          className="rounded-md border border-gray-700 px-5 py-2 text-sm text-gray-200 hover:border-amber-500 hover:text-amber-400 disabled:opacity-50"
        >
          Guardar mensaje
        </button>
      </div>
    </section>
  )
}
