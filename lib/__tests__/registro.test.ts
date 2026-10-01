import { afterEach, describe, expect, it, vi } from 'vitest'
import { randomUUID } from 'crypto'
import { NextRequest } from 'next/server'
import * as auth from '../auth'
import { SESSION_COOKIE, getUserByToken } from '../auth'
import { prisma } from '../db'
import * as registerRoute from '@/app/api/auth/register/route'
import * as businessesRoute from '@/app/api/businesses/route'

const ORIGINAL = { ...process.env }
afterEach(() => {
  process.env = { ...ORIGINAL }
  vi.restoreAllMocks()
})

// Cada prueba usa su propia IP: el límite de registros es por IP y la base se comparte.
function register(body: unknown, ip = `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`) {
  return registerRoute.POST(
    new NextRequest('http://localhost/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
  )
}

const valid = () => ({ email: `nuevo-${randomUUID()}@registro.test`, password: 'clave-segura-1', acceptTerms: true })

describe('registro autoservicio', () => {
  it('está cerrado por defecto: no crea cuentas aunque los datos sean válidos', async () => {
    delete process.env.ALLOW_SIGNUP
    const body = valid()
    const res = await register(body)
    expect(res.status).toBe(403)
    expect(await prisma.user.findUnique({ where: { email: body.email } })).toBeNull()
  })

  it('abierto: crea la cuenta como USER gratis, guarda cuándo aceptó los términos y abre sesión', async () => {
    process.env.ALLOW_SIGNUP = 'true'
    const body = valid()
    const res = await register(body)

    expect(res.status).toBe(200)
    const user = await prisma.user.findUniqueOrThrow({ where: { email: body.email } })
    expect(user.role).toBe('USER') // nunca administrador de plataforma
    expect(user.plan).toBe('FREE')
    expect(user.termsAcceptedAt).toBeInstanceOf(Date)

    const cookie = res.cookies.get(SESSION_COOKIE)
    expect(cookie?.value).toBeTruthy()
    expect(cookie?.httpOnly).toBe(true)
    const session = await getUserByToken(cookie!.value)
    expect(session?.id).toBe(user.id)
    expect(session?.businesses).toEqual([]) // empieza sin acceso a ningún negocio
  })

  it('exige aceptar los términos', async () => {
    process.env.ALLOW_SIGNUP = 'true'
    const body = { ...valid(), acceptTerms: false }
    const res = await register(body)
    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain('términos')
    expect(await prisma.user.findUnique({ where: { email: body.email } })).toBeNull()
  })

  it('rechaza contraseñas cortas, emails inválidos y cuerpos que no son JSON', async () => {
    process.env.ALLOW_SIGNUP = 'true'
    expect((await register({ ...valid(), password: '1234567' })).status).toBe(400)
    expect((await register({ ...valid(), password: 'x'.repeat(129) })).status).toBe(400)
    expect((await register({ ...valid(), email: 'no-es-un-email' })).status).toBe(400)
    expect((await register('esto no es json')).status).toBe(400)
  })

  it('un email ya registrado devuelve 409 y no pisa la cuenta existente', async () => {
    process.env.ALLOW_SIGNUP = 'true'
    const body = valid()
    expect((await register(body)).status).toBe(200)
    const before = await prisma.user.findUniqueOrThrow({ where: { email: body.email } })

    const again = await register({ ...body, password: 'otra-clave-distinta' })
    expect(again.status).toBe(409)
    const after = await prisma.user.findUniqueOrThrow({ where: { email: body.email } })
    expect(after.passwordHash).toBe(before.passwordHash)
  })

  it('el email se normaliza: no se puede duplicar cambiando mayúsculas', async () => {
    process.env.ALLOW_SIGNUP = 'true'
    const body = valid()
    expect((await register(body)).status).toBe(200)
    expect((await register({ ...body, email: body.email.toUpperCase() })).status).toBe(409)
  })

  it('frena el alta masiva: máximo 5 registros por hora desde la misma IP', async () => {
    process.env.ALLOW_SIGNUP = 'true'
    const ip = `203.0.113.${Math.floor(Math.random() * 250)}`
    const statuses: number[] = []
    for (let i = 0; i < 7; i += 1) statuses.push((await register(valid(), ip)).status)
    expect(statuses.slice(0, 5)).toEqual([200, 200, 200, 200, 200])
    expect(statuses.slice(5)).toEqual([429, 429])
  })
})

describe('un cliente nuevo de punta a punta', () => {
  const config = {
    agentName: 'Bella', businessName: 'Uñas Bella', industry: 'Manicura', description: 'Estudio de uñas',
    goals: 'Agendar horas', tone: 'cercano', channels: ['whatsapp'],
  }
  const createBusiness = () =>
    businessesRoute.POST(
      new NextRequest('http://localhost/api/businesses', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ templateId: 'manicura', config }),
      }),
    )

  it('se registra, crea su negocio y queda como dueño; el plan gratis permite solo uno', async () => {
    process.env.ALLOW_SIGNUP = 'true'
    const res = await register(valid())
    const session = await getUserByToken(res.cookies.get(SESSION_COOKIE)!.value)
    expect(session).not.toBeNull()
    vi.spyOn(auth, 'getCurrentUser').mockImplementation(async () =>
      // La sesión se vuelve a leer cada vez, como hace la app: incluye los negocios nuevos.
      getUserByToken(res.cookies.get(SESSION_COOKIE)!.value),
    )

    const first = await createBusiness()
    expect(first.status).toBe(200)
    const { business } = await first.json()

    const member = await prisma.businessMember.findFirstOrThrow({ where: { businessId: business.id } })
    expect(member.userId).toBe(session!.id)
    expect(member.role).toBe('OWNER')

    const second = await createBusiness()
    expect(second.status).toBe(402) // plan gratis: un solo negocio propio
    expect(await prisma.businessMember.count({ where: { userId: session!.id } })).toBe(1)
  })
})
