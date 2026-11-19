'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

/**
 * Abre o cierra el registro público. Las dos formas de sumar un cliente
 * conviven: con esto encendido se registra solo, y en cualquier caso el
 * administrador puede crear su cuenta a mano desde Usuarios.
 */
export default function SignupCard({ initialOpen, forcedByEnv }: { initialOpen: boolean; forcedByEnv: boolean }) {
  const router = useRouter()
  const [open, setOpen] = useState(initialOpen)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function toggle() {
    const next = !open
    const question = next
      ? 'Con el registro abierto, cualquiera puede crear su cuenta desde zerovistochile.com y probar un agente. ¿Abrirlo?'
      : '¿Cerrar el registro? Desde ahora las cuentas las creas tú desde Usuarios. Quien ya tiene cuenta sigue entrando normal.'
    if (!window.confirm(question)) return
    setBusy(true)
    setError(null)
    const res = await fetch('/api/admin/signup', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ open: next }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) {
      setError(data.error ?? 'No se pudo guardar')
      return
    }
    setOpen(data.open)
    router.refresh()
  }

  return (
    <section className={`rounded-lg border p-6 ${open ? 'border-emerald-900/70 bg-emerald-950/15' : 'border-gray-800'}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-xl">
          <h2 className="font-medium text-white">Cómo entran los clientes nuevos</h2>
          <p className="mt-1 text-sm text-gray-400">
            {open
              ? 'Registro abierto: cualquiera puede crear su cuenta en zerovistochile.com/registro y armar su agente en 3 pasos.'
              : 'Registro cerrado: solo tú creas las cuentas. Quien entre a /registro ve un aviso de que abre pronto.'}
          </p>
          <p className="mt-2 text-sm text-gray-400">
            En los dos casos puedes crear una cuenta a mano desde{' '}
            <Link href="/admin/usuarios" className="text-amber-400 hover:underline">
              Usuarios
            </Link>
            : le pones su correo y una contraseña, y el cliente entra y arma su agente.
          </p>
          {forcedByEnv && (
            <p className="mt-2 text-xs text-amber-400">
              Ojo: la variable ALLOW_SIGNUP=true del servidor lo mantiene abierto aunque lo apagues acá. Quítala en Vercel para
              poder cerrarlo desde este interruptor.
            </p>
          )}
        </div>
        <button
          onClick={toggle}
          disabled={busy}
          className={`shrink-0 rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50 ${
            open ? 'border border-gray-700 text-gray-200 hover:border-gray-500' : 'bg-amber-500 text-gray-950 hover:bg-amber-400'
          }`}
        >
          {busy ? 'Guardando…' : open ? 'Cerrar el registro' : 'Abrir el registro'}
        </button>
      </div>
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
    </section>
  )
}
