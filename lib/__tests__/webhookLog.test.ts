import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '../db'
import { listWebhookLog, recordWebhook } from '../webhookLog'

/**
 * La bitácora existe para poder ver, sin entrar a Vercel, qué hizo el webhook
 * con cada aviso de Meta. Dos cosas no pueden fallar: que se conserve lo más
 * reciente sin crecer sin límite, y que nunca guarde datos de los clientes.
 */
describe('bitácora del webhook', () => {
  beforeEach(async () => {
    await prisma.platformSetting.deleteMany({ where: { key: 'webhook_log' } })
  })
  afterEach(async () => {
    await prisma.platformSetting.deleteMany({ where: { key: 'webhook_log' } })
  })

  it('anota el resultado y deja lo más nuevo primero', async () => {
    await recordWebhook('rechazado: Firma inválida.')
    await recordWebhook('ok', [
      { field: 'messages', phoneNumberId: '123', matched: true, messages: 1, statuses: 0, types: ['text'] },
    ])
    const log = await listWebhookLog()
    expect(log).toHaveLength(2)
    expect(log[0].result).toBe('ok')
    expect(log[0].changes[0].matched).toBe(true)
    expect(log[1].result).toContain('Firma')
  })

  it('conserva solo las últimas 30', async () => {
    for (let i = 0; i < 35; i++) await recordWebhook(`ok ${i}`)
    const log = await listWebhookLog()
    expect(log).toHaveLength(30)
    expect(log[0].result).toBe('ok 34')
  })

  it('no guarda contenido de mensajes ni teléfonos de clientes', async () => {
    await recordWebhook('ok', [
      { field: 'messages', phoneNumberId: '123', matched: true, messages: 1, statuses: 0, types: ['text'] },
    ])
    const row = await prisma.platformSetting.findUnique({ where: { key: 'webhook_log' } })
    expect(Object.keys(JSON.parse(row!.value)[0].changes[0]).sort()).toEqual(
      ['field', 'matched', 'messages', 'phoneNumberId', 'statuses', 'types'].sort(),
    )
  })

  it('se recupera de un JSON roto sin lanzar error', async () => {
    await prisma.platformSetting.create({ data: { key: 'webhook_log', value: '{no es json' } })
    await recordWebhook('ok')
    expect(await listWebhookLog()).toHaveLength(1)
  })
})
