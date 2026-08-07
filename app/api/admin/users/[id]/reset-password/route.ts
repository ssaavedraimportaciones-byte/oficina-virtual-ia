import { NextResponse } from 'next/server'
import { adminResetPassword } from '@/lib/auth'
import { requirePlatformAdmin } from '@/lib/authz'

/**
 * Respaldo manual para cuando no hay SMTP configurado (o para destrabar a
 * alguien ya mismo): genera una contraseña nueva y la devuelve UNA sola vez
 * para que el admin se la pase al dueño de la cuenta por otro canal.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requirePlatformAdmin()
  if (admin instanceof NextResponse) return admin

  const { id } = await params
  const temporaryPassword = await adminResetPassword(id)
  return NextResponse.json({ ok: true, temporaryPassword })
}
