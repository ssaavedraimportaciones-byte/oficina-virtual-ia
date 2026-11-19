import { randomInt, randomUUID } from 'crypto'
import { readdirSync, statSync } from 'fs'
import { join } from 'path'
import { NextRequest } from 'next/server'
import { validate } from '@scalar/openapi-parser'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createApiKey, hashApiKey, revokeApiKey, rotateApiKey } from '../apiKeys'
import { RATE_LIMIT_PER_MINUTE } from '../apiV1'
import { prisma } from '../db'
import { encryptOptional } from '../secrets'
import { buildOpenApi } from '../openapi'
import { responseTimeStats } from '../apiV1Data'

import * as health from '@/app/api/v1/health/route'
import * as openapiRoute from '@/app/api/v1/openapi.json/route'
import * as summary from '@/app/api/v1/metrics/summary/route'
import * as clients from '@/app/api/v1/clients/route'
import * as client from '@/app/api/v1/clients/[id]/route'
import * as bots from '@/app/api/v1/bots/route'
import * as botStatus from '@/app/api/v1/bots/[id]/status/route'
import * as subscriptions from '@/app/api/v1/subscriptions/route'
import * as payments from '@/app/api/v1/payments/route'
import * as invoices from '@/app/api/v1/invoices/route'
import * as incidents from '@/app/api/v1/incidents/route'

/**
 * API v1 de solo lectura: autenticación por clave, límite de uso, paginación,
 * filtros, que nunca salga nada sensible y que el OpenAPI diga la verdad.
 */

const ctx = (id: string) => ({ params: Promise.resolve({ id }) })
let ipCounter = 0
// La base de pruebas guarda lo de ejecuciones anteriores: las IP tienen que ser distintas en cada corrida.
const IP_SEED = [randomInt(1, 250), randomInt(1, 250)]
const newIp = () => `10.${IP_SEED[0]}.${IP_SEED[1]}.${++ipCounter}`

function call(handler: (r: NextRequest, c?: never) => Promise<Response> | Response, path: string, key: string | null, init: { ip?: string; auth?: string } = {}, id?: string) {
  const headers: Record<string, string> = { 'x-forwarded-for': init.ip ?? newIp() }
  if (init.auth !== undefined) headers.authorization = init.auth
  else if (key) headers.authorization = `Bearer ${key}`
  const req = new NextRequest(`http://localhost${path}`, { headers })
  return (id === undefined ? handler(req) : (handler as unknown as (r: NextRequest, c: unknown) => Promise<Response>)(req, ctx(id))) as Promise<Response>
}

async function newKey(name = 'test') {
  return (await createApiKey(name, null)).key
}

// Una clave nueva por prueba: el límite de 60 pedidos por minuto es por clave y la suite hace más que eso.
let KEY: string
beforeEach(async () => {
  KEY = await newKey('suite')
})
// Los datos sembrados llevan fechas lejanas para quedar al principio de las listas ordenadas del más nuevo al más antiguo.
// Cada corrida usa su propio año lejano: la base de pruebas conserva lo de corridas anteriores.
const YEAR = 2100 + randomInt(0, 7000)
const FUTURE = (month: number, day: number, minute: number) => new Date(Date.UTC(YEAR, month - 1, day, 12, minute))
const seeded = { conversationId: '', businessIds: [] as string[], paymentIds: [] as string[], incidentIds: [] as string[], invoiceIds: [] as string[], userIds: [] as string[], conversationText: `texto-secreto-${randomUUID()}`, waToken: `wa-token-${randomUUID()}`, passwordHash: `hash-${randomUUID()}` }

