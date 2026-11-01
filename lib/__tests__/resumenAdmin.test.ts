import { describe, expect, it } from 'vitest'
import { randomUUID } from 'crypto'
import * as store from '../store'

async function negocio(conMensajes: number) {
  const business = await store.createBusiness(
    { agentName: 'A', businessName: `Resumen ${randomUUID()}`, industry: 'i', description: 'd',
      goals: 'g', tone: 'cercano', channels: ['whatsapp'], configuredAt: '' },
    'manicura',
  )
  const conversation = await store.createConversation({
    businessId: business.id, channel: 'simulador', contactName: 'C', contactHandle: randomUUID(),
  })
  for (let i = 0; i < conMensajes; i += 1) {
    await store.appendMessage(conversation.id, { sender: 'contact', text: `m${i}` })
  }
  await store.addKnowledgeEntry({ businessId: business.id, title: 't', content: 'c', sourceType: 'manual', sourceUrl: null })
  await store.addProduct({ businessId: business.id, name: 'Agotado', price: 1, stock: 0 })
  return business.id
}

describe('resumen del panel del dueño', () => {
  it('cuenta lo de cada negocio por separado, sin mezclarlos', async () => {
    const a = await negocio(3)
    const b = await negocio(1)
    const vacio = (await store.createBusiness(
      { agentName: 'A', businessName: `Vacío ${randomUUID()}`, industry: 'i', description: 'd',
        goals: 'g', tone: 'cercano', channels: ['whatsapp'], configuredAt: '' },
      'manicura',
    )).id

    const overview = await store.getAdminOverview()
    const de = (id: string) => overview.find((o) => o.business.id === id)!

    expect(de(a)).toMatchObject({ conversationCount: 1, messageCount: 3, knowledgeCount: 1, soldOutProducts: 1, pendingOrders: 0 })
    expect(de(b)).toMatchObject({ conversationCount: 1, messageCount: 1, knowledgeCount: 1, soldOutProducts: 1 })
    expect(de(vacio)).toMatchObject({ conversationCount: 0, messageCount: 0, knowledgeCount: 0, soldOutProducts: 0, lastActivityAt: null })
    expect(de(a).lastActivityAt).not.toBeNull()
  })

  it('cuenta las conversaciones abiertas de varios negocios de una vez', async () => {
    const a = await negocio(0)
    const b = await negocio(0)
    const counts = await store.countOpenConversationsByBusiness([a, b])
    expect(counts.get(a)).toBe(1)
    expect(counts.get(b)).toBe(1)
    expect((await store.countOpenConversationsByBusiness([])).size).toBe(0)
  })
})
