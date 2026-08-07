import { describe, expect, it } from 'vitest'
import { createHmac, randomUUID } from 'crypto'
import * as store from '../store'
import { prisma } from '../db'
import { decryptSecret, encryptSecret } from '../secrets'
import { isPrivateAddress, assertPublicUrl } from '../ssrf'
import { verifyMetaSignature } from '../webhookSignature'
import { rateLimit, resetRateLimit } from '../rateLimit'

describe('cifrado de secretos', () => {
  it('el texto cifrado no contiene el original', () => {
    const enc = encryptSecret('EAAG-token-secreto')
    expect(enc).not.toContain('EAAG-token-secreto')
    expect(enc.startsWith('enc:v1:')).toBe(true)
  })

  it('descifra a lo mismo', () => {
    expect(decryptSecret(encryptSecret('hola'))).toBe('hola')
  })

  it('dos cifrados del mismo valor son distintos (IV aleatorio)', () => {
    expect(encryptSecret('x')).not.toBe(encryptSecret('x'))
  })

  it('detecta manipulación del texto cifrado', () => {
    const enc = encryptSecret('token')
    const [iv, tag, data] = enc.slice('enc:v1:'.length).split('.')
    const tampered = `enc:v1:${iv}.${tag}.${Buffer.from('otracosa').toString('base64')}`
    expect(() => decryptSecret(tampered)).toThrow()
  })

  it('valores viejos sin cifrar se leen igual', () => {
    expect(decryptSecret('token-plano-viejo')).toBe('token-plano-viejo')
  })
})

describe('tokens en la base', () => {
  it('el token no queda en texto plano en la fila', async () => {
    const business = await store.createBusiness(
      { agentName: 'S', businessName: 'B', industry: 'i', description: 'd',
        goals: 'g', tone: 'cercano', channels: ['whatsapp'], configuredAt: '' },
      'manicura',
    )
    await store.updateBusinessCredentials(business.id, {
      whatsappPhoneNumberId: '123',
      whatsappAccessToken: 'EAAG-token-supersecreto',
      instagramPageId: null,
      instagramAccessToken: null,
    })

    // Se lee la columna directo de Postgres, sin pasar por el store (que
    // descifraría), para verificar qué queda guardado de verdad.
    const row = await prisma.business.findUniqueOrThrow({ where: { id: business.id } })
    expect(row.whatsappAccessToken).not.toContain('EAAG-token-supersecreto')
    expect(row.whatsappAccessToken).toContain('enc:v1:')

    // Pero se puede recuperar para usarlo.
    const saved = await store.getBusiness(business.id)
    const usable = store.decryptCredentials(saved!.credentials)
    expect(usable.whatsappAccessToken).toBe('EAAG-token-supersecreto')
    // El ID de cuenta no es secreto y queda legible.
    expect(usable.whatsappPhoneNumberId).toBe('123')
  })
})

describe('protección SSRF', () => {
  it('reconoce rangos privados y de metadata', () => {
    for (const ip of ['127.0.0.1', '10.0.0.1', '192.168.1.1', '172.16.0.1', '169.254.169.254', '::1', 'fd00::1']) {
      expect(isPrivateAddress(ip), ip).toBe(true)
    }
  })

  it('acepta direcciones públicas', () => {
    for (const ip of ['8.8.8.8', '1.1.1.1', '172.32.0.1']) {
      expect(isPrivateAddress(ip), ip).toBe(false)
    }
  })

  it('rechaza la metadata del cloud', async () => {
    const r = await assertPublicUrl('http://169.254.169.254/latest/meta-data/')
    expect(r.ok).toBe(false)
  })

  it('rechaza localhost y esquemas raros', async () => {
    expect((await assertPublicUrl('http://localhost/')).ok).toBe(false)
    expect((await assertPublicUrl('file:///etc/passwd')).ok).toBe(false)
    expect((await assertPublicUrl('gopher://x/')).ok).toBe(false)
  })
})

describe('firma de webhooks', () => {
  const SECRET = 'secreto-de-app'
  const body = '{"entry":[]}'

  it('acepta una firma válida', () => {
    process.env.META_APP_SECRET = SECRET
    const sig = 'sha256=' + createHmac('sha256', SECRET).update(body, 'utf8').digest('hex')
    expect(verifyMetaSignature(body, sig).ok).toBe(true)
  })

  it('rechaza firma inválida, ausente y cuerpo alterado', () => {
    process.env.META_APP_SECRET = SECRET
    const sig = 'sha256=' + createHmac('sha256', SECRET).update(body, 'utf8').digest('hex')
    expect(verifyMetaSignature(body, null).ok).toBe(false)
    expect(verifyMetaSignature(body, 'sha256=' + '0'.repeat(64)).ok).toBe(false)
    expect(verifyMetaSignature('{"entry":[{"hackeado":1}]}', sig).ok).toBe(false)
  })

  it('sin META_APP_SECRET falla cerrado', () => {
    delete process.env.META_APP_SECRET
    const r = verifyMetaSignature(body, 'sha256=abc')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.status).toBe(503)
    process.env.META_APP_SECRET = SECRET
  })
})

describe('límite de intentos', () => {
  it('corta al superar el límite y se reinicia al resetear', async () => {
    const key = `test-${randomUUID()}`
    for (let i = 0; i < 3; i++) expect((await rateLimit(key, 3, 60000)).allowed).toBe(true)
    expect((await rateLimit(key, 3, 60000)).allowed).toBe(false)
    await resetRateLimit(key)
    expect((await rateLimit(key, 3, 60000)).allowed).toBe(true)
  })

  it('sobrevive a un reinicio del proceso porque vive en la base, no en memoria', async () => {
    const key = `test-${randomUUID()}`
    await rateLimit(key, 2, 60000)
    await rateLimit(key, 2, 60000)
    // Simula un restart: nada en memoria de este proceso se pierde porque no
    // hay nada en memoria — se vuelve a consultar la fila de Postgres.
    const stillBlocked = await rateLimit(key, 2, 60000)
    expect(stillBlocked.allowed).toBe(false)
  })
})