beforeAll(async () => {
  // Usuario con plan y negocios (con token de WhatsApp y una conversación con texto) para probar que NADA de eso sale.
  const user = await prisma.user.create({ data: { email: `api-${randomUUID()}@test.cl`, passwordHash: seeded.passwordHash, plan: 'BASICO', stripeCustomerId: `cus_${randomUUID()}`, stripeSubscriptionId: `sub_${randomUUID()}` } })
  seeded.userIds.push(user.id)
  for (let i = 0; i < 7; i += 1) {
    const b = await prisma.business.create({
      data: {
        templateId: 'gastronomia',
        agentName: `Agente ${i}`,
        businessName: `Cliente API ${i}`,
        industry: 'Comida',
        description: 'd',
        goals: 'g',
        tone: 'cercano',
        channels: ['whatsapp'],
        hours: [],
        rut: i === 0 ? '76.543.210-3' : null,
        adminNotes: `nota interna ${i}`,
        whatsappPhoneNumberId: i % 2 === 0 ? `pn-${randomUUID()}` : null,
        whatsappAccessToken: encryptOptional(seeded.waToken),
        createdAt: FUTURE(1, 1, i),
        members: { create: { userId: user.id, role: 'OWNER' } },
      },
    })
    seeded.businessIds.push(b.id)
  }
  const conv = await prisma.conversation.create({ data: { businessId: seeded.businessIds[0], channel: 'whatsapp', contactName: 'Persona Privada', contactHandle: `56911112222-${randomUUID()}` } })
  const ago = (ms: number) => new Date(Date.now() - ms)
  await prisma.message.createMany({
    data: [
      // Esta respuesta llegó 2 horas después: no cuenta para la velocidad del agente.
      { conversationId: conv.id, sender: 'contact', text: seeded.conversationText, timestamp: ago(5 * 3_600_000) },
      { conversationId: conv.id, sender: 'agent', text: seeded.conversationText, timestamp: ago(3 * 3_600_000) },
      // 4 s y 2 s: la mediana es 3 s.
      { conversationId: conv.id, sender: 'contact', text: seeded.conversationText, timestamp: ago(10_000) },
      { conversationId: conv.id, sender: 'agent', text: seeded.conversationText, timestamp: ago(6_000) },
      { conversationId: conv.id, sender: 'contact', text: seeded.conversationText, timestamp: ago(3_000) },
      { conversationId: conv.id, sender: 'agent', text: seeded.conversationText, timestamp: ago(1_000) },
    ],
  })
  seeded.conversationId = conv.id
  for (let i = 0; i < 7; i += 1) {
    const inv = await prisma.invoice.create({ data: { stripeInvoiceId: `in_${randomUUID()}`, userId: user.id, number: `ZV-${i}`, amountClp: 45_000, status: i % 2 ? 'pagada' : 'pendiente', issuedAt: FUTURE(3, 1, i), dueDate: new Date(Date.UTC(2026, 2, 8)), paidAt: i % 2 ? FUTURE(3, 2, 0) : null } })
    seeded.invoiceIds.push(inv.id)
    const pay = await prisma.payment.create({ data: { stripeInvoiceId: `inp_${randomUUID()}`, userId: user.id, amountClp: 45_000 + i, method: 'stripe', paidAt: FUTURE(4, 1, i) } })
    seeded.paymentIds.push(pay.id)
    const inc = await prisma.incident.create({ data: { source: i % 2 ? 'ia' : 'whatsapp', severity: i % 2 ? 'critica' : 'baja', code: 'test', message: `fallo ${i}`, businessId: seeded.businessIds[0], occurredAt: FUTURE(5, 1, i) } })
    seeded.incidentIds.push(inc.id)
  }
})

afterAll(async () => {
  // Lo sembrado se borra: la base de pruebas no tiene por qué acumularlo.
  await prisma.incident.deleteMany({ where: { id: { in: seeded.incidentIds } } }).catch(() => {})
  await prisma.payment.deleteMany({ where: { id: { in: seeded.paymentIds } } }).catch(() => {})
  await prisma.invoice.deleteMany({ where: { id: { in: seeded.invoiceIds } } }).catch(() => {})
  await prisma.business.deleteMany({ where: { id: { in: seeded.businessIds } } }).catch(() => {})
  await prisma.user.deleteMany({ where: { id: { in: seeded.userIds } } }).catch(() => {})
})

