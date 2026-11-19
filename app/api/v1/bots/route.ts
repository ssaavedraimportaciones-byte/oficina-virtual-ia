import { apiJson, apiRoute, parseBoolParam, parsePage } from '@/lib/apiV1'
import { listBots } from '@/lib/apiV1Data'

export const dynamic = 'force-dynamic'

/** Un bot por negocio. Incluye las cuentas de demostración (marcadas con `isDemo`), que también son un canal de venta. */
export const GET = apiRoute(async ({ url }) => {
  const page = parsePage(url)
  return apiJson(await listBots(page, { includeDemo: parseBoolParam(url, 'include_demo') ?? true }))
})
