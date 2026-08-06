import { getAccess } from '@/lib/adminAuth'
import LoginForm from '../admin/LoginForm'

export const dynamic = 'force-dynamic'

export default async function PanelRootLayout({ children }: { children: React.ReactNode }) {
  const access = await getAccess('panel')

  if (!access.configured) {
    return (
      <div className="flex min-h-screen items-center justify-center px-8">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-bold text-white">Panel bloqueado</h1>
          <p className="mt-3 text-sm text-gray-400">
            Falta definir <code className="text-amber-400">PANEL_PASSWORD</code> (o{' '}
            <code className="text-amber-400">ADMIN_PASSWORD</code>) en las variables de entorno.
            Sin eso el panel queda bloqueado a propósito, para no dejar los negocios abiertos a
            cualquiera con el link.
          </p>
        </div>
      </div>
    )
  }

  if (!access.authorized) {
    return (
      <div className="flex min-h-screen items-center justify-center px-8">
        <LoginForm scope="panel" title="Panel" />
      </div>
    )
  }

  return <>{children}</>
}
