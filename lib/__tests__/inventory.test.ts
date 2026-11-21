import { beforeAll, describe, expect, it } from 'vitest'
import {
  addIngredient,
  adjustStock,
  applyIngredientLimits,
  averageCost,
  consumptionFor,
  getInventoryReport,
  listIngredients,
  portionsAvailable,
  recipeCost,
  recordPurchase,
  setRecipe,
  type Ingredient,
} from '../inventory'
import { alertLowStock, saveSalesSettings } from '../payments'
import { runAgentTool } from '../agentTools'
import * as store from '../store'
import type { Business, Conversation, Product } from '../types'

const ing = (id: string, stock: number, unitCost = 0): Ingredient => ({ id, businessId: 'b', name: id, unit: 'unidad', stock, unitCost, minStock: 0 })
const prod = (id: string, stock: number | null = null): Product => ({ id, businessId: 'b', name: id, price: 1000, stock, active: true, imageVersion: null })

describe('reglas puras', () => {
  const ingredients = [ing('pan', 10, 200), ing('vienesa', 4, 500), ing('palta', 1000, 8)]
  const recipes = [
    { productId: 'completo', ingredientId: 'pan', quantity: 1 },
    { productId: 'completo', ingredientId: 'vienesa', quantity: 1 },
    { productId: 'completo', ingredientId: 'palta', quantity: 80 },
  ]

  it('un producto alcanza para lo que permite su ingrediente más escaso', () => {
    expect(portionsAvailable('completo', ingredients, recipes)).toBe(4)
    expect(portionsAvailable('bebida', ingredients, recipes)).toBeNull()
  })

  it('aplica el límite sobre el stock del producto sin tocar los que no tienen receta', () => {
    const [completo, bebida] = applyIngredientLimits([prod('completo'), prod('bebida', 7)], ingredients, recipes)
    expect(completo.stock).toBe(4)
    expect(bebida.stock).toBe(7)
    expect(applyIngredientLimits([prod('completo', 2)], ingredients, recipes)[0].stock).toBe(2)
  })

  it('con un ingrediente en cero el producto queda agotado', () => {
    expect(portionsAvailable('completo', [ing('pan', 10), ing('vienesa', 0), ing('palta', 1000)], recipes)).toBe(0)
  })

  it('costo por receta y consumo de un pedido', () => {
    expect(recipeCost('completo', ingredients, recipes)).toBe(200 + 500 + 640)
    expect(Object.fromEntries(consumptionFor([{ productId: 'completo', quantity: 3 }], recipes))).toEqual({ pan: 3, vienesa: 3, palta: 240 })
  })

  it('costo promedio ponderado al comprar', () => {
    expect(averageCost(1, 500, 10, 600)).toBeCloseTo(590.909, 2)
    expect(averageCost(0, 0, 5, 300)).toBe(300)
  })
})

