import { isSoldOut } from './catalog'
import { listIngredients, round3, UNIT_LABEL } from './inventory'
import { getSalesSettings } from './payments'
import { listSellableProducts } from './store'

/**
 * Alertas de inventario para el panel del local. Salen del estado actual (no de
 * un historial): mientras falte algo, el aviso sigue a la vista; al reponer, se
 * va solo. El correo se manda aparte, en el momento en que algo se acaba, para
 * cuando el dueño no está mirando el panel.
 */
export interface StockAlerts {
  /** Ingredientes agotados o bajo su mínimo. */
  ingredients: { name: string; text: string; out: boolean }[]
  /** Productos que el agente dejó de ofrecer por falta de stock o de materia prima. */
  soldOut: string[]
  inventory: boolean
}

export async function getStockAlerts(businessId: string): Promise<StockAlerts> {
  const [sales, products] = await Promise.all([getSalesSettings(businessId), listSellableProducts(businessId)])
  const soldOut = products.filter((p) => p.active && isSoldOut(p)).map((p) => p.name)
  if (!sales.ingredientsEnabled) return { ingredients: [], soldOut, inventory: false }
  const ingredients = (await listIngredients(businessId))
    .filter((i) => i.stock <= 0 || (i.minStock > 0 && i.stock <= i.minStock))
    .map((i) => ({
      name: i.name,
      out: i.stock <= 0,
      text: i.stock <= 0 ? 'se acabó' : `quedan ${round3(i.stock).toLocaleString('es-CL')} ${UNIT_LABEL[i.unit]}`,
    }))
  return { ingredients, soldOut, inventory: true }
}

