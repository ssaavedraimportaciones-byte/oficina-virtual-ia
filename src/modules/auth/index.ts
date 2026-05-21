import { prisma } from '@/lib/db/client'
import { hashPassword, verifyPassword, signAccessToken, signRefreshToken } from '@/lib/auth'
import type { TokenPayload, UserRole } from '@/types/user'

export async function loginUser(email: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      passwordHash: true,
      isActive: true,
      companyId: true,
    },
  })
  if (!user || !user.isActive) throw new Error('Credenciales incorrectas')

  const ok = await verifyPassword(password, user.passwordHash)
  if (!ok) throw new Error('Credenciales incorrectas')

  const payload: TokenPayload = {
    uid: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    companyId: user.companyId,
  }
  const access = await signAccessToken(payload)
  const refresh = await signRefreshToken(user.id)

  await prisma.refreshToken.create({
    data: {
      token: refresh,
      userId: user.id,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  })

  return {
    access,
    refresh,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as UserRole,
      companyId: user.companyId,
    },
  }
}

export async function registerUser(data: {
  email: string
  password: string
  name: string
  rut: string
  phone?: string
  companyId: string
}) {
  const exists = await prisma.user.findUnique({ where: { email: data.email } })
  if (exists) throw new Error('Email ya registrado')

  const passwordHash = await hashPassword(data.password)
  const user = await prisma.user.create({
    data: { ...data, passwordHash, role: 'WORKER' },
    select: { id: true, email: true, name: true, role: true, companyId: true },
  })

  const payload: TokenPayload = {
    uid: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    companyId: user.companyId,
  }
  const access = await signAccessToken(payload)
  const refresh = await signRefreshToken(user.id)

  await prisma.refreshToken.create({
    data: {
      token: refresh,
      userId: user.id,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  })

  return {
    access,
    refresh,
    user: { id: user.id, email: user.email, name: user.name, role: user.role as UserRole },
  }
}
