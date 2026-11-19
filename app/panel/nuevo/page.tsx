import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import NuevoWizard from './NuevoWizard'

export const dynamic = 'force-dynamic'

export default async function NuevoNegocioPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  // Quien aún no tiene ningún negocio llega acá de primera (no hay a dónde volver).
  return <NuevoWizard firstTime={user.businesses.length === 0} />
}