describe('autenticación', () => {
  it('sin clave: 401 en JSON', async () => {
    const res = await call(clients.GET, '/api/v1/clients', null)
    expect(res.status).toBe(401)
    expect(res.headers.get('content-type')).toContain('application/json')
    expect(res.headers.get('www-authenticate')).toBe('Bearer')
    expect(await res.json()).toEqual({ error: { code: 'unauthorized', message: expect.stringContaining('Authorization') } })
  })

  it('encabezado mal armado, clave inventada o con otro prefijo: 401', async () => {
    for (const auth of ['Basic abc', 'Bearer', 'Bearer zvk_live_inventada', 'Bearer sk-algo-que-no-es', KEY]) {
      expect((await call(clients.GET, '/api/v1/clients', null, { auth })).status).toBe(401)
    }
  })

  it('clave válida: 200 con los encabezados de seguridad', async () => {
    const res = await call(clients.GET, '/api/v1/clients', KEY)
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(res.headers.get('x-api-version')).toBe('v1')
  })

  it('en la base queda solo el hash, nunca la clave', async () => {
    const { key, info } = await createApiKey('hash', null)
    const row = await prisma.apiKey.findUniqueOrThrow({ where: { id: info.id } })
    expect(row.keyHash).toBe(hashApiKey(key))
    expect(JSON.stringify(row)).not.toContain(key)
    expect(row.scope).toBe('read')
  })

  it('una clave revocada deja de servir al instante', async () => {
    const { key, info } = await createApiKey('revocable', null)
    expect((await call(clients.GET, '/api/v1/clients', key)).status).toBe(200)
    await revokeApiKey(info.id)
    const res = await call(clients.GET, '/api/v1/clients', key)
    expect(res.status).toBe(401)
    expect((await res.json()).error.message).toContain('revocada')
  })

  it('rotar: la clave nueva sirve y la vieja sigue solo durante el período de gracia', async () => {
    const { key: old, info } = await createApiKey('rotable', null)
    const rotated = await rotateApiKey(info.id, null, 24)
    expect(rotated).not.toBeNull()
    expect(rotated!.previous.state).toBe('por_vencer')
    expect((await call(clients.GET, '/api/v1/clients', rotated!.key)).status).toBe(200)
    expect((await call(clients.GET, '/api/v1/clients', old)).status).toBe(200)
    // Se acaba la gracia: la vieja deja de servir.
    await prisma.apiKey.update({ where: { id: info.id }, data: { revokedAt: new Date(Date.now() - 1000) } })
    expect((await call(clients.GET, '/api/v1/clients', old)).status).toBe(401)
    expect((await call(clients.GET, '/api/v1/clients', rotated!.key)).status).toBe(200)
  })

  it('una clave sin alcance de lectura no entra', async () => {
    const { key, info } = await createApiKey('otro-alcance', null)
    await prisma.apiKey.update({ where: { id: info.id }, data: { scope: 'write' } })
    expect((await call(clients.GET, '/api/v1/clients', key)).status).toBe(401)
  })

  it('health y openapi.json son públicos', async () => {
    const h = await health.GET()
    expect(h.status).toBe(200)
    expect((await h.json()).data).toMatchObject({ status: 'ok', apiVersion: 'v1' })
    expect((await openapiRoute.GET()).status).toBe(200)
  })

  it('registra cada acceso, también los rechazados, sin guardar la clave', async () => {
    const { key, info } = await createApiKey('bitacora', null)
    const ip = newIp()
    await call(clients.GET, '/api/v1/clients?limit=1', key, { ip })
    await call(clients.GET, '/api/v1/clients', null, { ip, auth: 'Bearer zvk_live_mala' })
    const logs = await prisma.apiAccessLog.findMany({ where: { ip }, orderBy: { at: 'asc' } })
    expect(logs.map((l) => l.status)).toEqual([200, 401])
    expect(logs[0]).toMatchObject({ keyId: info.id, method: 'GET', path: '/api/v1/clients' })
    expect(JSON.stringify(logs)).not.toContain(key)
    expect((await prisma.apiKey.findUniqueOrThrow({ where: { id: info.id } })).lastUsedAt).not.toBeNull()
  })
})

describe('límite de uso', () => {
  it(`${RATE_LIMIT_PER_MINUTE} pedidos por minuto por clave y luego 429 con Retry-After`, async () => {
    const key = await newKey('limite')
    const ip = newIp()
    for (let i = 0; i < RATE_LIMIT_PER_MINUTE; i += 1) {
      const r = await call(clients.GET, '/api/v1/clients?limit=1', key, { ip })
      expect(r.status).toBe(200)
    }
    const res = await call(clients.GET, '/api/v1/clients?limit=1', key, { ip })
    expect(res.status).toBe(429)
    expect(Number(res.headers.get('retry-after'))).toBeGreaterThan(0)
    expect((await res.json()).error.code).toBe('rate_limited')
    // El límite es por clave: otra clave sigue sirviendo.
    expect((await call(clients.GET, '/api/v1/clients?limit=1', KEY, { ip })).status).toBe(200)
  })

  it('muchos intentos con clave inválida desde la misma IP también se frenan', async () => {
    const ip = newIp()
    const statuses: number[] = []
    for (let i = 0; i < 24; i += 1) statuses.push((await call(clients.GET, '/api/v1/clients', null, { ip, auth: 'Bearer zvk_live_mala' })).status)
    expect(statuses.slice(0, 20).every((s) => s === 401)).toBe(true)
    expect(statuses.slice(20).every((s) => s === 429)).toBe(true)
  })
})

