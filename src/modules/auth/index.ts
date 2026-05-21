import { prisma } from '@/lib/db/client'
import { hashPassword, verifyPassword, signAccessToken, signRefreshToken } from '@/lib/auth'
import type { TokenPayload, UserRole } from '@/types/user'

export async function loginUser(email: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, nombre: true, role: true, passwordHash: true, activo: true, faenaId: true },
  })
  if (!user || !user.activo) throw new Error('Credenciales incorrectas')

  const ok = await verifyPassword(password, user.passwordHash)
  if (!ok) throw new Error('Credenciales incorrectas')

  const payload: TokenPayload = { uid: user.id, email: user.email, role: user.role, faenaId: user.faenaId ?? '' }
  const access = await signAccessToken(payload)
  const refresh = await signRefreshToken(user.id)

  await prisma.refreshToken.create({
    data: { token: refresh, userId: user.id, expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
  })

  return { access, refresh, user: { id: user.id, email: user.email, nombre: user.nombre, role: user.role as UserRole } }
}

export async function registerUser(data: {
  email: string
  password: string
  nombre: string
  rut: string
  cargo: string
  companyId?: string
  faenaId?: string
}) {
  const existe = await prisma.user.findUnique({ where: { email: data.email } })
  if (existe) throw new Error('Email ya registrado')

  const passwordHash = await hashPassword(data.password)
  const user = await prisma.user.create({
    data: { ...data, passwordHash, role: 'TRABAJADOR', habilitaciones: [] },
    select: { id: true, email: true, nombre: true, role: true, faenaId: true },
  })

  const payload: TokenPayload = { uid: user.id, email: user.email, role: user.role, faenaId: user.faenaId ?? '' }
  const access = await signAccessToken(payload)
  const refresh = await signRefreshToken(user.id)

  await prisma.refreshToken.create({
    data: { token: refresh, userId: user.id, expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
  })

  return { access, refresh, user: { id: user.id, email: user.email, nombre: user.nombre, role: user.role as UserRole } }
}