describe('inventario de materia prima de punta a punta', () => {
  let business: Business
  let conversation: Conversation
  let completoId: string
  const ids: Record<string, string> = {}

  beforeAll(async () => {
    business = await store.createBusiness(
      {
        agentName: 'Rodri', businessName: 'Carro de inventario', industry: 'Food truck',
        description: 'x', goals: 'y', tone: 'cercano', channels: ['whatsapp'],
        configuredAt: new Date().toISOString(),
      },
      'gastronomia',
    )
    await saveSalesSettings(business.id, { ingredientsEnabled: true })
    ids.pan = (await addIngredient(business.id, { name: 'Pan', unit: 'unidad', stock: 10, unitCost: 200 })).id
    ids.vienesa = (await addIngredient(business.id, { name: 'Vienesa', unit: 'unidad', stock: 4, unitCost: 500 })).id
    ids.palta = (await addIngredient(business.id, { name: 'Palta', unit: 'g', stock: 1000, unitCost: 8, minStock: 300 })).id
    const completo = await store.addProduct({ businessId: business.id, name: 'Completo italiano', price: 3500, stock: null })
    completoId = completo.id
    await store.addProduct({ businessId: business.id, name: 'Bebida', price: 1500, stock: null })
    await setRecipe(business.id, completoId, [
      { ingredientId: ids.pan, quantity: 1 },
      { ingredientId: ids.vienesa, quantity: 1 },
      { ingredientId: ids.palta, quantity: 80 },
    ])
    conversation = await store.createConversation({
      businessId: business.id, channel: 'whatsapp', contactName: 'Ana', contactHandle: '56922222222',
    })
  })

  const stockOf = async (name: string) => (await listIngredients(business.id)).find((i) => i.name === name)!.stock

  it('el agente ve cuántos completos alcanzan', async () => {
    const sellable = await store.listSellableProducts(business.id)
    expect(sellable.find((p) => p.name === 'Completo italiano')!.stock).toBe(4)
    expect(sellable.find((p) => p.name === 'Bebida')!.stock).toBeNull()
  })

  let firstOrderId = ''
  it('un pedido descuenta la materia prima y registra el costo', async () => {
    const out = await runAgentTool({ business, conversation }, 'crear_pedido', {
      items: [{ producto: 'Completo italiano', cantidad: 3 }, { producto: 'Bebida', cantidad: 1 }], nombre_cliente: 'Ana',
    })
    expect(out).toContain('Pedido registrado')
    firstOrderId = (await store.listOrders(business.id))[0].id
    expect(await stockOf('Vienesa')).toBe(1)
    expect(await stockOf('Pan')).toBe(7)
    expect(await stockOf('Palta')).toBe(760)
    const report = await getInventoryReport(business.id, new Date(0))
    expect(report.revenue).toBe(3 * 3500 + 1500)
    expect(report.revenueWithRecipe).toBe(3 * 3500)
    expect(report.costOfSales).toBe(3 * 1340)
  })

  it('no vende más de lo que alcanza y lo dice', async () => {
    const out = await runAgentTool({ business, conversation }, 'crear_pedido', {
      items: [{ producto: 'Completo italiano', cantidad: 2 }], nombre_cliente: 'Luis',
    })
    expect(out).toContain('quedan solo 1')
    expect(await store.listOrders(business.id)).toHaveLength(1)
  })

  it('anular devuelve la materia prima y revierte el costo; reactivar la descuenta de nuevo', async () => {
    await store.setOrderStatus(firstOrderId, 'cancelado')
    expect(await stockOf('Vienesa')).toBe(4)
    expect(await stockOf('Palta')).toBe(1000)
    expect((await getInventoryReport(business.id, new Date(0))).costOfSales).toBe(0)

    await store.setOrderStatus(firstOrderId, 'pendiente')
    expect(await stockOf('Vienesa')).toBe(1)
    expect((await getInventoryReport(business.id, new Date(0))).costOfSales).toBe(3 * 1340)
  })

  it('al acabarse un ingrediente avisa y el producto queda agotado para el agente', async () => {
    const out = await runAgentTool({ business, conversation }, 'crear_pedido', {
      items: [{ producto: 'Completo italiano', cantidad: 1 }], nombre_cliente: 'Luis',
    })
    expect(out).toContain('Pedido registrado')
    const last = (await store.listOrders(business.id))[0]
    const lines = await alertLowStock(business.id, business.config.businessName, [{ productId: completoId, quantity: 1 }], last.id)
    expect(lines.join('\n')).toContain('Vienesa (materia prima): se acabó. El agente dejó de ofrecer: Completo italiano')

    const again = await runAgentTool({ business, conversation }, 'crear_pedido', {
      items: [{ producto: 'Completo italiano', cantidad: 1 }], nombre_cliente: 'Luis',
    })
    expect(again).toContain('AGOTADO')
  })

  it('una compra repone y recalcula el costo promedio', async () => {
    const after = await recordPurchase(business.id, ids.vienesa, 10, 6000, 'Boleta 123')
    expect(after.stock).toBe(10)
    expect(after.unitCost).toBe(600) // venía de 0 en stock: vale lo que se pagó
    const sellable = await store.listSellableProducts(business.id)
    expect(sellable.find((p) => p.name === 'Completo italiano')!.stock).toBe(6) // ahora limita el pan
    const report = await getInventoryReport(business.id, new Date(0))
    expect(report.purchases).toBe(10 * 200 + 4 * 500 + 1000 * 8 + 6000)
  })

  it('un conteo con merma ajusta el stock y queda como pérdida', async () => {
    await adjustStock(business.id, ids.palta, 600, 'Se pusieron negras')
    expect(await stockOf('Palta')).toBe(600)
    const report = await getInventoryReport(business.id, new Date(0))
    expect(report.shrinkage).toBe(Math.round((680 - 600) * 8))
  })

  it('con el inventario apagado el agente vende como siempre', async () => {
    await saveSalesSettings(business.id, { ingredientsEnabled: false })
    const sellable = await store.listSellableProducts(business.id)
    expect(sellable.find((p) => p.name === 'Completo italiano')!.stock).toBeNull()
    await saveSalesSettings(business.id, { ingredientsEnabled: true })
  })

  it('no permite recetas con ingredientes de otro local', async () => {
    const other = await store.createBusiness(
      { agentName: 'X', businessName: 'Otro', industry: 'Sushi', description: '', goals: '', tone: 'cercano', channels: [], configuredAt: '' },
      'gastronomia',
    )
    const foreign = await addIngredient(other.id, { name: 'Salmón', unit: 'g', stock: 500 })
    await expect(setRecipe(business.id, completoId, [{ ingredientId: foreign.id, quantity: 10 }])).rejects.toThrow('no es de este local')
  })
})