describe('solo lectura', () => {
  const routeFiles = (dir: string): string[] =>
    readdirSync(dir).flatMap((f) => {
      const p = join(dir, f)
      return statSync(p).isDirectory() ? routeFiles(p) : f === 'route.ts' ? [p] : []
    })

  it('ninguna ruta de /api/v1 exporta POST, PUT, PATCH ni DELETE', () => {
    const files = routeFiles(join(process.cwd(), 'app/api/v1'))
    expect(files.length).toBeGreaterThanOrEqual(10)
    for (const f of files) {
      const src = require('fs').readFileSync(f, 'utf8') as string
      expect(src, f).not.toMatch(/export\s+(async\s+)?(function|const)\s+(POST|PUT|PATCH|DELETE)\b/)
    }
  })
})

describe('paginación', () => {
  type Row = { id: string }
  async function walk(handler: (r: NextRequest) => Promise<Response>, path: string, limit: number, until: string[] = []): Promise<{ rows: Row[]; pages: number }> {
    const rows: Row[] = []
    let cursor: string | null = null
    let pages = 0
    do {
      const res = await call(handler as never, `${path}${path.includes('?') ? '&' : '?'}limit=${limit}${cursor ? `&cursor=${cursor}` : ''}`, KEY)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.length).toBeLessThanOrEqual(limit)
      expect(body.page.limit).toBe(limit)
      rows.push(...body.data)
      cursor = body.page.nextCursor
      expect(body.page.hasMore).toBe(cursor !== null)
      pages += 1
    } while (cursor && pages < 40 && !until.every((id) => rows.some((r) => r.id === id)))
    return { rows, pages }
  }

  const lists: Array<[string, (r: NextRequest) => Promise<Response>, string, () => string[]]> = [
    ['clients', clients.GET as never, '/api/v1/clients?include_demo=true', () => seeded.businessIds],
    ['bots', bots.GET as never, '/api/v1/bots', () => seeded.businessIds],
    ['payments', payments.GET as never, '/api/v1/payments', () => seeded.paymentIds],
    ['invoices', invoices.GET as never, '/api/v1/invoices', () => seeded.invoiceIds],
    ['incidents', incidents.GET as never, '/api/v1/incidents', () => seeded.incidentIds],
  ]

  it.each(lists)('%s: recorrer por páginas trae todo una sola vez, sin repetir ni saltarse nada', async (_name, handler, path, ids) => {
    const { rows, pages } = await walk(handler, path, 3, ids())
    const got = rows.map((r) => r.id)
    expect(new Set(got).size).toBe(got.length)
    for (const id of ids()) expect(got).toContain(id)
    expect(pages).toBeGreaterThan(1)
  })

  it('el orden es del más nuevo al más antiguo y estable', async () => {
    const { rows } = await walk(payments.GET as never, '/api/v1/payments', 2, seeded.paymentIds)
    const mine = rows.filter((r) => seeded.paymentIds.includes(r.id)) as Array<Row & { paidAt: string }>
    const dates = mine.map((r) => r.paidAt)
    expect([...dates].sort().reverse()).toEqual(dates)
  })

  it('limit por defecto 25, máximo 100; fuera de rango o texto: 400', async () => {
    const body = await (await call(clients.GET, '/api/v1/clients?include_demo=true', KEY)).json()
    expect(body.page.limit).toBe(25)
    expect(body.data.length).toBeLessThanOrEqual(25)
    for (const bad of ['0', '101', '-1', 'abc', '2.5']) {
      const res = await call(clients.GET, `/api/v1/clients?limit=${bad}`, KEY)
      expect(res.status, bad).toBe(400)
      expect((await res.json()).error.code).toBe('bad_request')
    }
    expect((await call(clients.GET, '/api/v1/clients?limit=100', KEY)).status).toBe(200)
  })

  it('un cursor inventado: 400', async () => {
    expect((await call(clients.GET, '/api/v1/clients?cursor=esto-no-es-un-cursor', KEY)).status).toBe(400)
    expect((await call(clients.GET, `/api/v1/clients?cursor=${Buffer.from('basura').toString('base64url')}`, KEY)).status).toBe(400)
  })
})

