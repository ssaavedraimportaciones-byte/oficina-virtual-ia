import { beforeAll, describe, expect, it } from 'vitest'
import { randomUUID } from 'crypto'
import { prisma } from '../db'
import * as store from '../store'
import {
  addBusinessMember,
  canAccessBusiness,
  createSession,
  createUser,
  destroyAllSessions,
  destroySession,
  ensureBootstrapAdmin,
  getUserByToken,
  hashPassword,
  isBusinessOwner,
  isPlatformAdmin,
  listUsers,
  removeBusinessMember,
  verifyPassword,
} from '../auth'

function uniqueEmail(): string {
  return `test-${randomUUID()}@agentsapp.test`
}

describe('contraseñas', () => {
  it('la misma contraseña verifica, otra no', async () => {
    const hash = await hashPassword('correcta-123')
    expect(await verifyPassword('correcta-123', hash)).toBe(true)
    expect(await verifyPassword('incorrecta', hash)).toBe(false)
  })

  it('dos hashes de la misma contraseña son distintos (salt aleatorio)', async () => {
    expect(await hashPassword('x')).not.toBe(await hashPassword('x'))
  })

  it('rechaza un hash con formato desconocido en vez de reventar', async () => {
    expect(await verifyPassword('cualquiera', 'no-es-un-hash-valido')).toBe(false)
  })
})

