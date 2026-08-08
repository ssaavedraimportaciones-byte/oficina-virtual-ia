import { describe, expect, it, vi } from 'vitest'
import { randomUUID } from 'crypto'
import { prisma } from '../db'
import * as email from '../email'
import {
  adminResetPassword,
  changeOwnPassword,
  createSession,
  createUser,
  getUserByToken,
  getUserProfile,
  requestPasswordReset,
  resetPasswordWithToken,
  sendVerificationEmail,
  verifyEmailWithToken,
  verifyPassword,
} from '../auth'

function uniqueEmail(): string {
  return `test-${randomUUID()}@agentsapp.test`
}

async function newUser(password = 'clave-vieja-123'): Promise<string> {
  const created = await createUser({ email: uniqueEmail(), password, role: 'USER' })
  if (!created.ok) throw new Error(created.reason)
  return created.id
}

/** El mail nunca se manda de verdad en los tests: se intercepta sendEmail y se saca el token del link. */
function extractToken(text: string): string {
  const match = text.match(/token=(\S+)/)
  if (!match) throw new Error('no se encontró el token en el mail')
  return match[1]
}

describe('recuperación de contraseña', () => {
  it('no manda nada si el email no existe (no delata si la cuenta existe o no)', async () => {
    const spy = vi.spyOn(email, 'sendEmail')
    await requestPasswordReset(`no-existe-${randomUUID()}@agentsapp.test`)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it('el link permite elegir una contraseña nueva y cierra todas las sesiones activas', async () => {
    const userId = await newUser()
    const t1 = await createSession(userId)
    const t2 = await createSession(userId)

    const spy = vi.spyOn(email, 'sendEmail').mockResolvedValue({ sent: true })
    await requestPasswordReset((await getUserProfile(userId))!.email)
    expect(spy).toHaveBeenCalledOnce()
    const token = extractToken(spy.mock.calls[0][0].text)
    spy.mockRestore()

    const result = await resetPasswordWithToken(token, 'clave-nueva-456')
    expect(result.ok).toBe(true)

    expect(await getUserByToken(t1)).toBeNull()
    expect(await getUserByToken(t2)).toBeNull()

    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
    expect(await verifyPassword('clave-nueva-456', user.passwordHash)).toBe(true)
  })

  it('un token ya usado no sirve una segunda vez', async () => {
    const userId = await newUser()
    const spy = vi.spyOn(email, 'sendEmail').mockResolvedValue({ sent: true })
    await requestPasswordReset((await getUserProfile(userId))!.email)
    const token = extractToken(spy.mock.calls[0][0].text)
    spy.mockRestore()

    const first = await resetPasswordWithToken(token, 'clave-uno-123456')
    expect(first.ok).toBe(true)
    const second = await resetPasswordWithToken(token, 'clave-dos-123456')
    expect(second.ok).toBe(false)
  })

  it('un token vencido no sirve', async () => {
    const userId = await newUser()
    const spy = vi.spyOn(email, 'sendEmail').mockResolvedValue({ sent: true })
    await requestPasswordReset((await getUserProfile(userId))!.email)
    const token = extractToken(spy.mock.calls[0][0].text)
    spy.mockRestore()

    await prisma.authToken.updateMany({
      where: { userId, purpose: 'PASSWORD_RESET' },
      data: { expiresAt: new Date(Date.now() - 1000) },
    })

    const result = await resetPasswordWithToken(token, 'clave-nueva-456')
    expect(result.ok).toBe(false)
  })

  it('un token inventado no sirve', async () => {
    const result = await resetPasswordWithToken('token-que-nunca-se-emitió', 'clave-x-123456')
    expect(result.ok).toBe(false)
  })
})

describe('cambiar la propia contraseña', () => {
  it('rechaza si la contraseña actual está mal', async () => {
    const userId = await newUser('clave-correcta-123')
    const token = await createSession(userId)

    const result = await changeOwnPassword(userId, 'clave-incorrecta', 'clave-nueva-456', token)
    expect(result.ok).toBe(false)
  })

  it('con la contraseña correcta cambia el hash, mantiene la sesión actual y cierra las demás', async () => {
    const userId = await newUser('clave-correcta-123')
    const currentToken = await createSession(userId)
    const otherToken = await createSession(userId)

    const result = await changeOwnPassword(userId, 'clave-correcta-123', 'clave-nueva-456', currentToken)
    expect(result.ok).toBe(true)

    expect(await getUserByToken(currentToken)).not.toBeNull()
    expect(await getUserByToken(otherToken)).toBeNull()

    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
    expect(await verifyPassword('clave-nueva-456', user.passwordHash)).toBe(true)
  })
})

describe('restablecer contraseña como admin (respaldo sin SMTP)', () => {
  it('genera una contraseña usable y cierra todas las sesiones existentes', async () => {
    const userId = await newUser()
    const token = await createSession(userId)

    const temporaryPassword = await adminResetPassword(userId)

    expect(await getUserByToken(token)).toBeNull()
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
    expect(await verifyPassword(temporaryPassword, user.passwordHash)).toBe(true)
  })
})

describe('verificación de email', () => {
  it('un usuario nuevo arranca sin verificar', async () => {
    const userId = await newUser()
    const profile = await getUserProfile(userId)
    expect(profile?.emailVerifiedAt).toBeNull()
  })

  it('el link de verificación marca el email como verificado', async () => {
    const userId = await newUser()

    const spy = vi.spyOn(email, 'sendEmail').mockResolvedValue({ sent: true })
    await sendVerificationEmail(userId)
    const token = extractToken(spy.mock.calls[0][0].text)
    spy.mockRestore()

    const result = await verifyEmailWithToken(token)
    expect(result.ok).toBe(true)

    const profile = await getUserProfile(userId)
    expect(profile?.emailVerifiedAt).not.toBeNull()
  })

  it('una vez verificado, no se manda un mail de verificación de nuevo', async () => {
    const userId = await newUser()

    const spy = vi.spyOn(email, 'sendEmail').mockResolvedValue({ sent: true })
    await sendVerificationEmail(userId)
    const token = extractToken(spy.mock.calls[0][0].text)
    await verifyEmailWithToken(token)
    spy.mockClear()

    await sendVerificationEmail(userId)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it('un token de verificación no sirve para restablecer la contraseña', async () => {
    const userId = await newUser()

    const spy = vi.spyOn(email, 'sendEmail').mockResolvedValue({ sent: true })
    await sendVerificationEmail(userId)
    const verifyToken = extractToken(spy.mock.calls[0][0].text)
    spy.mockRestore()

    const result = await resetPasswordWithToken(verifyToken, 'clave-nueva-456')
    expect(result.ok).toBe(false)
  })
})