describe('filtros', () => {
  it('pagos: from, to y status', async () => {
    const get = async (qs: string) => (await (await call(payments.GET, `/api/v1/payments?${qs}`, KEY)).json()).data as { id: string }[]
    const all = await get(`from=${YEAR}-04-01T00:00:00Z&to=${YEAR}-04-02T00:00:00Z&limit=100`)
    for (const id of seeded.paymentIds) expect(all.map((p) => p.id)).toContain(id)
    expect(await get(`from=${YEAR}-04-02T00:00:00Z&to=${YEAR}-04-03T00:00:00Z`)).toEqual([])
    // Rango de dos minutos: solo los pagos 3 y 4, del más nuevo al más antiguo.
    const two = (await get(`status=pagado&from=${YEAR}-04-01T12:03:00Z&to=${YEAR}-04-01T12:04:00Z&limit=100`)).map((p) => p.id)
    expect(two).toEqual([seeded.paymentIds[4], seeded.paymentIds[3]])
    expect((await call(payments.GET, '/api/v1/payments?status=otro', KEY)).status).toBe(400)
    expect((await call(payments.GET, '/api/v1/payments?from=ayer', KEY)).status).toBe(400)
  })

  it('incidentes: severity y source', async () => {
    const get = async (qs: string) => (await (await call(incidents.GET, `/api/v1/incidents?limit=100&from=${YEAR}-05-01&to=${YEAR}-05-02&${qs}`, KEY)).json()).data as { severity: string; source: string }[]
    const critical = await get('severity=critica')
    expect(critical.length).toBe(3)
    expect(critical.every((i) => i.severity === 'critica')).toBe(true)
    expect((await get('source=whatsapp')).every((i) => i.source === 'whatsapp')).toBe(true)
    expect((await call(incidents.GET, '/api/v1/incidents?severity=gravisima', KEY)).status).toBe(400)
  })

  it('clientes: por defecto sin las cuentas de demostración', async () => {
    const demo = await prisma.business.create({ data: { templateId: 'otro', agentName: 'D', businessName: 'Demo X', industry: 'i', description: 'd', goals: 'g', tone: 'cercano', channels: [], hours: [], adminNotes: 'CUENTA DEMO para mostrar' } })
    // La cuenta de demostración es la más nueva: si se incluyera, estaría en la primera página.
    const ids = async (qs: string) => ((await (await call(clients.GET, `/api/v1/clients?limit=100&${qs}`, KEY)).json()).data as { id: string }[]).map((c) => c.id)
    expect(await ids('')).not.toContain(demo.id)
    expect(await ids('include_demo=true')).toContain(demo.id)
  })
})

