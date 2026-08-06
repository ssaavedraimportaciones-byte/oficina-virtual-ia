import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import LoginForm from './LoginForm'

export const dynamic = 'force-dynamic'

export default async function LoginPage() {
  const user = await getCurrentUser()
  if (user) redirect('/panel')

  return (
    <div className="flex min-h-screen items-center justify-center px-8">
      <LoginForm />
    </div>
  )
}
