import { notFound, redirect } from 'next/navigation'
import { canAccessBusiness, getCurrentUser, isPlatformAdmin } from '@/lib/auth'
import { getBusiness, getSetupFacts } from '@/lib/store'
import { getIndustryTemplate } from '@/lib/industries'
import { getSetupProgress } from '@/lib/onboarding'
import { getSalesSettings } from '@/lib/payments'
import PanelNav, { type NavItem } from './PanelNav'

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

  // Mismo 404 tanto si el negocio no existe como si el usuario no tiene
  // acceso: no le confirma a nadie que un negocio ajeno existe.
  if (!canAccessBusiness(user, businessId)) notFound()
  // Todo en paralelo: este menú se arma en cada página del panel.
  const [business, facts, sales] = await Promise.all([
    getBusiness(businessId),
    getSetupFacts(businessId),
    getSalesSettings(businessId),
  ])
  if (!business) notFound()

  const template = getIndustryTemplate(business.templateId)
  const progress = facts ? getSetupProgress(businessId, facts) : null
  const stepDone = (id: string) => progress?.steps.find((s) => s.id === id)?.done

  const hasTables = business.templateId === 'gastronomia' || (facts?.floorCount ?? 0) > 0
  const base = `/panel/${businessId}`

  const daily: NavItem[] = [
    {
      href: `${base}/resumen`,
      label: 'Resumen',
      hint: 'Cómo va tu negocio, de un vistazo',
      icon: '📊',
    },
    {
      href: base,
      label: 'Conversaciones',
      hint: 'Lo que hablan tus clientes con el agente',
      icon: '💬',
    },
    {
      href: `${base}/agenda`,
      label: 'Agenda y horas',
      hint: 'Horas agendadas, servicios y horarios',
      icon: '📅',
    },
    {
      href: `${base}/pedidos`,
      label: 'Catálogo y pedidos',
      hint: 'Tus productos, precios y pedidos',
      icon: '🛍️',
    },
    ...(sales.kitchenEnabled
      ? [{ href: `${base}/cocina`, label: 'Cocina', hint: 'Pedidos por preparar y sus tickets', icon: '🧾' }]
      : []),
    ...(hasTables
      ? [
          {
            href: `${base}/mesas`,
            label: 'Mesas y reservas',
            hint: 'El plano de tu local y las reservas',
            icon: '🍽️',
          },
        ]
      : []),
  ]
  const agent: NavItem[] = [
    {
      href: `${base}/configurar`,
      label: 'Quién es y cómo habla',
      hint: 'Nombre, tono, tu negocio y su objetivo',
      icon: '🧑‍💼',
      done: stepDone('perfil'),
    },
    {
      href: `${base}/conocimiento`,
      label: 'Lo que sabe',
      hint: 'Precios, horarios, dirección y dudas',
      icon: '📚',
      done: stepDone('conocimiento'),
    },
    {
      href: `${base}/conexiones`,
      label: 'Dónde atiende',
      hint: 'Conectar WhatsApp e Instagram',
      icon: '🔌',
      done: stepDone('canal'),
    },
  ]

  const logo = business.logoVersion ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/api/imagenes/negocio/${businessId}?v=${business.logoVersion}`}
      alt=""
      className="h-7 w-7 shrink-0 rounded-full object-cover"
    />
  ) : (
    <span aria-hidden="true">{template?.emoji ?? '✨'}</span>
  )

  return (
    <div className="min-h-screen md:flex">
      <PanelNav
        businessName={business.config.businessName}
        logo={logo}
        adminLink={isPlatformAdmin(user)}
        canPickBusiness={isPlatformAdmin(user) || new Set(user.businesses.map((b) => b.businessId)).size > 1}
        setup={
          progress && !progress.ready
            ? {
                href: `${base}/primeros-pasos`,
                completed: progress.completed,
                required: progress.required,
              }
            : null
        }
        daily={daily}
        agent={agent}
      />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
