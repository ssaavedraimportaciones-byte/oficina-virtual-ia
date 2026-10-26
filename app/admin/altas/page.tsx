import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentUser, isPlatformAdmin } from '@/lib/auth'
import { INDUSTRY_TEMPLATES } from '@/lib/industries'
import { listIntakes } from '@/lib/intakeStore'
import { listBusinesses } from '@/lib/store'
import LogoutButton from '../../LogoutButton'
import AdminNav from '../AdminNav'
import IntakeForm from './IntakeForm'
import IntakeList from './IntakeList'

export const dynamic = 'force-dynamic'

export default async function AltasPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (!isPlatformAdmin(user)) redirect('/panel')

  const [intakes, businesses] = await Promise.all([listIntakes(), listBusinesses()])

  return (
    <div className="mx-auto max-w-5xl px-8 py-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Altas</h1>
          <p className="mt-1 text-sm text-gray-400">
            Qué pedirle a cada cliente nuevo y qué falta para que su WhatsApp responda.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/panel" className="text-sm text-gray-400 hover:text-amber-400">
            Ir al panel →
          </Link>
          <LogoutButton className="text-sm text-gray-500 hover:text-gray-300" />
        </div>
      </div>

      <AdminNav active="/admin/altas" />

      <section className="mt-8 rounded-lg border border-gray-800 bg-gray-900/40 p-6">
        <h2 className="font-medium text-white">Cómo se conecta un cliente</h2>
        <p className="mt-1 text-sm text-gray-400">
          Un dueño de local no puede conectar su WhatsApp solo: hace falta crear una app en Meta,
          un usuario del sistema y pasar la verificación del negocio. Hay tres caminos.
        </p>
        <ol className="mt-4 flex flex-col gap-3 text-sm text-gray-300">
          <li>
            <strong className="text-white">Tú lo conectas.</strong> El cliente crea su cuenta y
            carga su información; la parte de Meta la haces tú, con su cuenta o acompañándolo.
            Funciona hoy y justifica cobrar la instalación aparte.
          </li>
          <li>
            <strong className="text-white">Tú pones el número.</strong> Un chip nuevo conectado a
            tu propia cuenta de Meta. Queda andando en minutos, pero el número es tuyo: si el
            cliente se va, lo pierde.
          </li>
          <li>
            <strong className="text-white">Conexión en un clic.</strong> El cliente entra con su
            Facebook y elige su número. Requiere que Meta apruebe la cuenta como proveedor de
            tecnología y programar ese flujo en el panel. Es lo que hace falta para vender a
            muchos sin estar en cada uno.
          </li>
        </ol>
        <p className="mt-4 text-xs text-gray-500">
          En cualquiera de los tres, cada cliente necesita su propia verificación de negocio en
          Meta, que tarda días y no se puede apurar. Conviene avisarlo al vender.
        </p>
      </section>

      <div className="mt-8">
        <IntakeForm industries={INDUSTRY_TEMPLATES} />
      </div>

      <div className="mt-8">
        <IntakeList
          intakes={intakes}
          businesses={businesses.map((b) => ({ id: b.id, name: b.config.businessName }))}
        />
      </div>
    </div>
  )
}
