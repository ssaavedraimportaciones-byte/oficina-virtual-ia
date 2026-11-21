import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireBusinessAccess } from '@/lib/authz'
import {
  addIngredient,
  adjustStock,
  deleteIngredient,
  getInventoryReport,
  InventoryError,
  isInventoryEnabled,
  listIngredients,
  listMovements,
  listRecipes,
  portionsAvailable,
  recipeCost,
  recordPurchase,
  setRecipe,
  UNITS,
  updateIngredient,
} from '@/lib/inventory'
import { listProducts } from '@/lib/store'
import { startOfBusinessDay, startOfBusinessMonth } from '@/lib/timezone'

/** Inventario de materia prima: ingredientes, recetas, costos y movimientos del local. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireBusinessAccess(id)
  if (user instanceof NextResponse) return user

  const [enabled, ingredients, recipes, products, month, today, movements] = await Promise.all([
    isInventoryEnabled(id),
    listIngredients(id),
    listRecipes(id),
    listProducts(id),
    getInventoryReport(id, startOfBusinessMonth()),
    getInventoryReport(id, startOfBusinessDay()),
    listMovements(id),
  ])

  const productCosts = products
    .map((p) => {
      const cost = recipeCost(p.id, ingredients, recipes)
      return {
        id: p.id,
        name: p.name,
        price: p.price,
        active: p.active,
        cost: cost === null ? null : Math.round(cost),
        portions: portionsAvailable(p.id, ingredients, recipes),
        recipe: recipes.filter((r) => r.productId === p.id).map((r) => ({ ingredientId: r.ingredientId, quantity: r.quantity })),
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))

  return NextResponse.json({ enabled, ingredients, products: productCosts, report: { month, today }, movements })
}

const num = z.number().finite()
const unit = z.enum(UNITS)

const actionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('add'),
    name: z.string().trim().min(1).max(80),
    unit,
    stock: num.min(0).max(1_000_000).optional(),
    totalCost: num.min(0).max(100_000_000).optional(),
    minStock: num.min(0).max(1_000_000).optional(),
  }),
  z.object({
    action: z.literal('update'),
    ingredientId: z.string().min(1),
    name: z.string().trim().min(1).max(80).optional(),
    unit: unit.optional(),
    minStock: num.min(0).max(1_000_000).optional(),
    unitCost: num.min(0).max(100_000_000).optional(),
  }),
  z.object({ action: z.literal('delete'), ingredientId: z.string().min(1) }),
  z.object({
    action: z.literal('purchase'),
    ingredientId: z.string().min(1),
    quantity: num.positive().max(1_000_000),
    totalCost: num.min(0).max(100_000_000),
    note: z.string().max(200).optional(),
  }),
  z.object({
    action: z.literal('adjust'),
    ingredientId: z.string().min(1),
    stock: num.min(0).max(1_000_000),
    note: z.string().max(200).optional(),
  }),
  z.object({
    action: z.literal('recipe'),
    productId: z.string().min(1),
    lines: z.array(z.object({ ingredientId: z.string().min(1), quantity: num.min(0).max(100_000) })).max(40),
  }),
])

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireBusinessAccess(id)
  if (user instanceof NextResponse) return user

  const parsed = actionSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Revisa los datos.' }, { status: 400 })
  const a = parsed.data

  try {
    switch (a.action) {
      case 'add': {
        const stock = a.stock ?? 0
        const unitCost = stock > 0 && a.totalCost !== undefined ? a.totalCost / stock : 0
        return NextResponse.json({ ingredient: await addIngredient(id, { name: a.name, unit: a.unit, stock, unitCost, minStock: a.minStock }) })
      }
      case 'update':
        return NextResponse.json({ ingredient: await updateIngredient(id, a.ingredientId, a) })
      case 'delete':
        await deleteIngredient(id, a.ingredientId)
        return NextResponse.json({ ok: true })
      case 'purchase':
        return NextResponse.json({ ingredient: await recordPurchase(id, a.ingredientId, a.quantity, a.totalCost, a.note) })
      case 'adjust':
        return NextResponse.json({ ingredient: await adjustStock(id, a.ingredientId, a.stock, a.note) })
      case 'recipe':
        return NextResponse.json({ recipe: await setRecipe(id, a.productId, a.lines) })
    }
  } catch (error) {
    if (error instanceof InventoryError) return NextResponse.json({ error: error.message }, { status: 400 })
    throw error
  }
}
