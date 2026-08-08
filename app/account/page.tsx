import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentUser, getUserProfile } from '@/lib/auth'
import LogoutButton from '../LogoutButton'
import AccountPanel from './AccountPanel'

export const dynamic = 'force-dynamic'

export default async function AccountPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const profile = await getUserProfile(user.id)
  if (!profile) redirect('/login')

  return (
    <div className="mx-auto max-w-lg px-8 py-12">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/panel" className="text-sm text-gray-500 hover:text-amber-400">
            ← Volver al panel
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-white">Mi cuenta</h1>
        </div>
        <LogoutButton className="text-sm text-gray-500 hover:text-gray-300" />
      </div>

      <AccountPanel profile={profile} />
    </div>
  )
}