describe('contenido de los endpoints', () => {
  it('un cliente: nombre, rubro, RUT, plan, estado, alta y canales', async () => {
    const res = await call(client.GET as never, `/api/v1/clients/${seeded.businessIds[0]}`, KEY, {}, seeded.businessIds[0])
    expect(res.status).toBe(200)
    expect((await res.json()).data).toMatchObject({
      id: seeded.businessIds[0],
      name: 'Cliente API 0',
      industry: 'Comida',
      rut: '76.543.210-3',
      plan: 'BASICO',
      status: 'activo',
      createdAt: `${YEAR}-01-01T12:00:00.000Z`,
      channels: { whatsapp: true, instagram: false },
    })
    // Sin canal conectado = en implementación.
    const b1 = await (await call(client.GET as never, `/api/v1/clients/${seeded.businessIds[1]}`, KEY, {}, seeded.businessIds[1])).json()
    expect(b1.data.status).toBe('en_implementacion')
    expect((await call(client.GET as never, `/api/v1/clients/${randomUUID()}`, KEY, {}, randomUUID())).status).toBe(404)
  })

  it('estado de un bot: sin canal, operativo, degradado por errores y detenido en mantenimiento', async () => {
    // Con la IA configurada (si no, todo bot figura detenido por «ia_no_configurada»).
    const saved = process.env.OPENAI_API_KEY
    process.env.OPENAI_API_KEY = 'clave-de-prueba'
    try {
      await botStatusScenario()
    } finally {
      if (saved === undefined) delete process.env.OPENAI_API_KEY
      else process.env.OPENAI_API_KEY = saved
    }
  })

  it('sin IA configurada, los bots con canal figuran detenidos', async () => {
    const saved = { openai: process.env.OPENAI_API_KEY, anthropic: process.env.ANTHROPIC_API_KEY, base: process.env.OPENAI_BASE_URL }
    delete process.env.OPENAI_API_KEY
    delete process.env.ANTHROPIC_API_KEY
    delete process.env.OPENAI_BASE_URL
    try {
      const body = await (await call(botStatus.GET as never, `/api/v1/bots/${seeded.businessIds[2]}/status`, KEY, {}, seeded.businessIds[2])).json()
      expect(body.data).toMatchObject({ state: 'detenido', reasons: ['ia_no_configurada'] })
    } finally {
      if (saved.openai !== undefined) process.env.OPENAI_API_KEY = saved.openai
      if (saved.anthropic !== undefined) process.env.ANTHROPIC_API_KEY = saved.anthropic
      if (saved.base !== undefined) process.env.OPENAI_BASE_URL = saved.base
    }
  })

  async function botStatusScenario() {
    const status = async (id: string) => (await (await call(botStatus.GET as never, `/api/v1/bots/${id}/status`, KEY, {}, id)).json()).data
    expect((await status(seeded.businessIds[1])).state).toBe('sin_canal')

    const ok = await status(seeded.businessIds[2])
    expect(ok).toMatchObject({ state: 'operativo', reasons: [], name: 'Agente 2' })

    await prisma.incident.create({ data: { source: 'ia', severity: 'alta', code: 'http_500', message: 'caída', businessId: seeded.businessIds[2] } })
    expect(await status(seeded.businessIds[2])).toMatchObject({ state: 'degradado', reasons: ['errores_recientes'] })

    // La actividad es solo fecha: nunca el texto.
    const withMsgs = await status(seeded.businessIds[0])
    expect(withMsgs.lastAgentReplyAt).not.toBeNull()
    expect(withMsgs.recentErrors.length).toBeGreaterThan(0)

    await prisma.platformSetting.upsert({ where: { key: 'maintenance_mode' }, create: { key: 'maintenance_mode', value: 'true' }, update: { value: 'true' } })
    try {
      expect(await status(seeded.businessIds[2])).toMatchObject({ state: 'detenido', reasons: ['mantenimiento'] })
    } finally {
      await prisma.platformSetting.delete({ where: { key: 'maintenance_mode' } })
    }
    expect((await call(botStatus.GET as never, `/api/v1/bots/${randomUUID()}/status`, KEY, {}, randomUUID())).status).toBe(404)
  }

  it('suscripciones: Stripe al día, vencida con días de atraso, cancelada y cortesía', async () => {
    const mk = async (data: { plan: 'BASICO' | 'NEGOCIOS'; stripe?: boolean }) => (await prisma.user.create({ data: { email: `s-${randomUUID()}@t.cl`, passwordHash: 'x', plan: data.plan, ...(data.stripe ? { stripeCustomerId: `cus_${randomUUID()}` } : {}) } })).id
    const now = Date.now()
    const u1 = await mk({ plan: 'BASICO', stripe: true })
    const u2 = await mk({ plan: 'NEGOCIOS', stripe: true })
    const u3 = await mk({ plan: 'BASICO' })
    const u4 = await mk({ plan: 'BASICO' })
    await prisma.subscription.create({ data: { id: `sub_${randomUUID()}`, userId: u1, plan: 'BASICO', status: 'active', amountClp: 45_000, currentPeriodEnd: new Date(now + 10 * 86_400_000) } })
    await prisma.subscription.create({ data: { id: `sub_${randomUUID()}`, userId: u2, plan: 'NEGOCIOS', status: 'past_due', amountClp: 95_000, pastDueSince: new Date(now - 5 * 86_400_000 - 3600_000) } })
    await prisma.subscription.create({ data: { id: `sub_${randomUUID()}`, userId: u3, plan: 'BASICO', status: 'canceled', amountClp: 45_000, canceledAt: new Date(now - 86_400_000) } })

    // Los usuarios recién creados son los más nuevos: están en la primera página.
    const all: { id: string; clients: unknown[]; status: string; billing: string; amountClp: number; daysPastDue: number; nextChargeAt: string | null }[] = (await (await call(subscriptions.GET, '/api/v1/subscriptions?limit=100', KEY)).json()).data

    const byUser = async (userId: string) => {
      const sub = await prisma.subscription.findFirst({ where: { userId } })
      return all.find((s) => s.id === (sub?.id ?? `cortesia_${userId}`))
    }
    expect(await byUser(u1)).toMatchObject({ status: 'activa', billing: 'stripe', amountClp: 45_000 })
    expect((await byUser(u1))!.nextChargeAt).not.toBeNull()
    expect(await byUser(u2)).toMatchObject({ status: 'vencida', daysPastDue: 5, amountClp: 95_000 })
    expect(await byUser(u3)).toMatchObject({ status: 'cancelada', nextChargeAt: null })
    expect(await byUser(u4)).toMatchObject({ status: 'activa', billing: 'cortesia', amountClp: 0 })
    // Montos siempre enteros.
    expect(all.every((s) => Number.isInteger(s.amountClp))).toBe(true)
  })

  it('facturas: una pendiente con plazo vencido se informa como vencida; folio y SII vacíos sin emisor', async () => {
    const body = await (await call(invoices.GET, `/api/v1/invoices?limit=100&from=${YEAR}-03-01&to=${YEAR}-03-02`, KEY)).json()
    const mine = (body.data as { id: string; status: string; paid: boolean; folio: unknown; siiStatus: unknown }[]).filter((i) => seeded.invoiceIds.includes(i.id))
    expect(mine.length).toBe(7)
    expect(mine.filter((i) => i.status === 'vencida').length).toBe(4)
    expect(mine.filter((i) => i.status === 'pagada').every((i) => i.paid)).toBe(true)
    expect(mine.every((i) => i.folio === null && i.siiStatus === null)).toBe(true)
  })

  it('mediana del tiempo de respuesta: solo pares seguidos de menos de una hora (valor exacto en un negocio)', async () => {
    const stats = await responseTimeStats(new Date(Date.now() - 30 * 86_400_000), seeded.businessIds[0])
    expect(stats).toEqual({ medianSeconds: 3, sampleSize: 2, windowDays: 30 })
  })

  it('resumen: clientes, bots, mensajes, mediana de respuesta y errores', async () => {
    const res = await call(summary.GET, '/api/v1/metrics/summary', KEY)
    expect(res.status).toBe(200)
    const { data } = await res.json()
    expect(data.clients.total).toBeGreaterThanOrEqual(7)
    expect(data.clients.active).toBeGreaterThanOrEqual(4)
    expect(data.bots.total).toBeGreaterThanOrEqual(7)
    expect(data.bots.live + data.bots.stopped + data.bots.withoutChannel).toBe(data.bots.total)
    expect(data.messages.month.total).toBe(data.messages.month.fromContacts + data.messages.month.fromAgent + data.messages.month.fromHumans)
    expect(data.messages.month.fromAgent).toBeGreaterThanOrEqual(1)
    expect(data.responseTime.medianSeconds).toBeGreaterThanOrEqual(0)
    expect(data.responseTime.sampleSize).toBeGreaterThanOrEqual(2)
    expect(data.responseTime.windowDays).toBe(30)
    expect(data.errors.rateLast24h).toBeGreaterThanOrEqual(0)
    expect(data.errors.rateLast24h).toBeLessThanOrEqual(1)
    expect(data.timezone).toBe('America/Santiago')
  })
})

