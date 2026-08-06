import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { canAccessBusiness, getCurrentUser } from '@/lib/auth'
import { getBusiness } from '@/lib/store'
import { getIndustryTemplate } from '@/lib/industries'

export const dynamic = 'force-dynamic'

export default async function BusinessLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ businessId: string }>
}) {
  const { businessId } = await params

  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const business = await getBusiness(businessId)
  // Mismo 404 tanto si el negocio no existe como si el usuario no tiene
  // acceso: no le confirma a nadie que un negocio ajeno existe.
  if (!business || !canAccessBusiness(user, businessId)) notFound()

  const template = getIndustryTemplate(business.templateId)

  const navItems = [
    { href: `/panel/${businessId}`, label: 'Conversaciones' },
    { href: `/panel/${businessId}/agenda`, label: 'Agenda y turnos' },
    { href: `/panel/${businessId}/pedidos`, label: 'Catálogo y pedidos' },
    { href: `/panel/${businessId}/configurar`, label: 'Configurar agente' },
    { href: `/panel/${businessId}/conocimiento`, label: 'Base de conocimiento' },
    { href: `/panel/${businessId}/conexiones`, label: 'Conexiones' },
  ]

  return (
    <div className="flex min-h-screen">
      <aside className="w-60 shrink-0 border-r border-gray-800 bg-gray-900/40 p-6">
        <Link href="/" className="font-mono text-lg font-semibold text-amber-400">
          AgentsApp
        </Link>

        <Link
          href="/panel"
          className="mt-8 block text-xs text-gray-500 hover:text-gray-300"
        >
          ← Todos los negocios
        </Link>
        <div className="mt-2 flex items-center gap-2">
          <span>{template?.emoji ?? '✨'}</span>
          <span className="truncate text-sm font-medium text-white">
            {business.config.businessName}
          </span>
        </div>

        <nav className="mt-8 flex flex-col gap-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
