import { prisma } from './db'
import type { Prisma } from './generated/prisma/client'
import type { Product } from './types'

/**
 * Inventario de materia prima (opcional, para locales de comida).
 *
 * El local carga sus ingredientes (pan, vienesa, palta, salmón…), registra las
 * compras y arma la receta de cada producto. Cada pedido descuenta lo que usa;
 * anularlo lo devuelve. Con eso:
 * - el agente no vende lo que no se puede preparar: un producto con receta
 *   «alcanza para» lo que permita su ingrediente más escaso;
 * - el panel muestra el costo de cada producto, su margen y cuánto costó lo vendido.
 *
 * Todo movimiento queda registrado (compra, consumo, anulación, ajuste), así
 * inventario y costos cuadran y se puede revisar de dónde salió cada número.
 */

export const UNITS = ['unidad', 'g', 'kg', 'ml', 'l'] as const
export type Unit = (typeof UNITS)[number]

export const UNIT_LABEL: Record<Unit, string> = { unidad: 'unidades', g: 'g', kg: 'kg', ml: 'ml', l: 'litros' }

export interface Ingredient {
  id: string
  businessId: string
  name: string
  unit: Unit
  stock: number
  unitCost: number
  minStock: number
}

export interface RecipeLine {
  productId: string
  ingredientId: string
  quantity: number
}

export type MovementKind = 'compra' | 'consumo' | 'anulacion' | 'ajuste'

export interface Movement {
  id: string
  ingredientId: string
  ingredientName: string
  unit: Unit
  kind: MovementKind
  quantity: number
  unitCost: number
  orderId: string | null
  note: string
  createdAt: string
}

/** Cantidades con decimales (0,08 kg de palta): se redondean para no arrastrar ruido de coma flotante. */
export const round3 = (n: number) => Math.round(n * 1000) / 1000

const toUnit = (u: string): Unit => ((UNITS as readonly string[]).includes(u) ? (u as Unit) : 'unidad')

function mapIngredient(row: { id: string; businessId: string; name: string; unit: string; stock: number; unitCost: number; minStock: number }): Ingredient {
  return { id: row.id, businessId: row.businessId, name: row.name, unit: toUnit(row.unit), stock: round3(row.stock), unitCost: row.unitCost, minStock: row.minStock }
}

// --- Reglas puras ---

/** Cuántas unidades del producto alcanza a preparar el inventario (null = sin receta). */
export function portionsAvailable(productId: string, ingredients: Ingredient[], recipes: RecipeLine[]): number | null {
  const lines = recipes.filter((r) => r.productId === productId && r.quantity > 0)
  if (lines.length === 0) return null
  let min = Infinity
  for (const line of lines) {
    const ing = ingredients.find((i) => i.id === line.ingredientId)
    // Un ingrediente borrado deja la receta incompleta: no se puede preparar.
    const portions = ing ? Math.floor((Math.max(0, ing.stock) + 1e-9) / line.quantity) : 0
    min = Math.min(min, portions)
  }
  return min
}

/**
 * El catálogo como lo ve el agente: el stock de cada producto con receta se
 * limita a lo que alcanzan los ingredientes. Así todas las reglas de stock que
 * ya existían (agotado, «quedan solo N») funcionan igual con materia prima.
 */
export function applyIngredientLimits(products: Product[], ingredients: Ingredient[], recipes: RecipeLine[]): Product[] {
  return products.map((p) => {
    const portions = portionsAvailable(p.id, ingredients, recipes)
    if (portions === null) return p
    return { ...p, stock: p.stock === null ? portions : Math.min(p.stock, portions) }
  })
}

/** Costo de una unidad del producto según su receta (null = sin receta). */
export function recipeCost(productId: string, ingredients: Ingredient[], recipes: RecipeLine[]): number | null {
  const lines = recipes.filter((r) => r.productId === productId)
  if (lines.length === 0) return null
  return lines.reduce((sum, line) => {
    const ing = ingredients.find((i) => i.id === line.ingredientId)
    return sum + (ing ? line.quantity * ing.unitCost : 0)
  }, 0)
}

/** Total de cada ingrediente que necesita un pedido. */
export function consumptionFor(items: { productId: string; quantity: number }[], recipes: RecipeLine[]): Map<string, number> {
  const need = new Map<string, number>()
  for (const item of items) {
    for (const line of recipes.filter((r) => r.productId === item.productId)) {
      need.set(line.ingredientId, round3((need.get(line.ingredientId) ?? 0) + line.quantity * item.quantity))
    }
  }
  return need
}

/** Costo promedio ponderado después de una compra. */
export function averageCost(stock: number, unitCost: number, quantity: number, purchaseUnitCost: number): number {
  const before = Math.max(0, stock)
  if (before + quantity <= 0) return purchaseUnitCost
  return (before * unitCost + quantity * purchaseUnitCost) / (before + quantity)
}

