import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'crypto'
import { cookies } from 'next/headers'
import { prisma } from './db'
import type { SystemRole } from './generated/prisma/enums'

export const SESSION_COOKIE = 'agentsapp_session'
const SESSION_DAYS = 30

// --- Contraseñas ---
// scrypt en vez de bcrypt para no sumar una dependencia nativa más: Node ya
// lo trae. N=16384 es el mínimo recomendado por la documentación de Node
// para uso interactivo (no es un valor arbitrario).
const SCRYPT_N = 16384

// util.promisify(crypto.scrypt) resuelve al overload de 3 argumentos (sin
// `options`) por cómo están tipadas las sobrecargas: se envuelve a mano en
// vez de pelear con eso.
function scryptAsync(password: string, salt: Buffer, keylen: number, N: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, keylen, { N }, (err, derivedKey) => {
      if (err) reject(err)
      else resolve(derivedKey)
    })
  })
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const derived = await scryptAsync(password, salt, 64, SCRYPT_N)
  return `scrypt:${SCRYPT_N}:${salt.toString('hex')}:${derived.toString('hex')}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, nStr, saltHex, hashHex] = stored.split(':')
  if (scheme !== 'scrypt' || !nStr || !saltHex || !hashHex) return false

  const salt = Buffer.from(saltHex, 'hex')
  const expected = Buffer.from(hashHex, 'hex')
  const derived = await scryptAsync(password, salt, expected.length, Number(nStr))

  return derived.length === expected.length && timingSafeEqual(derived, expected)
}

// --- Sesiones ---
// El token vive en la cookie; en la base solo se guarda su hash SHA-256, así
// que un volcado de la tabla sessions no alcanza para robar sesiones activas.

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export interface SessionUser {
  id: string
  email: string
  role: SystemRole
  /** Negocios donde el usuario es miembro, con su rol en cada uno. */
  businesses: { businessId: string; role: 'OWNER' | 'STAFF' }[]
}

export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000)

  await prisma.session.create({
    data: { tokenHash: hashToken(token), userId, expiresAt },
  })

  return token
}

export async function destroySession(token: string): Promise<void> {
  await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } })
}

/** Cierra todas las sesiones del usuario (ej. al cambiar la contraseña). */
export async function destroyAllSessions(userId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { userId } })
}

/**
 * Resuelve el usuario a partir del token de sesión. Devuelve null si el
 * token no existe, expiró, o el usuario fue borrado (Session tiene
 * onDelete: Cascade, así que esto último ya lo cubre la base).
 */
export async function getUserByToken(token: string): Promise<SessionUser | null> {
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      user: { include: { memberships: { select: { businessId: true, role: true } } } },
    },
  })

  if (!session || session.expiresAt < new Date()) return null

  return {
    id: session.user.id,
    email: session.user.email,
    role: session.user.role,
    businesses: session.user.memberships.map((m) => ({
      businessId: m.businessId,
      role: m.role,
    })),
  }
}

/** Sesión del usuario actual, leyendo la cookie del request (Server Components / API routes). */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  if (!token) return null
  return getUserByToken(token)
}

export function isPlatformAdmin(user: SessionUser | null): boolean {
  return user?.role === 'PLATFORM_ADMIN'
}

export function canAccessBusiness(user: SessionUser | null, businessId: string): boolean {
  if (!user) return false
  if (isPlatformAdmin(user)) return true
  return user.businesses.some((b) => b.businessId === businessId)
}

export function isBusinessOwner(user: SessionUser | null, businessId: string): boolean {
  if (!user) return false
  if (isPlatformAdmin(user)) return true
  return user.businesses.some((b) => b.businessId === businessId && b.role === 'OWNER')
}

// --- Gestión de usuarios (panel de administración) ---

export interface UserSummary {
  id: string
  email: string
  role: SystemRole
  createdAt: string
  businesses: { businessId: string; businessName: string; role: 'OWNER' | 'STAFF' }[]
}

export async function listUsers(): Promise<UserSummary[]> {
  const rows = await prisma.user.findMany({
    orderBy: { email: 'asc' },
    include: {
      memberships: { include: { business: { select: { businessName: true } } } },
    },
  })

  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    role: row.role,
    createdAt: row.createdAt.toISOString(),
    businesses: row.memberships.map((m) => ({
      businessId: m.businessId,
      businessName: m.business.businessName,
      role: m.role,
    })),
  }))
}

export type CreateUserResult = { ok: true; id: string } | { ok: false; reason: string }

export async function createUser(input: {
  email: string
  password: string
  role: SystemRole
}): Promise<CreateUserResult> {
  const email = input.email.toLowerCase().trim()

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) return { ok: false, reason: 'Ya existe un usuario con ese email.' }

  const user = await prisma.user.create({
    data: { email, passwordHash: await hashPassword(input.password), role: input.role },
  })
  return { ok: true, id: user.id }
}

export async function deleteUser(id: string): Promise<void> {
  await prisma.user.delete({ where: { id } }).catch(() => {})
}

export async function addBusinessMember(
  userId: string,
  businessId: string,
  role: 'OWNER' | 'STAFF',
): Promise<void> {
  await prisma.businessMember.upsert({
    where: { userId_businessId: { userId, businessId } },
    create: { userId, businessId, role },
    update: { role },
  })
}

export async function removeBusinessMember(userId: string, businessId: string): Promise<void> {
  await prisma.businessMember
    .delete({ where: { userId_businessId: { userId, businessId } } })
    .catch(() => {})
}

/**
 * Crea al primer PLATFORM_ADMIN a partir de BOOTSTRAP_ADMIN_EMAIL /
 * BOOTSTRAP_ADMIN_PASSWORD si todavía no existe ningún usuario. Es la única
 * forma de entrar la primera vez, sin tener que insertar filas a mano en la
 * base. No hace nada si ya hay usuarios, así que es seguro llamarla siempre.
 */
export async function ensureBootstrapAdmin(): Promise<void> {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD
  if (!email || !password) return

  const existing = await prisma.user.count()
  if (existing > 0) return

  await prisma.user.create({
    data: {
      email: email.toLowerCase().trim(),
      passwordHash: await hashPassword(password),
      role: 'PLATFORM_ADMIN',
    },
  })
}
