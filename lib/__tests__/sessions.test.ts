import { describe, expect, it } from 'vitest'
import { randomUUID } from 'crypto'
import { createSession, createUser, getUserByToken, listUserSessions, revokeSession } from '../auth'

function uniqueEmail(): string {
  return `test-${randomUUID()}@agentsapp.test`
}

async function newUser(): Promise<string> {
  const created = await createUser({ email: uniqueEmail(), password: 'clave-123456', role: 'USER' })
  if (!created.ok) throw new Error(created.reason)
  return created.id
}

describe('listUserSessions', () => {
  it('marca cuál es la sesión actual y trae el resto', async () => {
    const userId = await newUser()
    const current = await createSession(userId, { ipAddress: '1.1.1.1', userAgent: 'Mozilla/Test' })
    const other = await createSession(userId, { ipAddress: '2.2.2.2', userAgent: null })

    const sessions = await listUserSessions(userId, current)
    expect(sessions).toHaveLength(2)

    const currentRow = sessions.find((s) => s.isCurrent)
    expect(currentRow?.ipAddress).toBe('1.1.1.1')
    expect(currentRow?.userAgent).toBe('Mozilla/Test')

    const otherRow = sessions.find((s) => !s.isCurrent)
    expect(otherRow?.ipAddress).toBe('2.2.2.2')
    expect(other).toBeTruthy()
  })

  it('no muestra sesiones de otro usuario', async () => {
    const userA = await newUser()
    const userB = await newUser()
    const tokenA = await createSession(userA)
    await createSession(userB)

    const sessions = await listUserSessions(userA, tokenA)
    expect(sessions).toHaveLength(1)
  })
})

describe('revokeSession', () => {
  it('cierra la sesión puntual sin afectar las demás', async () => {
    const userId = await newUser()
    const keep = await createSession(userId)
    const toRevoke = await createSession(userId)

    const sessions = await listUserSessions(userId, keep)
    const targetId = sessions.find((s) => !s.isCurrent)!.id

    await revokeSession(userId, targetId)

    expect(await getUserByToken(keep)).not.toBeNull()
    expect(await getUserByToken(toRevoke)).toBeNull()
  })

  it('no permite revocar una sesión de otro usuario', async () => {
    const userA = await newUser()
    const userB = await newUser()
    const tokenB = await createSession(userB)

    const sessionsB = await listUserSessions(userB, tokenB)
    const targetId = sessionsB[0].id

    // userA intenta revocar la sesión de userB pasando su propio id: no debería afectarla.
    await revokeSession(userA, targetId)

    expect(await getUserByToken(tokenB)).not.toBeNull()
  })
})
