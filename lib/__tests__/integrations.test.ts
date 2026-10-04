import { beforeAll, describe, expect, it } from 'vitest'
import { importCatalog, getAdapter } from '../integrations'
import { IntegrationError, toPesos } from '../integrations/types'
import * as store from '../store'
import type { Business } from '../types'

/** Un fetch falso que responde JSON por página y corta cuando se acaba. */
function fakeFetch(pages: Record<number, unknown>, status = 200): typeof fetch {
  return (async (url: string) => {
    const page = Number(new URL(url).searchParams.get('page') ?? '1')
    const body = pages[page] ?? []
    return { ok: status < 400, status, json: async () => body } as Response
  }) as unknown as typeof fetch
}

describe('toPesos', () => {
  // WooCommerce y Jumpseller mandan el precio con punto decimal ("4500.00"),
  // así que el punto se trata como decimal (no como separador de miles).
  it('normaliza el precio que mandan las APIs', () => {
    expect(toPesos('4500.00')).toBe(4500)
    expect(toPesos('9990,50')).toBe(9991) // coma decimal, se redondea
    expect(toPesos('$ 12.990,00')).toBe(12990) // con símbolo y miles
    expect(toPesos(8000)).toBe(8000)
    expect(toPesos('')).toBe(0)
    expect(toPesos(null)).toBe(0)
  })
})

describe('adaptador WooCommerce', () => {
  const woo = getAdapter('woocommerce')!

  it('mapea productos, stock y estado, y recorre páginas', async () => {
    const fetchImpl = fakeFetch({
      1: Array.from({ length: 100 }, (_, i) => ({ name: `P${i}`, price: '1000', manage_stock: true, stock_quantity: i, status: 'publish' })),
      2: [
        { name: 'Esmalte', price: '4500.00', manage_stock: true, stock_quantity: 12, status: 'publish' },
        { name: 'Sin control', price: '3000', manage_stock: false, status: 'publish' },
        { name: 'Borrador', price: '1', status: 'draft' },
      ],
    })
    const items = await woo.fetchCatalog(
      { storeUrl: 'https://tienda.cl/', consumerKey: 'ck_x', consumerSecret: 'cs_y' },
      fetchImpl,
    )
    expect(items).toHaveLength(103)
    const esmalte = items.find((i) => i.name === 'Esmalte')!
    expect(esmalte.price).toBe(4500)
    expect(esmalte.stock).toBe(12)
    expect(items.find((i) => i.name === 'Sin control')!.stock).toBeNull()
    expect(items.find((i) => i.name === 'Borrador')!.active).toBe(false)
  })

  it('exige credenciales y una URL válida', async () => {
    await expect(woo.fetchCatalog({ storeUrl: 'https://t.cl', consumerKey: '', consumerSecret: '' })).rejects.toThrow(IntegrationError)
    await expect(woo.fetchCatalog({ storeUrl: 'no-es-url', consumerKey: 'k', consumerSecret: 's' })).rejects.toThrow(IntegrationError)
  })

  it('bloquea direcciones internas (SSRF)', async () => {
    for (const storeUrl of ['http://localhost/x', 'http://127.0.0.1', 'http://169.254.169.254', 'http://192.168.0.1']) {
      await expect(woo.fetchCatalog({ storeUrl, consumerKey: 'k', consumerSecret: 's' })).rejects.toThrow(/interna/)
    }
  })

  it('traduce el 401 a un mensaje claro', async () => {
    await expect(
      woo.fetchCatalog({ storeUrl: 'https://t.cl', consumerKey: 'k', consumerSecret: 's' }, fakeFetch({}, 401)),
    ).rejects.toThrow(/no son válidas/)
  })
})

describe('adaptador Jumpseller', () => {
  it('mapea la forma anidada y el stock ilimitado', async () => {
    const js = getAdapter('jumpseller')!
    const fetchImpl = fakeFetch({
      1: [
        { product: { name: 'Polera', price: 9990, stock: 5, status: 'available' } },
        { product: { name: 'Infinito', price: '1990', stock_unlimited: true, status: 'available' } },
      ],
    })
    const items = await js.fetchCatalog({ login: 'a@b.cl', authToken: 't' }, fetchImpl)
    expect(items).toHaveLength(2)
    expect(items[0]).toMatchObject({ name: 'Polera', price: 9990, stock: 5 })
    expect(items[1].stock).toBeNull()
  })
})

describe('importCatalog en la base', () => {
  let business: Business
  beforeAll(async () => {
    business = await store.createBusiness(
      {
        agentName: 'Tito', businessName: 'Tienda Test', industry: 'Tienda',
        description: 'x', goals: 'y', tone: 'cercano', channels: ['whatsapp'],
        configuredAt: new Date().toISOString(),
      },
      'ecommerce',
    )
    // Un producto cargado a mano, que la importación debe actualizar (no duplicar).
    await store.addProduct({ businessId: business.id, name: 'Esmalte', price: 1, stock: 0 })
  })

  it('crea lo nuevo y actualiza por nombre, sin duplicar al repetir', async () => {
    const fetchImpl = fakeFetch({
      1: [
        { name: 'Esmalte', price: '4500', manage_stock: true, stock_quantity: 12, status: 'publish' },
        { name: 'Base coat', price: '3000', manage_stock: true, stock_quantity: 4, status: 'publish' },
        { name: 'Esmalte', price: '9999', manage_stock: true, stock_quantity: 1, status: 'publish' }, // repetido
      ],
    })
    const run = () =>
      importCatalog(business.id, 'woocommerce', { storeUrl: 'https://t.cl', consumerKey: 'k', consumerSecret: 's' }, fetchImpl)

    const first = await run()
    expect(first).toMatchObject({ created: 1, updated: 1, skipped: 1 })

    let products = await store.listProducts(business.id)
    expect(products).toHaveLength(2) // Esmalte (actualizado) + Base coat (nuevo)
    expect(products.find((p) => p.name === 'Esmalte')!.price).toBe(4500)

    // Repetir la importación no duplica: ahora las dos se actualizan.
    const second = await run()
    expect(second).toMatchObject({ created: 0, updated: 2 })
    products = await store.listProducts(business.id)
    expect(products).toHaveLength(2)
  })

  it('rechaza una plataforma desconocida', async () => {
    await expect(importCatalog(business.id, 'magento', {})).rejects.toThrow(IntegrationError)
  })
})