describe('panel del dueño de la plataforma', () => {
  it('nombra los servicios activos de cada local como los ve el local', async () => {
    const { describeServices } = await import('../store')
    expect(describeServices({ services: 0, products: 0, tables: false, sales: null })).toEqual([])
    expect(
      describeServices({
        services: 0,
        products: 12,
        tables: false,
        sales: {
          paymentsEnabled: true, mercadoPagoToken: 'x', autoConfirmReceipts: false, ordersOnlyInHours: true,
          preorderMinutes: 60, orderCutoffMinutes: 0, kitchenEnabled: true, ingredientsEnabled: true, stockAlertsEnabled: false,
        },
      }),
    ).toEqual(['Pedidos', 'Cobro antes de preparar', 'Mercado Pago', 'Horario de pedidos (desde 60 min antes)', 'Ticket de cocina', 'Inventario de materia prima'])
  })

  it('el resumen de la plataforma cuenta ingredientes por reponer y agotados por materia prima', async () => {
    const { getAdminOverview } = await import('../store')
    const row = (await getAdminOverview()).find((r) => r.business.config.businessName === 'Carro de inventario')!
    expect(row.services).toContain('Inventario de materia prima')
    expect(row.ingredientsToRestock).toBeGreaterThanOrEqual(0)
    expect(row.soldOutProducts).toBeGreaterThanOrEqual(0)
  })
})

describe('margen honesto', () => {
  it('los pedidos anteriores a activar el inventario no inflan la ganancia', async () => {
    const b = await store.createBusiness(
      { agentName: 'X', businessName: 'Sushi previo', industry: 'Sushi', description: '', goals: '', tone: 'cercano', channels: [], configuredAt: '' },
      'gastronomia',
    )
    const roll = await store.addProduct({ businessId: b.id, name: 'Roll', price: 5000, stock: null })
    await store.createOrder({ businessId: b.id, conversationId: null, contactName: 'A', contactHandle: '1', requested: [{ producto: 'Roll', cantidad: 1 }], note: '' })
    await saveSalesSettings(b.id, { ingredientsEnabled: true })
    const arroz = await addIngredient(b.id, { name: 'Arroz', unit: 'g', stock: 1000, unitCost: 2 })
    await setRecipe(b.id, roll.id, [{ ingredientId: arroz.id, quantity: 100 }])
    const r1 = await getInventoryReport(b.id, new Date(0))
    expect(r1.revenue).toBe(5000)
    expect(r1.revenueWithRecipe).toBe(0)
    await store.createOrder({ businessId: b.id, conversationId: null, contactName: 'B', contactHandle: '2', requested: [{ producto: 'Roll', cantidad: 1 }], note: '' })
    const r2 = await getInventoryReport(b.id, new Date(0))
    expect(r2.revenueWithRecipe).toBe(5000)
    expect(r2.costOfSales).toBe(200)
  })
})
