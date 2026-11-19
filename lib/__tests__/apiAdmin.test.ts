import { randomUUID } from 'crypto'
import { NextRequest } from 'next/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as auth from '../auth'
import type { SessionUser } from '../auth'
import { listApiKeys } from '../apiKeys'
import { prisma } from '../db'
import { normalizeRut, rutCheckDigit } from '../rut'
import { startOfBusinessDay, startOfBusinessMonth } from '../timezone'
import { invoiceStatus, recordInvoice, recordPaymentFailed, syncSubscription } from '../billingRecords'
import type Stripe from 'stripe'

import * as keysRoute from '@/app/api/admin/api-keys/route'
import * as revokeRoute from '@/app/api/admin/api-keys/[id]/revoke/route'
import * as rotateRoute from '@/app/api/admin/api-keys/[id]/rotate/route'
import * as adminBusinessRoute from '@/app/api/admin/businesses/[id]/route'

const admin: SessionUser = { id: randomUUID(), email: 'admin@t.cl', role: 'PLATFORM_ADMIN', plan: 'ILIMITADO', businesses: [] }
const normalUser: SessionUser = { id: randomUUID(), email: 'user@t.cl', role: 'USER', plan: 'BASICO', businesses: [] }
const actAs = (u: SessionUser | null) => vi.spyOn(auth, 'getCurrentUser').mockResolvedValue(u)
const req = (method: string, body?: unknown) =>
  new NextRequest('http://localhost/api/admin/x', { method, headers: { 'content-type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
const ctx = (id: string) => ({ params: Promise.resolve({ id }) })

afterEach(() => vi.restoreAllMocks())

describe('claves de la API: solo el administrador de la plataforma', () => {
  it('sin sesión 401 y un usuario normal 403, en todas las rutas', async () => {
    for (const user of [null, normalUser]) {
      actAs(user)
      const expected = user ? 403 : 401
      expect((await keysRoute.GET()).status).toBe(expected)
      expect((await keysRoute.POST(req('POST', { name: 'x' }))).status).toBe(expected)
      expect((await revokeRoute.POST(req('POST'), ctx('x'))).status).toBe(expected)
      expect((await rotateRoute.POST(req('POST'), ctx('x'))).status).toBe(expected)
    }
  })

  it('crear: muestra la clave una sola vez; el listado nunca la devuelve', async () => {
    actAs(admin)
    const res = await keysRoute.POST(req('POST', { name: 'Houston Ops' }))
    expect(res.status).toBe(201)
    expect(res.headers.get('cache-control')).toBe('no-store')
    const body = await res.json()
    expect(body.secret).toMatch(/^zvk_live_[A-Za-z0-9_-]{40,}$/)
    expect(body.key).toMatchObject({ name: 'Houston Ops', scope: 'read', state: 'activa' })
    expect(body.key.prefix).toBe(body.secret.slice(0, body.key.prefix.length))

    const list = await (await keysRoute.GET()).json()
    expect(JSON.stringify(list)).not.toContain(body.secret)
    expect(list.keys.map((k: { id: string }) => k.id)).toContain(body.key.id)
    // Tampoco queda en la base en texto plano.
    const row = await prisma.apiKey.findUniqueOrThrow({ where: { id: body.key.id } })
    expect(JSON.stringify(row)).not.toContain(body.secret)
  })

  it('crear sin nombre: 400', async () => {
    actAs(admin)
    expect((await keysRoute.POST(req('POST', { name: '  ' }))).status).toBe(400)
    expect((await keysRoute.POST(req('POST', {}))).status).toBe(400)
  })

  it('rotar da una clave nueva y deja la vieja 24 horas; revocar corta al instante', async () => {
    actAs(admin)
    const created = await (await keysRoute.POST(req('POST', { name: 'rota' }))).json()
    const res = await rotateRoute.POST(req('POST'), ctx(created.key.id))
    expect(res.status).toBe(201)
    const rotated = await res.json()
    expect(rotated.secret).not.toBe(created.secret)
    expect(rotated.graceHours).toBe(24)
    const old = (await listApiKeys()).find((k) => k.id === created.key.id)!
    expect(old.state).toBe('por_vencer')
    const hours = (new Date(old.revokedAt!).getTime() - Date.now()) / 3_600_000
    expect(hours).toBeGreaterThan(23.9)
    expect(hours).toBeLessThanOrEqual(24)

    expect((await revokeRoute.POST(req('POST'), ctx(rotated.key.id))).status).toBe(200)
    expect((await listApiKeys()).find((k) => k.id === rotated.key.id)!.state).toBe('revocada')
    // Una clave ya revocada no se puede rotar; una inexistente, tampoco.
    expect((await rotateRoute.POST(req('POST'), ctx(rotated.key.id))).status).toBe(404)
    expect((await revokeRoute.POST(req('POST'), ctx(randomUUID()))).status).toBe(404)
  })
})

describe('RUT del cliente', () => {
  it('valida el dígito verificador y normaliza', () => {
    expect(rutCheckDigit('76543210')).toBe('3')
    expect(rutCheckDigit('76000006')).toBe('K')
    expect(normalizeRut('76543210-3')).toBe('76.543.210-3')
    expect(normalizeRut('76000006k')).toBe('76.000.006-K')
    expect(normalizeRut('12.345.678-5')).toBe('12.345.678-5')
    expect(normalizeRut('11.111.111-1')).toBe('11.111.111-1')
    expect(normalizeRut('12.345.678-9')).toBeNull()
    expect(normalizeRut('hola')).toBeNull()
    expect(normalizeRut('')).toBeNull()
  })

  it('el administrador lo carga por la ruta; uno inválido se rechaza; vacío lo borra', async () => {
    const b = await prisma.business.create({ data: { templateId: 'otro', agentName: 'A', businessName: 'RUT test', industry: 'i', description: 'd', goals: 'g', tone: 'cercano', channels: [], hours: [] } })
    actAs(admin)
    const patch = (body: unknown) => adminBusinessRoute.PATCH(req('PATCH', body), ctx(b.id))
    expect((await patch({ rut: '76543210-3' })).status).toBe(200)
    expect((await prisma.business.findUniqueOrThrow({ where: { id: b.id } })).rut).toBe('76.543.210-3')
    expect((await patch({ rut: '76.543.210-1' })).status).toBe(400)
    expect((await prisma.business.findUniqueOrThrow({ where: { id: b.id } })).rut).toBe('76.543.210-3')
    expect((await patch({ rut: '' })).status).toBe(200)
    expect((await prisma.business.findUniqueOrThrow({ where: { id: b.id } })).rut).toBeNull()
    actAs(normalUser)
    expect((await patch({ rut: '76543210-3' })).status).toBe(403)
    await prisma.business.delete({ where: { id: b.id } })
  })
})

describe('inicio del día y del mes en hora de Chile', () => {
  it('21:30 en Chile ya es "mañana" en UTC: el día sigue siendo el de Chile', () => {
    // 2026-07-15 23:30 UTC = 19:30 en Chile (UTC-4 en invierno)
    expect(startOfBusinessDay(new Date('2026-07-15T23:30:00Z')).toISOString()).toBe('2026-07-15T04:00:00.000Z')
    // 2026-07-16 01:00 UTC = 21:00 del 15 en Chile
    expect(startOfBusinessDay(new Date('2026-07-16T01:00:00Z')).toISOString()).toBe('2026-07-15T04:00:00.000Z')
    expect(startOfBusinessMonth(new Date('2026-07-16T01:00:00Z')).toISOString()).toBe('2026-07-01T04:00:00.000Z')
  })

  it('en verano (UTC-3) y en el cambio de mes', () => {
    expect(startOfBusinessDay(new Date('2026-01-10T12:00:00Z')).toISOString()).toBe('2026-01-10T03:00:00.000Z')
    // 2026-02-01 01:00 UTC = 31 de enero 22:00 en Chile: el mes sigue siendo enero.
    expect(startOfBusinessMonth(new Date('2026-02-01T01:00:00Z')).toISOString()).toBe('2026-01-01T03:00:00.000Z')
  })
})

describe('registro de cobros desde Stripe', () => {
  async function user(plan: 'BASICO' | 'NEGOCIOS' = 'BASICO') {
    const customer = `cus_${randomUUID()}`
    const u = await prisma.user.create({ data: { email: `st-${randomUUID()}@t.cl`, passwordHash: 'x', plan, stripeCustomerId: customer } })
    return { id: u.id, customer }
  }
  const unix = (d: Date) => Math.floor(d.getTime() / 1000)
  const invoice = (over: Partial<Stripe.Invoice>) =>
    ({ id: `in_${randomUUID()}`, status: 'paid', created: unix(new Date()), total: 45_000, amount_due: 45_000, amount_paid: 45_000, due_date: null, number: 'ZV-001', status_transitions: { paid_at: unix(new Date()) }, ...over }) as unknown as Stripe.Invoice
  const subscription = (customer: string, over: Partial<Stripe.Subscription> = {}) =>
    ({ id: `sub_${randomUUID()}`, customer, status: 'active', canceled_at: null, metadata: {}, items: { data: [{ price: { id: 'price_x', unit_amount: 45_000 }, quantity: 1, current_period_end: unix(new Date(Date.now() + 20 * 86_400_000)) }] }, ...over }) as unknown as Stripe.Subscription

  it('una factura pagada guarda factura y pago, una sola vez aunque Stripe reenvíe el aviso', async () => {
    const u = await user()
    const inv = invoice({ customer: u.customer } as Partial<Stripe.Invoice>)
    await recordInvoice(inv)
    await recordInvoice(inv)
    expect(await prisma.invoice.count({ where: { stripeInvoiceId: inv.id } })).toBe(1)
    const pays = await prisma.payment.findMany({ where: { stripeInvoiceId: inv.id } })
    expect(pays).toHaveLength(1)
    expect(pays[0]).toMatchObject({ userId: u.id, amountClp: 45_000, status: 'pagado', method: 'stripe' })
    expect((await prisma.invoice.findUniqueOrThrow({ where: { stripeInvoiceId: inv.id } })).status).toBe('pagada')
  })

  it('una factura abierta no genera pago; borradores se ignoran', async () => {
    const u = await user()
    const open = invoice({ customer: u.customer, status: 'open', amount_paid: 0, status_transitions: {}, due_date: unix(new Date(Date.now() + 86_400_000)) } as Partial<Stripe.Invoice>)
    await recordInvoice(open)
    expect(await prisma.payment.count({ where: { stripeInvoiceId: open.id } })).toBe(0)
    expect((await prisma.invoice.findUniqueOrThrow({ where: { stripeInvoiceId: open.id } })).status).toBe('pendiente')
    const draft = invoice({ customer: u.customer, status: 'draft' } as Partial<Stripe.Invoice>)
    await recordInvoice(draft)
    expect(await prisma.invoice.count({ where: { stripeInvoiceId: draft.id } })).toBe(0)
  })

  it('estados de factura: pagada, pendiente, vencida y anulada', () => {
    const past = unix(new Date(Date.now() - 86_400_000))
    expect(invoiceStatus({ status: 'paid', due_date: null })).toBe('pagada')
    expect(invoiceStatus({ status: 'open', due_date: null })).toBe('pendiente')
    expect(invoiceStatus({ status: 'open', due_date: past })).toBe('vencida')
    expect(invoiceStatus({ status: 'void', due_date: null })).toBe('anulada')
    expect(invoiceStatus({ status: 'uncollectible', due_date: null })).toBe('anulada')
  })

  it('suscripción: activa, luego impaga (cuenta días de atraso) y luego pagada de nuevo', async () => {
    const u = await user()
    const sub = subscription(u.customer)
    await syncSubscription(sub)
    expect(await prisma.subscription.findUniqueOrThrow({ where: { id: sub.id } })).toMatchObject({ userId: u.id, status: 'active', amountClp: 45_000, pastDueSince: null })

    const t0 = new Date('2026-11-01T12:00:00Z')
    await syncSubscription({ ...sub, status: 'past_due' } as Stripe.Subscription, t0)
    expect((await prisma.subscription.findUniqueOrThrow({ where: { id: sub.id } })).pastDueSince?.toISOString()).toBe(t0.toISOString())
    // Otro aviso de lo mismo no mueve la fecha de inicio del atraso.
    await syncSubscription({ ...sub, status: 'past_due' } as Stripe.Subscription, new Date('2026-11-05T12:00:00Z'))
    expect((await prisma.subscription.findUniqueOrThrow({ where: { id: sub.id } })).pastDueSince?.toISOString()).toBe(t0.toISOString())

    await syncSubscription({ ...sub, status: 'active' } as Stripe.Subscription)
    expect((await prisma.subscription.findUniqueOrThrow({ where: { id: sub.id } })).pastDueSince).toBeNull()
  })

  it('un cobro fallido deja un incidente de pagos y marca el inicio del atraso', async () => {
    const u = await user()
    const sub = subscription(u.customer)
    await syncSubscription(sub)
    const before = await prisma.incident.count({ where: { source: 'pagos' } })
    await recordPaymentFailed(invoice({ customer: u.customer, status: 'open', amount_paid: 0, amount_due: 45_000, subscription: sub.id } as unknown as Partial<Stripe.Invoice>))
    expect(await prisma.incident.count({ where: { source: 'pagos' } })).toBe(before + 1)
    expect((await prisma.subscription.findUniqueOrThrow({ where: { id: sub.id } })).pastDueSince).not.toBeNull()
  })

  it('un cliente de Stripe desconocido no rompe nada ni guarda a medias', async () => {
    const sub = subscription(`cus_${randomUUID()}`)
    await syncSubscription(sub)
    expect(await prisma.subscription.count({ where: { id: sub.id } })).toBe(0)
  })
})
