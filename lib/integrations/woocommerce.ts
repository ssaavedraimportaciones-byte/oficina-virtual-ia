import { assertPublicHttpUrl, type CatalogAdapter, type CatalogItem, IntegrationError, toPesos } from './types'

interface WooProduct {
  name?: string
  price?: string | number
  regular_price?: string | number
  manage_stock?: boolean
  stock_quantity?: number | null
  status?: string
}

/**
 * WooCommerce (tiendas en WordPress). Autenticación simple: el dueño genera en
 * su tienda una clave de API (WooCommerce → Ajustes → Avanzado → API REST) con
 * permiso de solo lectura, y pega la URL, la Consumer Key y la Consumer Secret.
 * No necesitamos registrar ninguna app: la clave la crea el negocio.
 */
export const woocommerce: CatalogAdapter = {
  id: 'woocommerce',
  label: 'WooCommerce',
  async fetchCatalog(credentials, fetchImpl = fetch) {
    const storeUrl = (credentials.storeUrl ?? '').trim().replace(/\/+$/, '')
    const key = (credentials.consumerKey ?? '').trim()
    const secret = (credentials.consumerSecret ?? '').trim()
    assertPublicHttpUrl(storeUrl)
    if (!key || !secret) {
      throw new IntegrationError('Falta la Consumer Key o la Consumer Secret de WooCommerce.')
    }

    const auth = 'Basic ' + Buffer.from(`${key}:${secret}`).toString('base64')
    const items: CatalogItem[] = []
    // WooCommerce pagina de a 100; se recorren todas las páginas (con tope).
    for (let page = 1; page <= 50; page += 1) {
      const url = `${storeUrl}/wp-json/wc/v3/products?per_page=100&page=${page}`
      let res: Response
      try {
        res = await fetchImpl(url, { headers: { Authorization: auth } })
      } catch {
        throw new IntegrationError('No se pudo conectar con la tienda. Revisa la dirección.')
      }
      if (res.status === 401 || res.status === 403) {
        throw new IntegrationError('La Consumer Key o la Secret no son válidas.')
      }
      if (res.status === 404) {
        throw new IntegrationError('No se encontró la API de WooCommerce en esa dirección.')
      }
      if (!res.ok) {
        throw new IntegrationError(`La tienda respondió con un error (${res.status}).`)
      }
      const batch = (await res.json()) as WooProduct[]
      if (!Array.isArray(batch) || batch.length === 0) break
      for (const p of batch) {
        const name = (p.name ?? '').trim()
        if (!name) continue
        items.push({
          name,
          price: toPesos(p.price ?? p.regular_price),
          stock: p.manage_stock ? (p.stock_quantity ?? 0) : null,
          active: p.status === undefined || p.status === 'publish',
        })
      }
      if (batch.length < 100) break
    }
    return items
  },
}
