import { listProducts, addProduct, updateProduct } from '../store'
import { jumpseller } from './jumpseller'
import { type CatalogAdapter, type CatalogItem, type CatalogSourceId, IntegrationError } from './types'
import { woocommerce } from './woocommerce'

export { IntegrationError } from './types'
export type { CatalogSourceId } from './types'

const ADAPTERS: Record<CatalogSourceId, CatalogAdapter> = {
  woocommerce,
  jumpseller,
}

export const CATALOG_SOURCES = Object.values(ADAPTERS).map((a) => ({ id: a.id, label: a.label }))

export function getAdapter(id: string): CatalogAdapter | null {
  return (ADAPTERS as Record<string, CatalogAdapter>)[id] ?? null
}

export interface ImportSummary {
  total: number
  created: number
  updated: number
  skipped: number
}

/**
 * Deja una lista de productos en el catálogo del negocio: actualiza por
 * nombre lo que ya existe (precio y stock) y crea lo nuevo. No borra ni
 * desactiva nada que el dueño haya cargado a mano. Es seguro repetirlo: vuelve
 * a sincronizar sin duplicar. La usan tanto la importación desde tiendas
 * (WooCommerce, Jumpseller) como la importación desde un archivo (PDF, Excel,
 * foto de la carta).
 */
export async function applyCatalogItems(businessId: string, incoming: CatalogItem[]): Promise<ImportSummary> {
  const existing = await listProducts(businessId)
  const byName = new Map(existing.map((p) => [p.name.trim().toLowerCase(), p]))

  // Puede traer el mismo nombre repetido: se procesa una sola vez.
  const unique = dedupe(incoming)
  const summary: ImportSummary = {
    total: incoming.length,
    created: 0,
    updated: 0,
    skipped: incoming.length - unique.length,
  }
  for (const item of unique) {
    const name = item.name.trim()
    const found = byName.get(name.toLowerCase())
    if (found) {
      await updateProduct(found.id, { name, price: item.price, stock: item.stock, active: item.active })
      summary.updated += 1
    } else {
      await addProduct({ businessId, name, price: item.price, stock: item.stock })
      summary.created += 1
    }
  }
  return summary
}

/**
 * Trae el catálogo de la plataforma y lo deja en el catálogo del negocio.
 */
export async function importCatalog(
  businessId: string,
  source: string,
  credentials: Record<string, string>,
  fetchImpl?: typeof fetch,
): Promise<ImportSummary> {
  const adapter = getAdapter(source)
  if (!adapter) throw new IntegrationError('Esa plataforma todavía no está disponible.')

  const incoming = await adapter.fetchCatalog(credentials, fetchImpl)
  return applyCatalogItems(businessId, incoming)
}

function dedupe(items: CatalogItem[]): CatalogItem[] {
  const out: CatalogItem[] = []
  const seen = new Set<string>()
  for (const it of items) {
    const k = it.name.trim().toLowerCase()
    if (!k || seen.has(k)) continue
    seen.add(k)
    out.push(it)
  }
  return out
}
