import Link from 'next/link'
import { redirect } from 'next/navigation'
import { listApiAccess, listApiKeys, ROTATION_GRACE_HOURS } from '@/lib/apiKeys'
import { getCurrentUser, isPlatformAdmin } from '@/lib/auth'
import LogoutButton from '../../LogoutButton'
import AdminNav from '../AdminNav'
import ApiKeysManager from './ApiKeysManager'

export const dynamic = 'force-dynamic'

export default async function ApiPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (!isPlatformAdmin(user)) redirect('/panel')

  const [keys, access] = await Promise.all([listApiKeys(), listApiAccess(30)])

  return (
    <div className="mx-auto max-w-5xl px-8 py-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">API de solo lectura</h1>
          <p className="mt-1 text-sm text-gray-400">
            Claves para que un sistema externo (Houston Ops) monitoree ZeroVisto. Solo puede leer: no escribe, no borra ni cambia planes.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/panel" className="text-sm text-gray-400 hover:text-amber-400">
            Ir al panel →
          </Link>
          <LogoutButton className="text-sm text-gray-500 hover:text-gray-300" />
        </div>
      </div>

      <AdminNav active="/admin/api" />

      <section className="mt-8 rounded-lg border border-gray-800 p-5 text-sm text-gray-300">
        <p>
          <span className="text-gray-500">Documentación (OpenAPI 3.1):</span>{' '}
          <a href="/api/v1/openapi.json" target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:underline">
            https://zerovistochile.com/api/v1/openapi.json
          </a>
        </p>
        <p className="mt-1">
          <span className="text-gray-500">Uso:</span> <code className="text-gray-200">Authorization: Bearer &lt;clave&gt;</code> · 60 pedidos por minuto por clave.
        </p>
      </section>

      <ApiKeysManager initialKeys={keys} graceHours={ROTATION_GRACE_HOURS} />

      <section className="mt-8">
        <h2 className="mb-3 font-medium text-white">Últimos accesos</h2>
        {access.length === 0 ? (
          <p className="text-sm text-gray-500">Todavía nadie ha llamado a la API.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-800">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-800 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Cuándo</th>
                  <th className="px-4 py-3 font-medium">Clave</th>
                  <th className="px-4 py-3 font-medium">Pedido</th>
                  <th className="px-4 py-3 font-medium">Resultado</th>
                  <th className="px-4 py-3 font-medium">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {access.map((a, i) => (
                  <tr key={`${a.at}-${i}`}>
                    <td className="whitespace-nowrap px-4 py-2 text-gray-400">{new Date(a.at).toLocaleString('es-CL', { timeZone: 'America/Santiago' })}</td>
                    <td className="px-4 py-2 font-mono text-xs text-gray-300">{a.keyPrefix ?? '—'}</td>
                    <td className="px-4 py-2 font-mono text-xs text-gray-300">
                      {a.method} {a.path}
                    </td>
                    <td className={`px-4 py-2 ${a.status >= 400 ? 'text-amber-400' : 'text-emerald-400'}`}>{a.status}</td>
                    <td className="px-4 py-2 text-xs text-gray-500">{a.ip ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
