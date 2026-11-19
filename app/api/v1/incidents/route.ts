import { apiJson, apiRoute, parseDateParam, parseEnumParam, parsePage } from '@/lib/apiV1'
import { INCIDENT_SEVERITIES, INCIDENT_SOURCES, listIncidents } from '@/lib/apiV1Data'

export const dynamic = 'force-dynamic'

export const GET = apiRoute(async ({ url }) => {
  const page = parsePage(url)
  return apiJson(
    await listIncidents(page, {
      from: parseDateParam(url, 'from'),
      to: parseDateParam(url, 'to'),
      severity: parseEnumParam(url, 'severity', INCIDENT_SEVERITIES),
      source: parseEnumParam(url, 'source', INCIDENT_SOURCES),
    }),
  )
})
