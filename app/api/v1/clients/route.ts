import { apiJson, apiRoute, parseBoolParam, parsePage } from '@/lib/apiV1'
import { listClients } from '@/lib/apiV1Data'

export const dynamic = 'force-dynamic'

/** Negocios cliente. Por defecto sin las cuentas de demostración (`include_demo=true` las suma). */
export const GET = apiRoute(async ({ url }) => {
  const page = parsePage(url)
  return apiJson(await listClients(page, { includeDemo: parseBoolParam(url, 'include_demo') ?? false }))
})
