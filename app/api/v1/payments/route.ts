import { apiJson, apiRoute, parseDateParam, parseEnumParam, parsePage } from '@/lib/apiV1'
import { listPayments, PAYMENT_STATUSES } from '@/lib/apiV1Data'

export const dynamic = 'force-dynamic'

export const GET = apiRoute(async ({ url }) => {
  const page = parsePage(url)
  return apiJson(
    await listPayments(page, {
      from: parseDateParam(url, 'from'),
      to: parseDateParam(url, 'to'),
      status: parseEnumParam(url, 'status', PAYMENT_STATUSES),
    }),
  )
})
