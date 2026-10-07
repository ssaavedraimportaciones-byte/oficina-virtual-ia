'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface UserActivity {
  id: string
  email: string
  role: string
  registeredDays: number
  lastActivityDays: number
  sessionCount: number
  businessCount: number
  status: 'active' | 'inactive'
}

export default function UsersActivityTable() {
  const router = useRouter()
  const [users, setUsers] = useState<UserActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all')

  useEffect(() => {
    async function fetchUsers() {
      try {
        const res = await fetch('/api/admin/users-activity')
        const data = await res.json()
        setUsers(data.users || [])
      } catch (err) {
        console.error('Error fetching users activity:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchUsers()
  }, [])

  const filtered = users.filter((u) => (filter === 'all' ? true : u.status === filter))

  function getStatusBadge(status: string, lastActivityDays: number) {
    if (status === 'active' && lastActivityDays <= 7) {
      return <span className="text-xs rounded-full border border-emerald-800 bg-emerald-900/20 px-2 py-1 text-emerald-400">Activo</span>
    }
    if (status === 'active' && lastActivityDays <= 30) {
      return <span className="text-xs rounded-full border border-amber-800 bg-amber-900/20 px-2 py-1 text-amber-400">Inactivo 7d+</span>
    }
    return <span className="text-xs rounded-full border border-gray-700 px-2 py-1 text-gray-500">Inactivo 30d+</span>
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        {['all', 'active', 'inactive'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f as typeof filter)}
            className={`px-3 py-1 text-xs rounded-md transition ${
              filter === f
                ? 'bg-amber-500 text-gray-950 font-medium'
                : 'border border-gray-700 text-gray-400 hover:text-gray-300'
            }`}
          >
            {f === 'all' ? 'Todos' : f === 'active' ? 'Activos' : 'Inactivos'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-400">Cargando...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No hay usuarios {filter !== 'all' ? `${filter}` : ''}</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-800">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-800 bg-gray-900/50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Registrado hace</th>
                <th className="px-4 py-3 font-medium">Última actividad</th>
                <th className="px-4 py-3 font-medium">Sesiones</th>
                <th className="px-4 py-3 font-medium">Negocios</th>
                <th className="px-4 py-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filtered.map((u) => (
                <tr key={u.id} className="hover:bg-gray-900/50">
                  <td className="px-4 py-3">
                    <span className="font-medium text-white">{u.email}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {u.registeredDays === 0 ? 'Hoy' : `${u.registeredDays}d atrás`}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {u.lastActivityDays === 0 ? 'Ahora' : `${u.lastActivityDays}d atrás`}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-300">
                    {u.sessionCount}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-300">
                    {u.businessCount}
                  </td>
                  <td className="px-4 py-3">
                    {getStatusBadge(u.status, u.lastActivityDays)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