describe('sesiones', () => {
  let userId: string

  beforeAll(async () => {
    const result = await createUser({
      email: uniqueEmail(),
      password: 'clave-de-sesion-123',
      role: 'USER',
    })
    if (!result.ok) throw new Error(result.reason)
    userId = result.id
  })

  it('un token recién creado resuelve al usuario', async () => {
    const token = await createSession(userId)
    const user = await getUserByToken(token)
    expect(user?.id).toBe(userId)
  })

  it('un token inventado no resuelve a nadie', async () => {
    expect(await getUserByToken('token-que-nunca-se-emitió')).toBeNull()
  })

  it('destruir la sesión invalida el token', async () => {
    const token = await createSession(userId)
    expect(await getUserByToken(token)).not.toBeNull()
    await destroySession(token)
    expect(await getUserByToken(token)).toBeNull()
  })

  it('destroyAllSessions cierra todas las sesiones del usuario a la vez', async () => {
    const t1 = await createSession(userId)
    const t2 = await createSession(userId)
    await destroyAllSessions(userId)
    expect(await getUserByToken(t1)).toBeNull()
    expect(await getUserByToken(t2)).toBeNull()
  })

  it('una sesión expirada no resuelve, aunque el token exista', async () => {
    const token = await createSession(userId)
    // Se pisa a mano la fecha de expiración para simular el paso del tiempo
    // sin depender de un temporizador real.
    await prisma.session.updateMany({
      where: { userId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    })
    expect(await getUserByToken(token)).toBeNull()
  })
})

describe('permisos por negocio', () => {
  let ownerId: string
  let outsiderId: string
  let adminId: string
  let businessId: string

  beforeAll(async () => {
    const owner = await createUser({ email: uniqueEmail(), password: 'x'.repeat(10), role: 'USER' })
    const outsider = await createUser({ email: uniqueEmail(), password: 'x'.repeat(10), role: 'USER' })
    const admin = await createUser({
      email: uniqueEmail(),
      password: 'x'.repeat(10),
      role: 'PLATFORM_ADMIN',
    })
    if (!owner.ok || !outsider.ok || !admin.ok) throw new Error('setup falló')
    ownerId = owner.id
    outsiderId = outsider.id
    adminId = admin.id

    const business = await store.createBusiness(
      { agentName: 'A', businessName: 'Negocio de prueba', industry: 'i', description: 'd',
        goals: 'g', tone: 'cercano', channels: ['whatsapp'], configuredAt: '' },
      'manicura',
    )
    businessId = business.id
    await addBusinessMember(ownerId, businessId, 'OWNER')
  })

  it('el dueño accede a su negocio, un tercero no', async () => {
    const owner = await getUserByToken(await createSession(ownerId))
    const outsider = await getUserByToken(await createSession(outsiderId))

    expect(canAccessBusiness(owner, businessId)).toBe(true)
    expect(canAccessBusiness(outsider, businessId)).toBe(false)
  })

  it('el admin de plataforma accede a cualquier negocio sin ser miembro', async () => {
    const admin = await getUserByToken(await createSession(adminId))
    expect(isPlatformAdmin(admin)).toBe(true)
    expect(canAccessBusiness(admin, businessId)).toBe(true)
  })

  it('un usuario sin sesión (null) no accede a nada', () => {
    expect(canAccessBusiness(null, businessId)).toBe(false)
    expect(isPlatformAdmin(null)).toBe(false)
  })

  it('isBusinessOwner distingue OWNER de STAFF', async () => {
    const staffUser = await createUser({
      email: uniqueEmail(), password: 'x'.repeat(10), role: 'USER',
    })
    if (!staffUser.ok) throw new Error('setup falló')
    await addBusinessMember(staffUser.id, businessId, 'STAFF')

    const owner = await getUserByToken(await createSession(ownerId))
    const staff = await getUserByToken(await createSession(staffUser.id))

    expect(isBusinessOwner(owner, businessId)).toBe(true)
    expect(isBusinessOwner(staff, businessId)).toBe(false)
    // Pero STAFF sí puede acceder (leer/operar), solo no es dueño.
    expect(canAccessBusiness(staff, businessId)).toBe(true)
  })

  it('listBusinessesForUser: el dueño ve el suyo, el tercero no ve ninguno, el admin ve todos', async () => {
    const owner = await getUserByToken(await createSession(ownerId))
    const outsider = await getUserByToken(await createSession(outsiderId))
    const admin = await getUserByToken(await createSession(adminId))

    const ownerBusinesses = await store.listBusinessesForUser(owner!)
    const outsiderBusinesses = await store.listBusinessesForUser(outsider!)
    const adminBusinesses = await store.listBusinessesForUser(admin!)

    expect(ownerBusinesses.some((b) => b.id === businessId)).toBe(true)
    expect(outsiderBusinesses.some((b) => b.id === businessId)).toBe(false)
    expect(adminBusinesses.some((b) => b.id === businessId)).toBe(true)
  })

  it('quitar la membresía revoca el acceso de inmediato', async () => {
    const temp = await createUser({ email: uniqueEmail(), password: 'x'.repeat(10), role: 'USER' })
    if (!temp.ok) throw new Error('setup falló')
    await addBusinessMember(temp.id, businessId, 'STAFF')

    let user = await getUserByToken(await createSession(temp.id))
    expect(canAccessBusiness(user, businessId)).toBe(true)

    await removeBusinessMember(temp.id, businessId)

    user = await getUserByToken(await createSession(temp.id))
    expect(canAccessBusiness(user, businessId)).toBe(false)
  })
})

describe('gestión de usuarios', () => {
  it('no deja crear dos usuarios con el mismo email', async () => {
    const email = uniqueEmail()
    const first = await createUser({ email, password: 'x'.repeat(10), role: 'USER' })
    const second = await createUser({ email, password: 'otra-clave-123', role: 'USER' })

    expect(first.ok).toBe(true)
    expect(second.ok).toBe(false)
  })

  it('el email se normaliza (minúsculas, sin espacios)', async () => {
    const raw = `  MixedCase-${randomUUID()}@AgentsApp.Test  `
    const created = await createUser({ email: raw, password: 'x'.repeat(10), role: 'USER' })
    expect(created.ok).toBe(true)

    const users = await listUsers()
    const found = users.find((u) => u.id === (created as { ok: true; id: string }).id)
    expect(found?.email).toBe(raw.trim().toLowerCase())
  })
})

describe('bootstrap del primer admin', () => {
  it('no hace nada si ya faltan las variables de entorno', async () => {
    const before = await prisma.user.count()
    delete process.env.BOOTSTRAP_ADMIN_EMAIL
    delete process.env.BOOTSTRAP_ADMIN_PASSWORD
    await ensureBootstrapAdmin()
    expect(await prisma.user.count()).toBe(before)
  })

  it('no hace nada si ya existe al menos un usuario', async () => {
    // Se asegura explícitamente de que haya al menos un usuario, sin
    // depender del orden de ejecución de otros describe de este archivo.
    await createUser({ email: uniqueEmail(), password: 'x'.repeat(10), role: 'USER' })
    const before = await prisma.user.count()
    expect(before).toBeGreaterThan(0)

    process.env.BOOTSTRAP_ADMIN_EMAIL = uniqueEmail()
    process.env.BOOTSTRAP_ADMIN_PASSWORD = 'no-debería-usarse'
    await ensureBootstrapAdmin()

    expect(await prisma.user.count()).toBe(before)
    delete process.env.BOOTSTRAP_ADMIN_EMAIL
    delete process.env.BOOTSTRAP_ADMIN_PASSWORD
  })
})
