import type { Product } from './types'

export function isSoldOut(product: Product): boolean {
  return product.stock !== null && product.stock <= 0
}

/** Un producto se puede pedir si está activo y tiene stock (o no lleva control). */
export function isOrderable(product: Product): boolean {
  return product.active && !isSoldOut(product)
}

export function formatPrice(value: number): string {
  return `$${value.toLocaleString('es-AR')}`
}

export function stockLabel(product: Product): string {
  if (product.stock === null) return 'sin control de stock'
  if (product.stock <= 0) return 'AGOTADO'
  return `${product.stock} en stock`
}

export function findProductByName(products: Product[], name: string): Product | null {
  const normalized = name.trim().toLowerCase()
  return (
    products.find((p) => p.name.toLowerCase() === normalized) ??
    products.find((p) => p.name.toLowerCase().includes(normalized)) ??
    products.find((p) => normalized.includes(p.name.toLowerCase())) ??
    null
  )
}

export interface RequestedItem {
  producto: string
  cantidad: number
}

export type StockCheck =
  | { ok: true; items: { product: Product; quantity: number }[]; total: number }
  | { ok: false; reason: string }

/**
 * Valida un pedido completo contra el catálogo antes de crearlo. Si algo falla
 * devuelve un motivo redactado para que el agente se lo explique al cliente,
 * incluyendo cuántas unidades quedan cuando el problema es de stock.
 */
export function checkOrder(products: Product[], requested: RequestedItem[]): StockCheck {
  if (requested.length === 0) {
    return { ok: false, reason: 'El pedido no tiene productos.' }
  }

  const items: { product: Product; quantity: number }[] = []

  for (const line of requested) {
    const quantity = Math.floor(Number(line.cantidad))
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return { ok: false, reason: `La cantidad de "${line.producto}" no es válida.` }
    }

    const product = findProductByName(products, line.producto ?? '')
    if (!product || !product.active) {
      const available = products.filter(isOrderable).map((p) => p.name)
      return {
        ok: false,
        reason: `No tenemos "${line.producto}" en el catálogo. Disponibles: ${available.join(', ') || 'ninguno por ahora'}.`,
      }
    }

    if (isSoldOut(product)) {
      return {
        ok: false,
        reason: `"${product.name}" está AGOTADO. Ofrecele otra opción al cliente y no lo agregues al pedido.`,
      }
    }

    if (product.stock !== null && quantity > product.stock) {
      return {
        ok: false,
        reason: `De "${product.name}" quedan solo ${product.stock} unidades y pidió ${quantity}. Preguntale si quiere llevar ${product.stock}.`,
      }
    }

    items.push({ product, quantity })
  }

  const total = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0)
  return { ok: true, items, total }
}
