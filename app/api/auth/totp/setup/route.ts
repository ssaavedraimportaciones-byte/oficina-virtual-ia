import { NextResponse } from 'next/server'
import { startTotpEnrollment } from '@/lib/auth'
import { requireUser } from '@/lib/authz'

export async function POST() {
  const user = await requireUser()
  if (user instanceof NextResponse) return user

  const enrollment = await startTotpEnrollment(user.id, user.email)
  return NextResponse.json(enrollment)
}
