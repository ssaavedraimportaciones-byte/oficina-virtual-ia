import { apiJson, apiRoute, parseDateParam, parsePage } from '@/lib/apiV1'
import { listInvoices } from '@/lib/apiV1Data'

export const dynamic = 'force-dynamic'

export const GET = apiRoute(async ({ url }) => {
  const page = parsePage(url)
  return apiJson(await listInvoices(page, { from: parseDateParam(url, 'from'), to: parseDateParam(url, 'to') }))
})
