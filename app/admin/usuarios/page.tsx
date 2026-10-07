import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentUser, isPlatformAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'
import LogoutButton from '../../LogoutButton'
import AdminNav from '../AdminNav'
import UsersActivityTable from './UsersActivityTable'

export const dynamic = 'force-dynamic'

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-gray-800 p-5">
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="mt-1 text-xs uppercase tracking-wide text-gray-500">{label}</div>
    </div>
  )
}

function formatDate(date: Date | null) {
  if (!date) return '—'
  return new Date(date).toLocaleString('es-AR', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

export default async function UsuariosPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (!isPlatformAdmin(user)) redirect('/panel')

  // Estadísticas de usuarios
  const totalUsers = await prisma.user.count()
  const usersThisMonth = await prisma.user.count({
    where: {
      createdAt: {
        gte: new Date(new Date().setDate(1)),
      },
    },
  })

  // Sesiones activas
  const activeSessions = await prisma.session.count({
    where: {
      expiresAt: {
        gt: new Date(),
      },
    },
  })

  // Usuarios con actividad en últimos 7 días
  const activeUsersWeek = await prisma.session.findMany({
    where: {
      createdAt: {
        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      },
      expiresAt: {
        gt: new Date(),
      },
    },
    distinct: ['userId'],
    select: { userId: true },
  })

  // Usuarios recientes
  const recentUsers = await prisma.user.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' },
    include: {
      sessions: {
        take: 1,
        orderBy: { createdAt: 'desc' },
      },
      memberships: {
        include: {
          business: true,
        },
      },
    },
  })

  // Sesiones activas recientes
  const recentSessions = await prisma.session.findMany({
    take: 15,
    orderBy: { createdAt: 'desc' },
    where: {
      expiresAt: {
        gt: new Date(),
      },
    },
    include: {
      user: true,
    },
  })

  return (
    <div className="mx-auto max-w-5xl px-8 py-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Usuarios y Actividad</h1>
          <p className="mt-1 text-sm text-gray-400">
            Gestión de usuarios, sesiones activas y actividad del sistema.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/admin" className="text-sm text-gray-400 hover:text-amber-400">
            Admin →
          </Link>
          <LogoutButton className="text-sm text-gray-500 hover:text-gray-300" />
        </div>
      </div>

      <AdminNav active="/admin/usuarios" />

      <div className="mt-8 grid gap-4 sm:grid-cols-4">
        <Stat label="Usuarios totales" value={totalUsers} />
        <Stat label="Este mes" value={usersThisMonth} />
        <Stat label="Sesiones activas" value={activeSessions} />
        <Stat label="Activos (7 días)" value={activeUsersWeek.length} />
      </div>

      {/* Usuarios recientes */}
      <section className="mt-8">
        <h2 className="mb-4 font-medium text-white">Usuarios recientes</h2>
        {recentUsers.length === 0 ? (
          <p className="text-sm text-gray-500">No hay usuarios registrados.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-800">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-800 bg-gray-900/50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Rol</th>
                  <th className="px-4 py-3 font-medium">Registrado</th>
                  <th className="px-4 py-3 font-medium">Último login</th>
                  <th className="px-4 py-3 font-medium">Negocios</th>
                  <th className="px-4 py-3 font-medium">Verificado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {recentUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-900/50">
                    <td className="px-4 py-3">
                      <span className="font-medium text-white">{u.email}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs rounded-full border border-gray-700 px-2 py-1 text-gray-400">
                        {u.role === 'PLATFORM_ADMIN' ? 'Admin' : 'Usuario'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {formatDate(u.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {u.sessions.length > 0 ? formatDate(u.sessions[0].createdAt) : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {u.memberships.length}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs rounded-full border px-2 py-1 ${
                          u.emailVerifiedAt
                            ? 'border-emerald-800 text-emerald-500'
                            : 'border-gray-700 text-gray-500'
                        }`}
                      >
                        {u.emailVerifiedAt ? '✓' : '✗'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Sesiones activas */}
      <section className="mt-8">
        <h2 className="mb-4 font-medium text-white">Sesiones activas (últimas 15)</h2>
        {recentSessions.length === 0 ? (
          <p className="text-sm text-gray-500">No hay sesiones activas.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-800">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-800 bg-gray-900/50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Inicio</th>
                  <th className="px-4 py-3 font-medium">Expira</th>
                  <th className="px-4 py-3 font-medium">IP</th>
                  <th className="px-4 py-3 font-medium">User Agent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {recentSessions.map((s) => (
                  <tr key={s.tokenHash} className="hover:bg-gray-900/50">
                    <td className="px-4 py-3">
                      <span className="font-medium text-white">{s.user.email}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {formatDate(s.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {formatDate(s.expiresAt)}
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-gray-500">
                      {s.ipAddress || '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 max-w-xs truncate">
                      {s.userAgent ? s.userAgent.substring(0, 50) + '...' : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Tabla de actividad mejorada */}
      <section className="mt-8">
        <h2 className="mb-4 font-medium text-white">Actividad y gestión</h2>
        <UsersActivityTable />
      </section>
    </div>
  )
}
