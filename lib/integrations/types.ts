/**
 * Integraciones de catálogo: traer los productos que el negocio ya tiene
 * cargados en su tienda, para que el agente sepa qué vender sin cargarlos a
 * mano. Cada plataforma (WooCommerce, Jumpseller, …) implementa un adaptador
 * que devuelve esta forma común; el resto del sistema no sabe de qué tienda
 * vino.
 */
export interface CatalogItem {
  /** Nombre del producto, como lo verá el cliente. */
  name: string
  /** Precio en pesos enteros (sin decimales). */
  price: number
  /** Unidades en stock; null = la tienda no lleva control de ese producto. */
  stock: number | null
  /** Si está publicado/activo en la tienda. Los pausados no se importan. */
  active: boolean
}

export type CatalogSourceId = 'woocommerce' | 'jumpseller'

/** Adaptador de una plataforma: recibe credenciales y devuelve el catálogo. */
export interface CatalogAdapter {
  id: CatalogSourceId
  label: string
  /** `fetchImpl` se inyecta en los tests; por defecto usa el fetch global. */
  fetchCatalog(credentials: Record<string, string>, fetchImpl?: typeof fetch): Promise<CatalogItem[]>
}

/** Error con mensaje pensado para mostrarle al dueño del negocio. */
export class IntegrationError extends Error {}

/**
 * El servidor va a consultar esta URL (la pone el dueño del negocio), así que
 * se bloquean direcciones internas: evita que alguien use la importación para
 * sondear servicios privados de la red (SSRF). Solo http/https a un host que no
 * sea local ni de rango privado.
 */
export function assertPublicHttpUrl(raw: string): URL {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new IntegrationError('La dirección de la tienda no es válida.')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new IntegrationError('La dirección debe empezar con http:// o https://')
  }
  const host = url.hostname.toLowerCase()
  const blocked =
    host === 'localhost' ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host === '0.0.0.0' ||
    host === '::1' ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host)
  if (blocked) {
    throw new IntegrationError('Esa dirección apunta a una red interna y no se puede usar.')
  }
  return url
}

/** Normaliza un precio que puede venir como "4500.00", "4.500" o número. */
export function toPesos(value: unknown): number {
  if (typeof value === 'number') return Math.max(0, Math.round(value))
  const raw = String(value ?? '').trim()
  if (!raw) return 0
  // Quita separadores de miles y deja el punto o coma decimal como punto.
  const cleaned = raw.replace(/[^0-9.,]/g, '')
  const normalized =
    cleaned.includes(',') && cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')
      ? cleaned.replace(/\./g, '').replace(',', '.')
      : cleaned.replace(/,/g, '')
  const n = Number.parseFloat(normalized)
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0
}
