import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { BRAND } from '@/lib/brand'
import { signupOpen } from '@/lib/signup'
import RegisterForm from './RegisterForm'

export const dynamic = 'force-dynamic'
export const metadata = { title: `Crea tu cuenta — ${BRAND.name}` }

export default async function RegistroPage() {
  const user = await getCurrentUser()
  if (user) redirect('/panel')

  if (!signupOpen()) {
    return (
      <div className="flex min-h-screen items-center justify-center px-8">
        <div className="flex w-full max-w-sm flex-col gap-4">
          <span className="font-mono text-lg font-semibold text-amber-400">{BRAND.name}</span>
          <h1 className="text-xl font-bold text-white">El registro abre pronto</h1>
          <p className="text-sm text-gray-400">
            Por ahora estamos sumando negocios de a poco. Si ya tienes una cuenta, puedes ingresar.
          </p>
          <Link href="/login" className="text-sm text-amber-400 hover:underline">
            Ingresar
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-8">
      <RegisterForm />
    </div>
  )
}