describe('seguridad: nada sensible sale por la API', () => {
  it('ninguna respuesta incluye contraseñas, tokens, claves, notas internas ni el texto de las conversaciones', async () => {
    const urls: Array<[(r: NextRequest, c?: never) => Promise<Response> | Response, string, string?]> = [
      [summary.GET, '/api/v1/metrics/summary'],
      [clients.GET, '/api/v1/clients?limit=100&include_demo=true'],
      [client.GET as never, `/api/v1/clients/${seeded.businessIds[0]}`, seeded.businessIds[0]],
      [bots.GET, '/api/v1/bots?limit=100'],
      [botStatus.GET as never, `/api/v1/bots/${seeded.businessIds[0]}/status`, seeded.businessIds[0]],
      [subscriptions.GET, '/api/v1/subscriptions?limit=100'],
      [payments.GET, '/api/v1/payments?limit=100'],
      [invoices.GET, '/api/v1/invoices?limit=100'],
      [incidents.GET, '/api/v1/incidents?limit=100'],
    ]
    for (const [handler, path, id] of urls) {
      const text = await (await call(handler, path, KEY, {}, id)).text()
      for (const secret of [seeded.conversationText, seeded.waToken, seeded.passwordHash, 'nota interna', 'Persona Privada', 'enc:v1:']) {
        expect(text, `${path} filtra «${secret}»`).not.toContain(secret)
      }
      // Ni nombres de campos que delaten datos sensibles.
      expect(text, path).not.toMatch(/"(password|passwordHash|token|accessToken|whatsappAccessToken|instagramAccessToken|adminNotes|stripeCustomerId|stripeSubscriptionId|totpSecret|text|contactHandle|email)"/i)
      // Y las fechas son ISO 8601.
      for (const m of text.matchAll(/"(\w*At|dueDate|timestamp)":"([^"]+)"/g)) expect(m[2], `${path}.${m[1]}`).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/)
    }
  })

  it('un error interno no filtra detalles', async () => {
    // Un id que rompe la consulta no debe devolver el mensaje de la base.
    const res = await call(client.GET as never, '/api/v1/clients/x', KEY, {}, 'x')
    expect([200, 404]).toContain(res.status)
    expect(await res.text()).not.toMatch(/prisma|postgres|select |stack/i)
  })
})

