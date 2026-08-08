import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentUser, isPlatformAdmin } from '@/lib/auth'
import { countOpenConversations, listBusinessesForUser } from '@/lib/store'
import { getIndustryTemplate } from '@/lib/industries'
import LogoutButton from '../LogoutButton'

export const dynamic = 'force-dynamic'

export default async function PanelPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const businesses = await listBusinessesForUser(user)
  const openCounts = await Promise.all(businesses.map((b) => countOpenConversations(b.id)))

  return (
    <div className="mx-auto max-w-3xl px-8 py-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-md">
          <h1 className="text-2xl font-bold text-white">Tus negocios</h1>
          <p className="mt-1 text-sm text-gray-400">
            Cada negocio tiene su propio agente, su base de conocimiento y sus conversaciones.
          </p>
          <p className="mt-1 text-xs text-gray-600">
            {user.email}
            {isPlatformAdmin(user) && ' · administrador'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {isPlatformAdmin(user) && (
            <Link href="/admin" className="text-sm text-gray-400 hover:text-amber-400">
              Administración
            </Link>
          )}
          <Link href="/account" className="text-sm text-gray-400 hover:text-amber-400">
            Mi cuenta
          </Link>
          <Link
            href="/panel/nuevo"
            className="rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-gray-950 hover:bg-amber-400"
          >
            + Nuevo negocio
          </Link>
          <LogoutButton className="text-sm text-gray-500 hover:text-gray-300" />
        </div>
      </div>

      {businesses.length === 0 ? (
        <div className="mt-16 rounded-lg border border-dashed border-gray-800 py-16 text-center">
          <p className="text-gray-400">Todavía no creaste ningún negocio.</p>
          <Link
            href="/panel/nuevo"
            className="mt-4 inline-block rounded-md bg-amber-500 px-6 py-3 font-medium text-gray-950 hover:bg-amber-400"
          >
            Crear el primero
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {businesses.map((business, i) => {
            const template = getIndustryTemplate(business.templateId)
            const openCount = openCounts[i]
            return (
              <Link
                key={business.id}
                href={`/panel/${business.id}`}
                className="rounded-lg border border-gray-800 p-5 hover:border-amber-500/50"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{template?.emoji ?? '✨'}</span>
                    <h2 className="font-medium text-white">{business.config.businessName}</h2>
                  </div>
                  {openCount > 0 && (
                    <span className="shrink-0 rounded-full bg-amber-500 px-2 py-0.5 text-xs font-medium text-gray-950">
                      {openCount}
                    </span>
                  )}
                </div>
                <p className="mt-1 truncate text-sm text-gray-500">{business.config.industry}</p>
                <p className="mt-3 text-xs text-gray-600">
                  Agente: <span className="text-amber-400">{business.config.agentName}</span>
                </p>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
