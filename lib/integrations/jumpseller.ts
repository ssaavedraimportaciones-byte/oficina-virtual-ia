import { type CatalogAdapter, type CatalogItem, IntegrationError, toPesos } from './types'

interface JumpsellerEntry {
  product?: {
    name?: string
    price?: string | number
    stock?: number | null
    stock_unlimited?: boolean
    status?: string
  }
}

/**
 * Jumpseller (plataforma chilena de tiendas online). Autenticación con el email
 * de la cuenta y un API token (Jumpseller → Cuenta → API). No hay que registrar
 * ninguna app: el token lo genera el negocio.
 */
export const jumpseller: CatalogAdapter = {
  id: 'jumpseller',
  label: 'Jumpseller',
  async fetchCatalog(credentials, fetchImpl = fetch) {
    const login = (credentials.login ?? '').trim()
    const token = (credentials.authToken ?? '').trim()
    if (!login || !token) {
      throw new IntegrationError('Falta el email de la cuenta o el API token de Jumpseller.')
    }
    const q = `login=${encodeURIComponent(login)}&authtoken=${encodeURIComponent(token)}`

    const items: CatalogItem[] = []
    for (let page = 1; page <= 50; page += 1) {
      const url = `https://api.jumpseller.com/v1/products.json?${q}&page=${page}&limit=100`
      let res: Response
      try {
        res = await fetchImpl(url)
      } catch {
        throw new IntegrationError('No se pudo conectar con Jumpseller.')
      }
      if (res.status === 401 || res.status === 403) {
        throw new IntegrationError('El email o el API token de Jumpseller no son válidos.')
      }
      if (!res.ok) {
        throw new IntegrationError(`Jumpseller respondió con un error (${res.status}).`)
      }
      const batch = (await res.json()) as JumpsellerEntry[]
      if (!Array.isArray(batch) || batch.length === 0) break
      for (const entry of batch) {
        const p = entry.product
        const name = (p?.name ?? '').trim()
        if (!p || !name) continue
        items.push({
          name,
          price: toPesos(p.price),
          stock: p.stock_unlimited ? null : (p.stock ?? 0),
          active: p.status === undefined || p.status === 'available',
        })
      }
      if (batch.length < 100) break
    }
    return items
  },
}
