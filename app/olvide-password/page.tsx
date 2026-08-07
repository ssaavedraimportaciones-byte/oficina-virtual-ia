import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import ForgotPasswordForm from './ForgotPasswordForm'

export const dynamic = 'force-dynamic'

export default async function OlvidePasswordPage() {
  const user = await getCurrentUser()
  if (user) redirect('/panel')

  return (
    <div className="flex min-h-screen items-center justify-center px-8">
      <ForgotPasswordForm />
    </div>
  )
}
