import pkg from '../package.json'
import { DEFAULT_LIMIT, MAX_LIMIT, RATE_LIMIT_PER_MINUTE } from './apiV1'

/**
 * Documento OpenAPI 3.1 de la API v1 (solo lectura). Se sirve en
 * /api/v1/openapi.json y las pruebas comprueban que cada ruta real esté acá y
 * viceversa, así la documentación no se desfasa del código.
 */

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` })
const iso = { type: 'string', format: 'date-time', description: 'Fecha y hora en ISO 8601 (UTC).' }
const nullableIso = { type: ['string', 'null'], format: 'date-time' }
const clp = { type: 'integer', description: 'Monto en pesos chilenos (CLP), entero.' }
const clientRefs = {
  type: 'array',
  description: 'Negocios del cliente al que pertenece.',
  items: ref('ClientRef'),
}

const errorResponses = {
  '400': { description: 'Parámetros inválidos.', content: { 'application/json': { schema: ref('Error'), example: { error: { code: 'bad_request', message: 'limit debe ser un entero entre 1 y 100.' } } } } },
  '401': { description: 'Falta la clave o no es válida.', content: { 'application/json': { schema: ref('Error'), example: { error: { code: 'unauthorized', message: 'La clave no es válida.' } } } } },
  '429': {
    description: `Más de ${RATE_LIMIT_PER_MINUTE} pedidos por minuto con la misma clave.`,
    headers: { 'Retry-After': { description: 'Segundos a esperar.', schema: { type: 'integer' } } },
    content: { 'application/json': { schema: ref('Error'), example: { error: { code: 'rate_limited', message: `Máximo ${RATE_LIMIT_PER_MINUTE} pedidos por minuto.` } } } },
  },
}

const limitParam = { name: 'limit', in: 'query', description: `Elementos por página (1 a ${MAX_LIMIT}).`, schema: { type: 'integer', minimum: 1, maximum: MAX_LIMIT, default: DEFAULT_LIMIT } }
const cursorParam = { name: 'cursor', in: 'query', description: 'Cursor opaco: usa `page.nextCursor` de la respuesta anterior.', schema: { type: 'string' } }
const fromParam = (what: string) => ({ name: 'from', in: 'query', description: `Desde (inclusive): ${what}. ISO 8601.`, schema: { type: 'string', format: 'date-time' } })
const toParam = (what: string) => ({ name: 'to', in: 'query', description: `Hasta (inclusive): ${what}. ISO 8601.`, schema: { type: 'string', format: 'date-time' } })
const idParam = (what: string) => ({ name: 'id', in: 'path', required: true, description: `Identificador ${what}.`, schema: { type: 'string' } })

function listOf(schema: string, example: unknown) {
  return {
    description: 'Página de resultados, del más reciente al más antiguo.',
    content: {
      'application/json': {
        schema: { type: 'object', required: ['data', 'page'], properties: { data: { type: 'array', items: ref(schema) }, page: ref('Page') } },
        example: { data: [example], page: { limit: DEFAULT_LIMIT, hasMore: false, nextCursor: null } },
      },
    },
  }
}

function one(schema: string, example: unknown) {
  return {
    description: 'Resultado.',
    content: { 'application/json': { schema: { type: 'object', required: ['data'], properties: { data: ref(schema) } }, example: { data: example } } },
  }
}

const clientExample = {
  id: '7e1af008-0ffc-4ea3-af58-ae1e4b0b1815',
  name: 'Completos Don Tito',
  industry: 'Comida rápida',
  rut: '76.543.210-3',
  plan: 'BASICO',
  planLabel: 'Básico',
  status: 'activo',
  isDemo: false,
  createdAt: '2026-10-07T17:30:29.583Z',
  channels: { whatsapp: true, instagram: false },
  setupFeePaid: true,
}
const botExample = {
  id: '7e1af008-0ffc-4ea3-af58-ae1e4b0b1815',
  clientId: '7e1af008-0ffc-4ea3-af58-ae1e4b0b1815',
  name: 'Rodri',
  businessName: 'Completos Don Tito',
  isDemo: false,
  channels: { whatsapp: true, instagram: false },
  state: 'operativo',
  reasons: [],
  lastMessageAt: '2026-11-19T21:14:02.000Z',
  lastAgentReplyAt: '2026-11-19T21:14:05.000Z',
  repliesThisMonth: 412,
  monthlyReplyLimit: 1500,
  errorsLast24h: 0,
}
const incidentExample = {
  id: 'b1c0a1e2-1f64-4b5b-9d77-2f3a0c9f1d10',
  source: 'ia',
  severity: 'critica',
  code: 'http_402',
  message: 'La cuenta del proveedor de IA no tiene saldo.',
  clientId: '7e1af008-0ffc-4ea3-af58-ae1e4b0b1815',
  occurredAt: '2026-11-19T20:02:11.000Z',
}

export function buildOpenApi(origin = 'https://zerovistochile.com') {
  return {
    openapi: '3.1.0',
    info: {
      title: 'ZeroVisto API',
      version: pkg.version,
      summary: 'API de solo lectura para monitorear ZeroVisto desde sistemas externos (Houston Ops).',
      description: [
        'API REST **versionada y de solo lectura**: no hay endpoints de escritura, borrado ni cambios de plan.',
        '',
        '**Autenticación.** Header `Authorization: Bearer <API_KEY>`. La clave la genera un administrador desde `/admin/api` (se muestra una sola vez; se puede revocar y rotar). Tiene alcance `read`. Sin clave válida: `401` en JSON.',
        '',
        `**Límites.** ${RATE_LIMIT_PER_MINUTE} pedidos por minuto por clave (\`429\` con \`Retry-After\`). Cada acceso queda registrado.`,
        '',
        `**Paginación.** Parámetros \`limit\` (1 a ${MAX_LIMIT}, por defecto ${DEFAULT_LIMIT}) y \`cursor\`. Las listas vienen en \`{ data, page: { limit, hasMore, nextCursor } }\`; pasa \`nextCursor\` como \`cursor\` para la página siguiente.`,
        '',
        '**Formatos.** JSON siempre. Fechas en ISO 8601 (UTC). Montos en CLP como enteros. Errores: `{ "error": { "code", "message" } }`.',
        '',
        '**Privacidad.** Nunca se exponen contraseñas, tokens, datos de tarjeta ni el contenido de las conversaciones de los clientes finales.',
        '',
        '**Datos que dependen de otros sistemas.** Pagos, suscripciones y facturas se registran desde los avisos firmados de Stripe: hasta que Stripe esté conectado, esas listas vienen vacías. `folio` y `siiStatus` de las facturas son `null` mientras no haya un emisor de DTE conectado.',
      ].join('\n'),
      contact: { name: 'ZeroVisto', email: 'contacto@zerovistochile.com' },
    },
    servers: [{ url: `${origin}/api/v1`, description: 'Producción' }],
    security: [{ bearerAuth: [] }],
    tags: [
      { name: 'Estado', description: 'Disponibilidad del servicio.' },
      { name: 'Métricas' },
      { name: 'Clientes' },
      { name: 'Bots' },
      { name: 'Cobros' },
      { name: 'Incidentes' },
    ],
    paths: {
      '/health': {
        get: {
          operationId: 'getHealth',
          tags: ['Estado'],
          summary: 'Estado del servicio y versión',
          description: 'Público: no requiere clave.',
          security: [],
          responses: {
            '200': one('Health', { status: 'ok', database: 'ok', apiVersion: 'v1', version: pkg.version, commit: 'a1b2c3d', timestamp: '2026-11-19T21:00:00.000Z' }),
            '503': { description: 'Servicio degradado (la base de datos no responde).', content: { 'application/json': { schema: { type: 'object', properties: { data: ref('Health') } } } } },
          },
        },
      },
      '/metrics/summary': {
        get: {
          operationId: 'getMetricsSummary',
          tags: ['Métricas'],
          summary: 'Resumen de métricas del negocio',
          description: 'Clientes activos, bots en vivo, mensajes del día y del mes (hora de Chile, sin el simulador), mediana del tiempo de respuesta de los últimos 30 días y tasa de errores de las últimas 24 horas.',
          responses: {
            '200': one('MetricsSummary', {
              generatedAt: '2026-11-19T21:00:00.000Z',
              timezone: 'America/Santiago',
              clients: { total: 12, active: 10, inImplementation: 2 },
              bots: { total: 15, live: 13, operational: 12, degraded: 1, stopped: 0, withoutChannel: 2 },
              messages: {
                today: { total: 214, fromContacts: 98, fromAgent: 110, fromHumans: 6 },
                month: { total: 5120, fromContacts: 2301, fromAgent: 2688, fromHumans: 131 },
                excludes: 'simulador',
              },
              responseTime: { medianSeconds: 3.3, sampleSize: 2688, windowDays: 30 },
              errors: { last24h: 2, rateLast24h: 0.0178, agentReplies24h: 110 },
            }),
            ...errorResponses,
          },
          parameters: [],
        },
      },
      '/clients': {
        get: {
          operationId: 'listClients',
          tags: ['Clientes'],
          summary: 'Negocios cliente',
          parameters: [
            limitParam,
            cursorParam,
            { name: 'include_demo', in: 'query', description: 'Incluir las cuentas de demostración (por defecto `false`).', schema: { type: 'boolean', default: false } },
          ],
          responses: { '200': listOf('Client', clientExample), ...errorResponses },
        },
      },
      '/clients/{id}': {
        get: {
          operationId: 'getClient',
          tags: ['Clientes'],
          summary: 'Un negocio cliente',
          parameters: [idParam('del negocio')],
          responses: {
            '200': one('Client', clientExample),
            '404': { description: 'No existe.', content: { 'application/json': { schema: ref('Error'), example: { error: { code: 'not_found', message: 'Cliente no encontrado.' } } } } },
            ...errorResponses,
          },
        },
      },
      '/bots': {
        get: {
          operationId: 'listBots',
          tags: ['Bots'],
          summary: 'Bots (un agente por negocio) con su estado',
          parameters: [
            limitParam,
            cursorParam,
            { name: 'include_demo', in: 'query', description: 'Incluir las cuentas de demostración (por defecto `true`: también son un canal de venta).', schema: { type: 'boolean', default: true } },
          ],
          responses: { '200': listOf('Bot', botExample), ...errorResponses },
        },
      },
      '/bots/{id}/status': {
        get: {
          operationId: 'getBotStatus',
          tags: ['Bots'],
          summary: 'Estado detallado de un bot',
          description: 'Incluye la última actividad (solo fechas, nunca el texto de los mensajes) y los errores de los últimos 7 días.',
          parameters: [idParam('del bot (el mismo del negocio)')],
          responses: {
            '200': one('BotStatus', { ...botExample, checkedAt: '2026-11-19T21:00:00.000Z', recentErrors: [incidentExample] }),
            '404': { description: 'No existe.', content: { 'application/json': { schema: ref('Error'), example: { error: { code: 'not_found', message: 'Bot no encontrado.' } } } } },
            ...errorResponses,
          },
        },
      },
      '/subscriptions': {
        get: {
          operationId: 'listSubscriptions',
          tags: ['Cobros'],
          summary: 'Suscripciones',
          description: 'Plan, monto, estado (`activa`, `vencida`, `cancelada`), próximo cobro y días de atraso. `billing: "cortesia"` = plan dado por el administrador, sin cobro.',
          parameters: [limitParam, cursorParam],
          responses: {
            '200': listOf('Subscription', {
              id: 'sub_1Q2w3e4r5t',
              clients: [{ id: '7e1af008-0ffc-4ea3-af58-ae1e4b0b1815', name: 'Completos Don Tito' }],
              plan: 'BASICO',
              planLabel: 'Básico',
              amountClp: 45000,
              status: 'activa',
              billing: 'stripe',
              startedAt: '2026-10-08T12:00:00.000Z',
              nextChargeAt: '2026-12-08T12:00:00.000Z',
              canceledAt: null,
              daysPastDue: 0,
            }),
            ...errorResponses,
          },
        },
      },
      '/payments': {
        get: {
          operationId: 'listPayments',
          tags: ['Cobros'],
          summary: 'Pagos recibidos',
          parameters: [
            limitParam,
            cursorParam,
            fromParam('fecha del pago'),
            toParam('fecha del pago'),
            { name: 'status', in: 'query', description: 'Estado del pago.', schema: { type: 'string', enum: ['pagado'] } },
          ],
          responses: {
            '200': listOf('Payment', {
              id: '0d6f6a56-5c0e-4c3a-8a53-6e7a7a2a3b11',
              clients: [{ id: '7e1af008-0ffc-4ea3-af58-ae1e4b0b1815', name: 'Completos Don Tito' }],
              amountClp: 235000,
              method: 'stripe',
              status: 'pagado',
              paidAt: '2026-10-08T12:01:30.000Z',
              invoiceId: '4a9d2f0e-3d65-4a39-a3ab-0a6a9a1b7c22',
            }),
            ...errorResponses,
          },
        },
      },
      '/invoices': {
        get: {
          operationId: 'listInvoices',
          tags: ['Cobros'],
          summary: 'Facturas emitidas',
          description: '`folio` y `siiStatus` vienen `null` mientras no haya un emisor de DTE conectado.',
          parameters: [limitParam, cursorParam, fromParam('fecha de emisión'), toParam('fecha de emisión')],
          responses: {
            '200': listOf('Invoice', {
              id: '4a9d2f0e-3d65-4a39-a3ab-0a6a9a1b7c22',
              number: 'ZV-0001',
              folio: null,
              siiStatus: null,
              clients: [{ id: '7e1af008-0ffc-4ea3-af58-ae1e4b0b1815', name: 'Completos Don Tito' }],
              amountClp: 235000,
              status: 'pagada',
              paid: true,
              issuedAt: '2026-10-08T12:00:00.000Z',
              dueDate: null,
              paidAt: '2026-10-08T12:01:30.000Z',
            }),
            ...errorResponses,
          },
        },
      },
      '/incidents': {
        get: {
          operationId: 'listIncidents',
          tags: ['Incidentes'],
          summary: 'Fallos de integración (WhatsApp, Instagram, IA, pagos)',
          parameters: [
            limitParam,
            cursorParam,
            fromParam('fecha del incidente'),
            toParam('fecha del incidente'),
            { name: 'severity', in: 'query', schema: { type: 'string', enum: ['baja', 'media', 'alta', 'critica'] } },
            { name: 'source', in: 'query', schema: { type: 'string', enum: ['whatsapp', 'instagram', 'ia', 'pagos'] } },
          ],
          responses: { '200': listOf('Incident', incidentExample), ...errorResponses },
        },
      },
    },
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', description: 'Clave de API de solo lectura (`zvk_live_…`), generada en /admin/api.' },
      },
      schemas: {
        Error: { type: 'object', required: ['error'], properties: { error: { type: 'object', required: ['code', 'message'], properties: { code: { type: 'string' }, message: { type: 'string' } } } } },
        Page: {
          type: 'object',
          required: ['limit', 'hasMore', 'nextCursor'],
          properties: { limit: { type: 'integer' }, hasMore: { type: 'boolean' }, nextCursor: { type: ['string', 'null'], description: 'Pásalo como `cursor` para pedir la página siguiente.' } },
        },
        ClientRef: { type: 'object', required: ['id', 'name'], properties: { id: { type: 'string' }, name: { type: 'string' } } },
        Health: {
          type: 'object',
          required: ['status', 'database', 'apiVersion', 'version', 'timestamp'],
          properties: {
            status: { type: 'string', enum: ['ok', 'degraded'] },
            database: { type: 'string', enum: ['ok', 'error'] },
            apiVersion: { type: 'string' },
            version: { type: 'string' },
            commit: { type: ['string', 'null'] },
            timestamp: iso,
          },
        },
        MetricsSummary: {
          type: 'object',
          properties: {
            generatedAt: iso,
            timezone: { type: 'string' },
            clients: { type: 'object', properties: { total: { type: 'integer' }, active: { type: 'integer', description: 'Con WhatsApp o Instagram conectado.' }, inImplementation: { type: 'integer' } } },
            bots: {
              type: 'object',
              properties: {
                total: { type: 'integer' },
                live: { type: 'integer', description: 'Operativos + degradados.' },
                operational: { type: 'integer' },
                degraded: { type: 'integer' },
                stopped: { type: 'integer' },
                withoutChannel: { type: 'integer' },
              },
            },
            messages: {
              type: 'object',
              properties: {
                today: ref('MessageCounts'),
                month: ref('MessageCounts'),
                excludes: { type: 'string', description: 'Qué canal no se cuenta.' },
              },
            },
            responseTime: {
              type: 'object',
              description: 'Mediana de segundos entre el mensaje del cliente y la respuesta del agente (últimos 30 días, sin el simulador).',
              properties: { medianSeconds: { type: ['number', 'null'] }, sampleSize: { type: 'integer' }, windowDays: { type: 'integer' } },
            },
            errors: {
              type: 'object',
              properties: {
                last24h: { type: 'integer', description: 'Incidentes de WhatsApp, Instagram e IA en 24 h.' },
                rateLast24h: { type: 'number', description: 'Incidentes / (respuestas del agente + incidentes) en 24 h.' },
                agentReplies24h: { type: 'integer' },
              },
            },
          },
        },
        MessageCounts: { type: 'object', properties: { total: { type: 'integer' }, fromContacts: { type: 'integer' }, fromAgent: { type: 'integer' }, fromHumans: { type: 'integer' } } },
        Client: {
          type: 'object',
          required: ['id', 'name', 'plan', 'status', 'createdAt', 'channels'],
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            industry: { type: 'string', description: 'Rubro.' },
            rut: { type: ['string', 'null'], description: 'RUT de la empresa, si fue cargado.' },
            plan: { type: 'string', enum: ['FREE', 'BASICO', 'NEGOCIOS', 'ILIMITADO'] },
            planLabel: { type: 'string' },
            status: { type: 'string', enum: ['activo', 'en_implementacion'], description: '`activo` = tiene WhatsApp o Instagram conectado.' },
            isDemo: { type: 'boolean' },
            createdAt: iso,
            channels: { type: 'object', properties: { whatsapp: { type: 'boolean' }, instagram: { type: 'boolean' } } },
            setupFeePaid: { type: 'boolean', description: 'Si la implementación está pagada.' },
          },
        },
        Bot: {
          type: 'object',
          required: ['id', 'clientId', 'state'],
          properties: {
            id: { type: 'string' },
            clientId: { type: 'string' },
            name: { type: 'string', description: 'Nombre del agente.' },
            businessName: { type: 'string' },
            isDemo: { type: 'boolean' },
            channels: { type: 'object', properties: { whatsapp: { type: 'boolean' }, instagram: { type: 'boolean' } } },
            state: { type: 'string', enum: ['operativo', 'degradado', 'detenido', 'sin_canal'] },
            reasons: { type: 'array', items: { type: 'string', enum: ['sin_canal', 'mantenimiento', 'ia_no_configurada', 'cupo_agotado', 'errores_recientes'] } },
            lastMessageAt: nullableIso,
            lastAgentReplyAt: nullableIso,
            repliesThisMonth: { type: 'integer' },
            monthlyReplyLimit: { type: ['integer', 'null'], description: '`null` = sin límite.' },
            errorsLast24h: { type: 'integer' },
          },
        },
        BotStatus: {
          allOf: [ref('Bot'), { type: 'object', properties: { checkedAt: iso, recentErrors: { type: 'array', items: ref('Incident') } } }],
        },
        Subscription: {
          type: 'object',
          required: ['id', 'plan', 'amountClp', 'status'],
          properties: {
            id: { type: 'string' },
            clients: clientRefs,
            plan: { type: 'string' },
            planLabel: { type: 'string' },
            amountClp: { ...clp, description: 'Monto mensual que paga, en CLP. 0 si es cortesía.' },
            status: { type: 'string', enum: ['activa', 'vencida', 'cancelada'] },
            billing: { type: 'string', enum: ['stripe', 'cortesia'] },
            startedAt: iso,
            nextChargeAt: nullableIso,
            canceledAt: nullableIso,
            daysPastDue: { type: 'integer', description: 'Días de atraso (0 si está al día).' },
          },
        },
        Payment: {
          type: 'object',
          required: ['id', 'amountClp', 'status', 'paidAt'],
          properties: {
            id: { type: 'string' },
            clients: clientRefs,
            amountClp: clp,
            method: { type: 'string', description: 'Procesador del pago (hoy `stripe`).' },
            status: { type: 'string', enum: ['pagado'] },
            paidAt: iso,
            invoiceId: { type: ['string', 'null'] },
          },
        },
        Invoice: {
          type: 'object',
          required: ['id', 'amountClp', 'status', 'paid', 'issuedAt'],
          properties: {
            id: { type: 'string' },
            number: { type: ['string', 'null'] },
            folio: { type: ['string', 'null'], description: 'Folio del DTE; `null` mientras no haya emisor conectado.' },
            siiStatus: { type: ['string', 'null'], description: 'Estado ante el SII; `null` mientras no haya emisor conectado.' },
            clients: clientRefs,
            amountClp: clp,
            status: { type: 'string', enum: ['pagada', 'pendiente', 'vencida', 'anulada'] },
            paid: { type: 'boolean' },
            issuedAt: iso,
            dueDate: nullableIso,
            paidAt: nullableIso,
          },
        },
        Incident: {
          type: 'object',
          required: ['id', 'source', 'severity', 'code', 'message', 'occurredAt'],
          properties: {
            id: { type: 'string' },
            source: { type: 'string', enum: ['whatsapp', 'instagram', 'ia', 'pagos'] },
            severity: { type: 'string', enum: ['baja', 'media', 'alta', 'critica'] },
            code: { type: 'string' },
            message: { type: 'string', description: 'Motivo, sin claves ni datos de clientes finales.' },
            clientId: { type: ['string', 'null'] },
            occurredAt: iso,
          },
        },
      },
    },
  }
}
