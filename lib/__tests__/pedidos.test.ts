import { beforeAll, describe, expect, it } from 'vitest'
import { runAgentTool } from '../agentTools'
import * as store from '../store'
import { checkOrder, isOrderable, isSoldOut } from '../catalog'
import type { Business, Conversation, Product } from '../types'

function product(over: Partial<Product> = {}): Product {
  return { id: 'p', businessId: 'b', name: 'Torta', price: 1000, stock: 5, active: true, ...over }
}

describe('reglas de stock', () => {
  it('marca agotado solo cuando lleva control y llegó a cero', () => {
    expect(isSoldOut(product({ stock: 0 }))).toBe(true)
    expect(isSoldOut(product({ stock: 2 }))).toBe(false)
    expect(isSoldOut(product({ stock: null }))).toBe(false)
  })

  it('un producto pausado no se puede pedir aunque tenga stock', () => {
    expect(isOrderable(product({ active: false, stock: 10 }))).toBe(false)
  })

  it('rechaza pedir más unidades de las que hay, diciendo cuántas quedan', () => {
    const res = checkOrder([product({ stock: 2 })], [{ producto: 'Torta', cantidad: 5 }])
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.reason).toContain('quedan solo 2')
  })

  it('rechaza un producto agotado', () => {
    const res = checkOrder([product({ stock: 0 })], [{ producto: 'Torta', cantidad: 1 }])
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.reason).toContain('AGOTADO')
  })

  it('rechaza cantidades inválidas', () => {
    expect(checkOrder([product()], [{ producto: 'Torta', cantidad: 0 }]).ok).toBe(false)
    expect(checkOrder([product()], [{ producto: 'Torta', cantidad: -2 }]).ok).toBe(false)
  })

  it('calcula el total con varios productos', () => {
    const products = [product({ id: 'a', name: 'Torta', price: 1000 }), product({ id: 'b', name: 'Café', price: 500 })]
    const res = checkOrder(products, [{ producto: 'Torta', cantidad: 2 }, { producto: 'Café', cantidad: 3 }])
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.total).toBe(2 * 1000 + 3 * 500)
  })
})

describe('pedidos punta a punta', () => {
  let business: Business
  let conversation: Conversation

  beforeAll(async () => {
    business = await store.createBusiness(
      { agentName: 'Ema', businessName: 'Pastelería', industry: 'Gastronomía',
        description: 'x', goals: 'y', tone: 'cercano', channels: ['whatsapp'],
        configuredAt: new Date().toISOString() },
      'gastronomia',
    )
    await store.addProduct({ businessId: business.id, name: 'Torta', price: 1000, stock: 3 })
    await store.addProduct({ businessId: business.id, name: 'Café', price: 500, stock: null })
    conversation = await store.createConversation({
      businessId: business.id, channel: 'whatsapp', contactName: 'Ana', contactHandle: '549110',
    })
  })

  it('el catálogo muestra stock y sin-control', async () => {
    const out = await runAgentTool({ business, conversation }, 'consultar_catalogo', {})
    expect(out).toContain('Torta')
    expect(out).toContain('3 en stock')
    expect(out).toContain('sin control de stock')
  })

  it('crea el pedido y descuenta el stock', async () => {
    const out = await runAgentTool({ business, conversation }, 'crear_pedido', {
      items: [{ producto: 'Torta', cantidad: 2 }], nombre_cliente: 'Ana',
    })
    expect(out).toContain('Pedido registrado')

    const products = await store.listProducts(business.id)
    expect(products.find((p) => p.name === 'Torta')!.stock).toBe(1)
  })

  it('un producto sin control de stock no se descuenta', async () => {
    await runAgentTool({ business, conversation }, 'crear_pedido', {
      items: [{ producto: 'Café', cantidad: 10 }], nombre_cliente: 'Ana',
    })
    const products = await store.listProducts(business.id)
    expect(products.find((p) => p.name === 'Café')!.stock).toBeNull()
  })

  it('no deja sobrevender cuando queda menos de lo pedido', async () => {
    const out = await runAgentTool({ business, conversation }, 'crear_pedido', {
      items: [{ producto: 'Torta', cantidad: 5 }], nombre_cliente: 'Pedro',
    })
    expect(out).toContain('No se pudo registrar')
    expect(out).toContain('quedan solo 1')
  })

  it('al agotarse, el catálogo lo marca y avisa que no lo ofrezca', async () => {
    await runAgentTool({ business, conversation }, 'crear_pedido', {
      items: [{ producto: 'Torta', cantidad: 1 }], nombre_cliente: 'Ana',
    })
    const out = await runAgentTool({ business, conversation }, 'consultar_catalogo', {})
    expect(out).toContain('AGOTADO')
    expect(out).toContain('No los ofrezcas')
  })

  it('no permite pedir un producto agotado', async () => {
    const out = await runAgentTool({ business, conversation }, 'crear_pedido', {
      items: [{ producto: 'Torta', cantidad: 1 }], nombre_cliente: 'Ana',
    })
    expect(out).toContain('AGOTADO')
  })

  it('cancelar un pedido devuelve las unidades al stock', async () => {
    const orders = await store.listOrders(business.id)
    const withTorta = orders.find((o) => o.items.some((i) => i.name === 'Torta'))!
    await store.setOrderStatus(withTorta.id, 'cancelado')

    const products = await store.listProducts(business.id)
    const torta = products.find((p) => p.name === 'Torta')!
    expect(torta.stock).toBeGreaterThan(0)
    expect(isSoldOut(torta)).toBe(false)
  })

  it('pide el nombre del cliente si falta', async () => {
    const out = await runAgentTool({ business, conversation }, 'crear_pedido', {
      items: [{ producto: 'Café', cantidad: 1 }],
    })
    expect(out).toContain('Falta el nombre')
  })
})