// --- Lectura ---

export async function isInventoryEnabled(businessId: string, db: Prisma.TransactionClient | typeof prisma = prisma): Promise<boolean> {
  const row = await db.salesSettings.findUnique({ where: { businessId }, select: { ingredientsEnabled: true } })
  return Boolean(row?.ingredientsEnabled)
}

export async function listIngredients(businessId: string, db: Prisma.TransactionClient | typeof prisma = prisma): Promise<Ingredient[]> {
  const rows = await db.ingredient.findMany({ where: { businessId }, orderBy: { name: 'asc' } })
  return rows.map(mapIngredient)
}

export async function listRecipes(businessId: string, db: Prisma.TransactionClient | typeof prisma = prisma): Promise<RecipeLine[]> {
  return db.recipeItem.findMany({
    where: { product: { businessId } },
    select: { productId: true, ingredientId: true, quantity: true },
  })
}

/** Ingredientes y recetas si el inventario está activo; si no, null. */
export async function loadInventory(
  businessId: string,
  db: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<{ ingredients: Ingredient[]; recipes: RecipeLine[] } | null> {
  if (!(await isInventoryEnabled(businessId, db))) return null
  const [ingredients, recipes] = await Promise.all([listIngredients(businessId, db), listRecipes(businessId, db)])
  return { ingredients, recipes }
}

// --- Escritura desde el panel ---

export class InventoryError extends Error {}

function cleanName(name: string): string {
  const n = name.trim().replace(/\s+/g, ' ')
  if (!n) throw new InventoryError('Ponle nombre al ingrediente.')
  return n.slice(0, 80)
}

export async function addIngredient(
  businessId: string,
  input: { name: string; unit: Unit; stock?: number; unitCost?: number; minStock?: number },
): Promise<Ingredient> {
  const name = cleanName(input.name)
  const exists = await prisma.ingredient.findFirst({ where: { businessId, name: { equals: name, mode: 'insensitive' } } })
  if (exists) throw new InventoryError(`Ya tienes un ingrediente llamado "${exists.name}".`)
  const stock = round3(Math.max(0, input.stock ?? 0))
  const unitCost = Math.max(0, input.unitCost ?? 0)
  return prisma.$transaction(async (tx) => {
    const row = await tx.ingredient.create({
      data: { businessId, name, unit: input.unit, stock, unitCost, minStock: Math.max(0, input.minStock ?? 0) },
    })
    if (stock > 0) {
      await tx.inventoryMovement.create({
        data: { businessId, ingredientId: row.id, kind: 'compra', quantity: stock, unitCost, note: 'Stock inicial' },
      })
    }
    return mapIngredient(row)
  })
}

export async function updateIngredient(
  businessId: string,
  id: string,
  input: { name?: string; unit?: Unit; minStock?: number; unitCost?: number },
): Promise<Ingredient> {
  const data: Prisma.IngredientUpdateManyMutationInput = {}
  if (input.name !== undefined) {
    const name = cleanName(input.name)
    const clash = await prisma.ingredient.findFirst({ where: { businessId, name: { equals: name, mode: 'insensitive' }, NOT: { id } } })
    if (clash) throw new InventoryError(`Ya tienes un ingrediente llamado "${clash.name}".`)
    data.name = name
  }
  if (input.unit !== undefined) data.unit = input.unit
  if (input.minStock !== undefined) data.minStock = Math.max(0, input.minStock)
  if (input.unitCost !== undefined) data.unitCost = Math.max(0, input.unitCost)
  const res = await prisma.ingredient.updateMany({ where: { id, businessId }, data })
  if (res.count === 0) throw new InventoryError('Ese ingrediente no existe.')
  return mapIngredient(await prisma.ingredient.findUniqueOrThrow({ where: { id } }))
}

export async function deleteIngredient(businessId: string, id: string): Promise<void> {
  await prisma.ingredient.deleteMany({ where: { id, businessId } })
}

/**
 * Ingreso de mercadería: suma al stock y recalcula el costo promedio con lo
 * que se pagó. `totalCost` es lo que costó toda la compra (lo que dice la boleta).
 */
export async function recordPurchase(
  businessId: string,
  ingredientId: string,
  quantity: number,
  totalCost: number,
  note = '',
): Promise<Ingredient> {
  if (!(quantity > 0)) throw new InventoryError('La cantidad comprada tiene que ser mayor a cero.')
  if (!(totalCost >= 0)) throw new InventoryError('El costo no es válido.')
  return prisma.$transaction(async (tx) => {
    const ing = await tx.ingredient.findFirst({ where: { id: ingredientId, businessId } })
    if (!ing) throw new InventoryError('Ese ingrediente no existe.')
    const q = round3(quantity)
    const purchaseUnitCost = totalCost / q
    const row = await tx.ingredient.update({
      where: { id: ing.id },
      data: { stock: round3(ing.stock + q), unitCost: averageCost(ing.stock, ing.unitCost, q, purchaseUnitCost) },
    })
    await tx.inventoryMovement.create({
      data: { businessId, ingredientId: ing.id, kind: 'compra', quantity: q, unitCost: purchaseUnitCost, note: note.slice(0, 200) },
    })
    return mapIngredient(row)
  })
}

/** Conteo o merma: deja el stock en `newStock` y registra la diferencia. */
export async function adjustStock(businessId: string, ingredientId: string, newStock: number, note = ''): Promise<Ingredient> {
  if (!(newStock >= 0)) throw new InventoryError('El stock no puede ser negativo.')
  return prisma.$transaction(async (tx) => {
    const ing = await tx.ingredient.findFirst({ where: { id: ingredientId, businessId } })
    if (!ing) throw new InventoryError('Ese ingrediente no existe.')
    const diff = round3(newStock - ing.stock)
    const row = await tx.ingredient.update({ where: { id: ing.id }, data: { stock: round3(newStock) } })
    if (diff !== 0) {
      await tx.inventoryMovement.create({
        data: { businessId, ingredientId: ing.id, kind: 'ajuste', quantity: diff, unitCost: ing.unitCost, note: note.slice(0, 200) || (diff < 0 ? 'Merma / conteo' : 'Conteo') },
      })
    }
    return mapIngredient(row)
  })
}

/** Reemplaza la receta de un producto. Cantidades en la unidad de cada ingrediente. */
export async function setRecipe(businessId: string, productId: string, lines: { ingredientId: string; quantity: number }[]): Promise<RecipeLine[]> {
  const product = await prisma.product.findFirst({ where: { id: productId, businessId }, select: { id: true } })
  if (!product) throw new InventoryError('Ese producto no existe.')
  const clean = lines.filter((l) => l.quantity > 0)
  const ids = [...new Set(clean.map((l) => l.ingredientId))]
  const owned = await prisma.ingredient.count({ where: { businessId, id: { in: ids } } })
  if (owned !== ids.length) throw new InventoryError('La receta tiene un ingrediente que no es de este local.')
  if (ids.length !== clean.length) throw new InventoryError('Un ingrediente aparece dos veces en la receta.')
  await prisma.$transaction([
    prisma.recipeItem.deleteMany({ where: { productId } }),
    prisma.recipeItem.createMany({ data: clean.map((l) => ({ productId, ingredientId: l.ingredientId, quantity: round3(l.quantity) })) }),
  ])
  return prisma.recipeItem.findMany({ where: { productId }, select: { productId: true, ingredientId: true, quantity: true } })
}

// --- Pedidos: consumo y devolución ---

export class IngredientShortError extends Error {}

/**
 * Descuenta los ingredientes de un pedido dentro de su transacción. Igual que
 * con el stock de productos, cada descuento es un UPDATE condicional
 * (`stock >= lo que se usa`): si dos pedidos compiten por la última palta, uno
 * falla con un mensaje claro en vez de dejar el stock negativo.
 */
export async function consumeForOrder(
  tx: Prisma.TransactionClient,
  businessId: string,
  orderId: string,
  items: { productId: string; quantity: number }[],
  recipes: RecipeLine[],
  ingredients: Ingredient[],
  options: { force?: boolean; kind?: MovementKind } = {},
): Promise<void> {
  for (const [ingredientId, qty] of consumptionFor(items, recipes)) {
    const ing = ingredients.find((i) => i.id === ingredientId)
    if (!ing || qty <= 0) continue
    if (options.force) {
      await tx.ingredient.update({ where: { id: ingredientId }, data: { stock: { decrement: qty } } })
    } else {
      const updated = await tx.ingredient.updateMany({
        where: { id: ingredientId, stock: { gte: qty - 1e-9 } },
        data: { stock: { decrement: qty } },
      })
      if (updated.count === 0) {
        throw new IngredientShortError(`Se acabó "${ing.name}" justo ahora y no alcanza para el pedido. Vuelve a consultar el catálogo.`)
      }
    }
    await tx.inventoryMovement.create({
      data: { businessId, ingredientId, kind: options.kind ?? 'consumo', quantity: -qty, unitCost: ing.unitCost, orderId },
    })
  }
  if (options.force) {
    // Reactivar un pedido anulado lo decide el local aunque falte algo: el stock no baja de cero.
    await tx.ingredient.updateMany({ where: { businessId, stock: { lt: 0 } }, data: { stock: 0 } })
  }
}

/**
 * Al anular un pedido: devuelve exactamente lo que ese pedido consumió (neto),
 * al mismo costo, para que el costo de lo vendido también se revierta.
 * Al reactivarlo: vuelve a descontar según la receta actual.
 */
export async function onOrderCancelChange(
  tx: Prisma.TransactionClient,
  businessId: string,
  orderId: string,
  willCancel: boolean,
  items: { productId: string; quantity: number }[],
): Promise<void> {
  if (willCancel) {
    const moves = await tx.inventoryMovement.findMany({ where: { orderId } })
    const net = new Map<string, { qty: number; cost: number }>()
    for (const m of moves) {
      const cur = net.get(m.ingredientId) ?? { qty: 0, cost: 0 }
      net.set(m.ingredientId, { qty: cur.qty + m.quantity, cost: cur.cost + m.quantity * m.unitCost })
    }
    for (const [ingredientId, { qty, cost }] of net) {
      const back = round3(-qty)
      if (back <= 0) continue
      const res = await tx.ingredient.updateMany({ where: { id: ingredientId }, data: { stock: { increment: back } } })
      if (res.count === 0) continue // ingrediente borrado
      await tx.inventoryMovement.create({
        data: { businessId, ingredientId, kind: 'anulacion', quantity: back, unitCost: cost / qty, orderId },
      })
    }
    return
  }
  const inv = await loadInventory(businessId, tx)
  if (!inv) return
  await consumeForOrder(tx, businessId, orderId, items, inv.recipes, inv.ingredients, { force: true })
}

// --- Reportes ---

export async function listMovements(businessId: string, limit = 60): Promise<Movement[]> {
  const rows = await prisma.inventoryMovement.findMany({
    where: { businessId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { ingredient: { select: { name: true, unit: true } } },
  })
  return rows.map((r) => ({
    id: r.id,
    ingredientId: r.ingredientId,
    ingredientName: r.ingredient.name,
    unit: toUnit(r.ingredient.unit),
    kind: r.kind as MovementKind,
    quantity: round3(r.quantity),
    unitCost: r.unitCost,
    orderId: r.orderId,
    note: r.note,
    createdAt: r.createdAt.toISOString(),
  }))
}

export interface InventoryReport {
  /** Ventas (pedidos no anulados) del período. */
  revenue: number
  orders: number
  /** Costo de la materia prima usada en esos pedidos (neto de anulaciones). */
  costOfSales: number
  /** Ventas de productos con receta en pedidos que descontaron materia prima: base del margen. */
  revenueWithRecipe: number
  purchases: number
  /** Pérdidas por merma o conteo (ajustes negativos), en plata. */
  shrinkage: number
  /** Lo que vale hoy el inventario a costo. */
  stockValue: number
}

export async function getInventoryReport(businessId: string, since: Date): Promise<InventoryReport> {
  const [orders, moves, ingredients, recipes] = await Promise.all([
    prisma.order.findMany({
      where: { businessId, status: { not: 'cancelado' }, createdAt: { gte: since } },
      select: { id: true, total: true, items: { select: { productId: true, unitPrice: true, quantity: true } } },
    }),
    prisma.inventoryMovement.findMany({ where: { businessId, createdAt: { gte: since } }, select: { kind: true, quantity: true, unitCost: true, orderId: true } }),
    listIngredients(businessId),
    listRecipes(businessId),
  ])
  const withRecipe = new Set(recipes.map((r) => r.productId))
  // El margen solo se calcula sobre pedidos que de verdad descontaron materia
  // prima: los anteriores a activar el inventario no tienen costo registrado.
  const costed = new Set(moves.filter((m) => m.kind === 'consumo' && m.orderId).map((m) => m.orderId))
  let costOfSales = 0
  let purchases = 0
  let shrinkage = 0
  for (const m of moves) {
    const value = m.quantity * m.unitCost
    if (m.kind === 'consumo' || m.kind === 'anulacion') costOfSales -= value
    else if (m.kind === 'compra') purchases += value
    else if (m.kind === 'ajuste' && value < 0) shrinkage -= value
  }
  return {
    revenue: orders.reduce((s, o) => s + o.total, 0),
    orders: orders.length,
    costOfSales: Math.round(costOfSales),
    revenueWithRecipe: orders.filter((o) => costed.has(o.id)).reduce(
      (s, o) => s + o.items.filter((i) => withRecipe.has(i.productId)).reduce((a, i) => a + i.unitPrice * i.quantity, 0),
      0,
    ),
    purchases: Math.round(purchases),
    shrinkage: Math.round(shrinkage),
    stockValue: Math.round(ingredients.reduce((s, i) => s + Math.max(0, i.stock) * i.unitCost, 0)),
  }
}
