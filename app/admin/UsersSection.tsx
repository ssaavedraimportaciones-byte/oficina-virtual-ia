'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { UserSummary } from '@/lib/auth'

interface BusinessOption {
  id: string
  name: string
}

export default function UsersSection({
  initialUsers,
  businesses,
  currentUserId,
}: {
  initialUsers: UserSummary[]
  businesses: BusinessOption[]
  currentUserId: string
}) {
  const router = useRouter()
  const [users, setUsers] = useState(initialUsers)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'USER' | 'PLATFORM_ADMIN'>('USER')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [assigning, setAssigning] = useState<string | null>(null)
  const [businessToAssign, setBusinessToAssign] = useState<Record<string, string>>({})
  const [resetting, setResetting] = useState<string | null>(null)
  const [tempPassword, setTempPassword] = useState<{ email: string; password: string } | null>(null)

  function refresh() {
    router.refresh()
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, role }),
    })
    const data = await res.json()

    setSaving(false)
    if (!res.ok) {
      setError(typeof data.error === 'string' ? data.error : 'No se pudo crear el usuario')
      return
    }

    setEmail('')
    setPassword('')
    setRole('USER')
    refresh()
  }

  async function handleDelete(id: string) {
    if (!window.confirm('¿Eliminar este usuario? Pierde acceso a todos sus negocios.')) return
    await fetch(`/api/admin/users/${id}`, { method: 'DELETE' })
    setUsers((prev) => prev.filter((u) => u.id !== id))
  }

  async function handleAssign(userId: string) {
    const businessId = businessToAssign[userId]
    if (!businessId) return

    setAssigning(userId)
    await fetch(`/api/admin/users/${userId}/businesses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ businessId, role: 'OWNER' }),
    })
    setAssigning(null)
    refresh()
  }

  async function handleUnassign(userId: string, businessId: string) {
    await fetch(`/api/admin/users/${userId}/businesses/${businessId}`, { method: 'DELETE' })
    refresh()
  }

  async function handleResetPassword(u: UserSummary) {
    if (!window.confirm(`¿Generar una contraseña nueva para ${u.email}? Cierra todas sus sesiones activas.`)) return

    setResetting(u.id)
    const res = await fetch(`/api/admin/users/${u.id}/reset-password`, { method: 'POST' })
    const data = await res.json()
    setResetting(null)

    if (res.ok) {
      setTempPassword({ email: u.email, password: data.temporaryPassword })
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form
        onSubmit={handleCreate}
        className="flex flex-col gap-3 rounded-lg border border-gray-800 p-6 sm:flex-row sm:items-end"
      >
        <label className="flex flex-1 flex-col gap-1.5">
          <span className="text-sm text-gray-200">Email</span>
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
            placeholder="dueño@negocio.com"
          />
        </label>
        <label className="flex flex-1 flex-col gap-1.5">
          <span className="text-sm text-gray-200">Contraseña</span>
          <input
            required
            type="password"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input"
            placeholder="mínimo 8 caracteres"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-gray-200">Rol</span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as 'USER' | 'PLATFORM_ADMIN')}
            className="input"
          >
            <option value="USER">Usuario de negocio</option>
            <option value="PLATFORM_ADMIN">Admin de plataforma</option>
          </select>
        </label>
        <button
          type="submit"
          disabled={saving}
          className="shrink-0 rounded-md bg-amber-500 px-5 py-2 text-sm font-medium text-gray-950 hover:bg-amber-400 disabled:opacity-50"
        >
          {saving ? 'Creando…' : 'Crear usuario'}
        </button>
      </form>
      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex flex-col divide-y divide-gray-800 rounded-lg border border-gray-800">
        {users.map((u) => (
          <div key={u.id} className="flex flex-col gap-3 px-5 py-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <span className="text-sm font-medium text-white">{u.email}</span>
                <span className="ml-2 rounded-full border border-gray-700 px-2 py-0.5 text-[10px] uppercase text-gray-500">
                  {u.role === 'PLATFORM_ADMIN' ? 'Admin de plataforma' : 'Usuario'}
                </span>
                <span
                  className={`ml-2 rounded-full border px-2 py-0.5 text-[10px] uppercase ${
                    u.emailVerifiedAt
                      ? 'border-emerald-800 text-emerald-500'
                      : 'border-gray-700 text-gray-500'
                  }`}
                >
                  {u.emailVerifiedAt ? 'Email verificado' : 'Email sin verificar'}
                </span>
                {u.id === currentUserId && (
                  <span className="ml-2 text-xs text-gray-600">(vos)</span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleResetPassword(u)}
                  disabled={resetting === u.id}
                  className="text-xs text-gray-500 hover:text-amber-400 disabled:opacity-50"
                >
                  {resetting === u.id ? 'Generando…' : 'Restablecer contraseña'}
                </button>
                {u.id !== currentUserId && (
                  <button
                    onClick={() => handleDelete(u.id)}
                    className="text-xs text-gray-500 hover:text-danger"
                  >
                    Eliminar
                  </button>
                )}
              </div>
            </div>

            {u.role !== 'PLATFORM_ADMIN' && (
              <div className="flex flex-wrap items-center gap-2">
                {u.businesses.length === 0 ? (
                  <span className="text-xs text-gray-600">Sin negocios asignados.</span>
                ) : (
                  u.businesses.map((b) => (
                    <span
                      key={b.businessId}
                      className="flex items-center gap-1.5 rounded-full border border-gray-700 py-0.5 pl-3 pr-1 text-xs text-gray-300"
                    >
                      {b.businessName}
                      <button
                        onClick={() => handleUnassign(u.id, b.businessId)}
                        className="rounded-full px-1.5 text-gray-500 hover:text-danger"
                        title="Quitar acceso"
                      >
                        ×
                      </button>
                    </span>
                  ))
                )}

                <div className="flex items-center gap-1.5">
                  <select
                    value={businessToAssign[u.id] ?? ''}
                    onChange={(e) =>
                      setBusinessToAssign((prev) => ({ ...prev, [u.id]: e.target.value }))
                    }
                    className="input py-1 text-xs"
                  >
                    <option value="">+ asignar negocio…</option>
                    {businesses
                      .filter((b) => !u.businesses.some((ub) => ub.businessId === b.id))
                      .map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                  </select>
                  <button
                    onClick={() => handleAssign(u.id)}
                    disabled={!businessToAssign[u.id] || assigning === u.id}
                    className="text-xs text-amber-400 hover:underline disabled:opacity-50"
                  >
                    Asignar
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
        {users.length === 0 && (
          <p className="px-5 py-4 text-sm text-gray-500">Todavía no hay usuarios.</p>
        )}
      </div>

      {tempPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-lg border border-gray-800 bg-gray-950 p-6">
            <h3 className="text-sm font-medium text-white">Contraseña nueva para {tempPassword.email}</h3>
            <p className="mt-2 text-xs text-gray-500">
              Se muestra una sola vez. Pasásela por otro canal (llamada, WhatsApp) — no queda
              guardada en ningún lado en texto plano. Todas sus sesiones activas se cerraron.
            </p>
            <code className="mt-4 block select-all rounded-md border border-gray-800 bg-gray-900 px-3 py-2 text-sm text-amber-400">
              {tempPassword.password}
            </code>
            <button
              onClick={() => setTempPassword(null)}
              className="mt-4 w-full rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-gray-950 hover:bg-amber-400"
            >
              Ya la copié
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
