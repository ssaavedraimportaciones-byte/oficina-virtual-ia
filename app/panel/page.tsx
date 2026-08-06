import Link from 'next/link'
import { listBusinesses } from '@/lib/store'
import { getIndustryTemplate } from '@/lib/industries'

export const dynamic = 'force-dynamic'

export default async function PanelPage() {
  const businesses = await listBusinesses()

  return (
    <div className="mx-auto max-w-3xl px-8 py-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Tus negocios</h1>
          <p className="mt-1 text-sm text-gray-400">
            Cada negocio tiene su propio agente, su base de conocimiento y sus conversaciones.
          </p>
        </div>
        <Link
          href="/panel/nuevo"
          className="shrink-0 rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-gray-950 hover:bg-amber-400"
        >
          + Nuevo negocio
        </Link>
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
          {businesses.map((business) => {
            const template = getIndustryTemplate(business.templateId)
            return (
              <Link
                key={business.id}
                href={`/panel/${business.id}`}
                className="rounded-lg border border-gray-800 p-5 hover:border-amber-500/50"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xl">{template?.emoji ?? '✨'}</span>
                  <h2 className="font-medium text-white">{business.config.businessName}</h2>
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
