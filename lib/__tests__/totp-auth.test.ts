import { describe, expect, it } from 'vitest'
import { randomUUID } from 'crypto'
import { prisma } from '../db'
import {
  confirmTotpEnrollment,
  createUser,
  disableTotp,
  startTotpEnrollment,
  userHasTotpEnabled,
  verifyUserTotpCode,
} from '../auth'
import { currentTotpCode } from '../totp'

function uniqueEmail(): string {
  return `test-${randomUUID()}@agentsapp.test`
}

async function newUser(): Promise<{ id: string; email: string }> {
  const email = uniqueEmail()
  const created = await createUser({ email, password: 'clave-123456', role: 'USER' })
  if (!created.ok) throw new Error(created.reason)
  return { id: created.id, email }
}

describe('activar 2FA', () => {
  it('no queda activado hasta confirmar con un código real', async () => {
    const user = await newUser()
    await startTotpEnrollment(user.id, user.email)
    expect(await userHasTotpEnabled(user.id)).toBe(false)
  })

  it('un código inventado no confirma la activación', async () => {
    const user = await newUser()
    await startTotpEnrollment(user.id, user.email)
    const result = await confirmTotpEnrollment(user.id, '000000')
    expect(result.ok).toBe(false)
    expect(await userHasTotpEnabled(user.id)).toBe(false)
  })

  it('el código correcto de la app activa el 2FA', async () => {
    const user = await newUser()
    const enrollment = await startTotpEnrollment(user.id, user.email)
    const code = currentTotpCode(enrollment.secret)

    const result = await confirmTotpEnrollment(user.id, code)
    expect(result.ok).toBe(true)
    expect(await userHasTotpEnabled(user.id)).toBe(true)
  })

  it('el secreto no se guarda en texto plano en la fila', async () => {
    const user = await newUser()
    const enrollment = await startTotpEnrollment(user.id, user.email)

    const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id } })
    expect(row.totpSecret).not.toBeNull()
    expect(row.totpSecret).not.toContain(enrollment.secret)
  })
})

describe('verificar un código de login', () => {
  it('rechaza cualquier código si el 2FA no está activado', async () => {
    const user = await newUser()
    expect(await verifyUserTotpCode(user.id, '123456')).toBe(false)
  })

  it('acepta el código correcto una vez activado, rechaza uno inventado', async () => {
    const user = await newUser()
    const enrollment = await startTotpEnrollment(user.id, user.email)
    await confirmTotpEnrollment(user.id, currentTotpCode(enrollment.secret))

    expect(await verifyUserTotpCode(user.id, currentTotpCode(enrollment.secret))).toBe(true)
    expect(await verifyUserTotpCode(user.id, '000000')).toBe(false)
  })
})

describe('desactivar 2FA', () => {
  it('pide el código actual, no alcanza con estar logueado', async () => {
    const user = await newUser()
    const enrollment = await startTotpEnrollment(user.id, user.email)
    await confirmTotpEnrollment(user.id, currentTotpCode(enrollment.secret))

    const wrong = await disableTotp(user.id, '000000')
    expect(wrong.ok).toBe(false)
    expect(await userHasTotpEnabled(user.id)).toBe(true)

    const right = await disableTotp(user.id, currentTotpCode(enrollment.secret))
    expect(right.ok).toBe(true)
    expect(await userHasTotpEnabled(user.id)).toBe(false)
  })

  it('no se puede desactivar algo que no estaba activado', async () => {
    const user = await newUser()
    const result = await disableTotp(user.id, '123456')
    expect(result.ok).toBe(false)
  })
})
