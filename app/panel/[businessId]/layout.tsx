import Link from 'next/link'
import { BrandLockup } from '@/app/BrandMark'
import { notFound, redirect } from 'next/navigation'
import { canAccessBusiness, getCurrentUser, isPlatformAdmin } from '@/lib/auth'
import { getBusiness } from '@/lib/store'
import { getIndustryTemplate } from '@/lib/industries'
import { prisma } from '@/lib/db'

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

  const hasTables =
    business.templateId === 'gastronomia' || (await prisma.floor.count({ where: { businessId } })) > 0

  const navItems = [
    { href: `/panel/${businessId}/resumen`, label: 'Resumen' },
    { href: `/panel/${businessId}`, label: 'Conversaciones' },
    { href: `/panel/${businessId}/agenda`, label: 'Agenda y horas' },
    { href: `/panel/${businessId}/pedidos`, label: 'Catálogo y pedidos' },
    ...(hasTables ? [{ href: `/panel/${businessId}/mesas`, label: 'Mesas y reservas' }] : []),
    { href: `/panel/${businessId}/configurar`, label: 'Configurar agente' },
    { href: `/panel/${businessId}/conocimiento`, label: 'Base de conocimiento' },
    { href: `/panel/${businessId}/conexiones`, label: 'Conexiones' },
  ]

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 shrink-0 border-r border-gray-800 bg-gray-900/40 p-6">
        <Link href="/">
          <BrandLockup />
        </Link>

        <Link
          href="/panel"
          className="mt-8 block text-xs text-gray-500 hover:text-gray-300"
        >
          ← Todos los negocios
        </Link>
        <div className="mt-2 flex items-center gap-2">
          {business.logoVersion ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/imagenes/negocio/${businessId}?v=${business.logoVersion}`}
              alt=""
              className="h-6 w-6 shrink-0 rounded-full object-cover"
            />
          ) : (
            <span>{template?.emoji ?? '✨'}</span>
          )}
          <span className="truncate text-base font-medium text-white">
            {business.config.businessName}
          </span>
        </div>

        {isPlatformAdmin(user) && (
          <Link
            href="/admin"
            className="mt-4 block rounded-md border border-amber-500/60 bg-amber-500/10 px-3 py-2 text-base font-medium text-amber-300 hover:bg-amber-500/20"
          >
            Panel del dueño
          </Link>
        )}

        <nav className="mt-6 flex flex-col gap-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2.5 text-base text-gray-200 hover:bg-gray-800 hover:text-white"
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