describe('OpenAPI 3.1', () => {
  const doc = buildOpenApi()

  it('es un documento válido según un validador de OpenAPI', async () => {
    const result = await validate(JSON.stringify(doc))
    expect(result.errors ?? [], JSON.stringify(result.errors)).toEqual([])
    expect(result.valid).toBe(true)
  })

  it('declara versión, servidor, seguridad Bearer y un operationId único por endpoint', () => {
    expect(doc.openapi).toBe('3.1.0')
    expect(doc.servers[0].url).toBe('https://zerovistochile.com/api/v1')
    expect(doc.components.securitySchemes.bearerAuth).toMatchObject({ type: 'http', scheme: 'bearer' })
    expect(doc.security).toEqual([{ bearerAuth: [] }])
    const ops = Object.entries(doc.paths).flatMap(([path, item]) => Object.entries(item as Record<string, { operationId?: string }>).map(([method, op]) => ({ path, method, id: op.operationId })))
    expect(ops.every((o) => o.method === 'get')).toBe(true)
    expect(ops.every((o) => o.id)).toBe(true)
    expect(new Set(ops.map((o) => o.id)).size).toBe(ops.length)
  })

  it('cada respuesta 200 trae un ejemplo', () => {
    for (const [path, item] of Object.entries(doc.paths)) {
      const ok = (item as { get: { responses: Record<string, { content?: Record<string, { example?: unknown }> }> } }).get.responses['200']
      expect(ok.content?.['application/json']?.example, path).toBeTruthy()
    }
  })

  it('las rutas documentadas son exactamente las que existen en el código', () => {
    const walk = (dir: string, base = ''): string[] =>
      readdirSync(dir).flatMap((f) => {
        const p = join(dir, f)
        if (statSync(p).isDirectory()) return walk(p, `${base}/${f.replace(/^\[(.+)\]$/, '{$1}')}`)
        return f === 'route.ts' ? [base || '/'] : []
      })
    const real = walk(join(process.cwd(), 'app/api/v1')).filter((p) => p !== '/openapi.json').sort()
    expect(Object.keys(doc.paths).sort()).toEqual(real)
  })

  it('solo health es público', () => {
    const open = Object.entries(doc.paths).filter(([, item]) => (item as { get: { security?: unknown[] } }).get.security?.length === 0).map(([p]) => p)
    expect(open).toEqual(['/health'])
  })

  it('el documento servido por la ruta es el mismo, en JSON', async () => {
    const res = await openapiRoute.GET()
    expect(res.headers.get('content-type')).toContain('application/json')
    expect(await res.json()).toEqual(JSON.parse(JSON.stringify(doc)))
  })
})
