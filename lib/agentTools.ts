import type { LlmTool } from './llm'
import {
  addDays,
  buildLocal,
  findServiceByName,
  formatDateLabel,
  getAvailableSlots,
  isSlotFree,
} from './agenda'
import { formatPrice, isOrderable, isSoldOut, stockLabel } from './catalog'
import { notifyHandoff } from './notifications'
import {
  addAppointment,
  createOrder,
  listAppointments,
  listProducts,
  listServices,
  setAgentPaused,
} from './store'
import { businessNow } from './timezone'
import type { Business, Conversation } from './types'

/**
 * Disponible en todas las conversaciones, tenga o no agenda o catálogo el
 * negocio: siempre puede aparecer alguien que necesita a una persona.
 */
export const HANDOFF_TOOL: LlmTool = {
  name: 'derivar_a_humano',
  description:
    'Pasa la conversación a una persona del equipo y te saca de la conversación: a partir de ahí no respondes más tú. Úsalo si el contacto pide hablar con una persona, está enojado, hace un reclamo o pide algo que no puedes resolver.',
  parameters: {
    type: 'object',
    properties: {
      motivo: {
        type: 'string',
        description:
          'En una frase, qué necesita el contacto y por qué lo derivas. Lo lee el equipo para retomar sin releer toda la charla.',
      },
    },
    required: ['motivo'],
  },
}

export const AGENDA_TOOLS: LlmTool[] = [
  {
    name: 'consultar_disponibilidad',
    description:
      'Devuelve los horarios libres para reservar un servicio. Úsalo SIEMPRE antes de ofrecerle horarios al cliente: nunca inventes disponibilidad.',
    parameters: {
      type: 'object',
      properties: {
        servicio: {
          type: 'string',
          description: 'Nombre del servicio que quiere el cliente, tal como te lo dijo.',
        },
        desde: {
          type: 'string',
          description: 'Fecha inicial en formato YYYY-MM-DD. Si no la sabes, usa la fecha de hoy.',
        },
        hora_desde: {
          type: 'string',
          description:
            'Opcional, HH:mm (24 horas). Devuelve solo horarios desde esa hora. Úsalo cuando el cliente pide un momento del día: "a la tarde" = 14:00, "a la noche" = 18:00.',
        },
      },
      required: ['servicio'],
    },
  },
  {
    name: 'agendar_turno',
    description:
      'Reserva una hora en la agenda del negocio. Úsalo solo cuando el cliente ya confirmó un horario concreto que salió de consultar_disponibilidad.',
    parameters: {
      type: 'object',
      properties: {
        servicio: { type: 'string', description: 'Nombre del servicio a reservar.' },
        fecha: { type: 'string', description: 'Fecha en formato YYYY-MM-DD.' },
        hora: { type: 'string', description: 'Hora en formato HH:mm (24 horas).' },
        nombre_cliente: {
          type: 'string',
          description: 'Nombre del cliente. Si no lo sabes, pregúntaselo antes de reservar.',
        },
      },
      required: ['servicio', 'fecha', 'hora', 'nombre_cliente'],
    },
  },
]

export const PEDIDO_TOOLS: LlmTool[] = [
  {
    name: 'consultar_catalogo',
    description:
      'Devuelve los productos disponibles con su precio y su stock. Úsalo SIEMPRE antes de confirmar precios o disponibilidad: nunca inventes productos ni digas que hay stock sin consultarlo.',
    parameters: {
      type: 'object',
      properties: {
        busqueda: {
          type: 'string',
          description:
            'Opcional. Palabra para filtrar el catálogo. Si lo omites devuelve todo el catálogo.',
        },
      },
    },
  },
  {
    name: 'crear_pedido',
    description:
      'Registra un pedido y descuenta el stock. Úsalo solo cuando el cliente ya confirmó qué quiere llevar y en qué cantidad, y sabes su nombre.',
    parameters: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          description: 'Productos del pedido.',
          items: {
            type: 'object',
            properties: {
              producto: { type: 'string', description: 'Nombre del producto.' },
              cantidad: { type: 'number', description: 'Unidades. Entero mayor a cero.' },
            },
            required: ['producto', 'cantidad'],
          },
        },
        nombre_cliente: {
          type: 'string',
          description: 'Nombre del cliente. Si no lo sabes, pregúntaselo antes de registrar.',
        },
        nota: {
          type: 'string',
          description: 'Opcional: dirección de entrega, forma de pago o aclaraciones.',
        },
      },
      required: ['items', 'nombre_cliente'],
    },
  },
]

export interface ToolContext {
  business: Business
  conversation: Conversation
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

async function runConsultarDisponibilidad(
  ctx: ToolContext,
  input: { servicio?: string; desde?: string; hora_desde?: string },
): Promise<string> {
  const services = await listServices(ctx.business.id)
  if (services.length === 0) {
    return 'El negocio todavía no cargó servicios en la agenda, así que no puedo consultar disponibilidad. Dile al cliente que le confirmas el horario a la brevedad.'
  }

  const service = input.servicio ? findServiceByName(services, input.servicio) : null
  if (!service) {
    return `No encontré ese servicio. Los disponibles son: ${services.map((s) => s.name).join(', ')}. Pregúntale al cliente cuál quiere.`
  }

  const now = businessNow()
  const from = input.desde && DATE_RE.test(input.desde) && input.desde >= now.date ? input.desde : now.date
  const appointments = await listAppointments(ctx.business.id)
  // Sin este filtro el agente solo veía los primeros 12 horarios del día (todos
  // de mañana) y no podía ofrecerle nada a quien pide "a la tarde".
  const fromTime = input.hora_desde && TIME_RE.test(input.hora_desde) ? input.hora_desde : null
  const slots = getAvailableSlots(
    ctx.business.hours,
    appointments,
    service.durationMinutes,
    from,
    // Dos semanas alcanzan para ofrecer opciones sin abrumar.
    addDays(from, 14),
    fromTime ? 400 : 12,
    now,
  )
    .filter((slot) => !fromTime || slot.time >= fromTime)
    .slice(0, 12)

  if (slots.length === 0) {
    return `No hay horarios libres para "${service.name}"${fromTime ? ` desde las ${fromTime}` : ''} en las próximas dos semanas.`
  }

  const grouped = slots.reduce<Record<string, string[]>>((acc, slot) => {
    acc[slot.date] = acc[slot.date] ?? []
    acc[slot.date].push(slot.time)
    return acc
  }, {})

  const lines = Object.entries(grouped).map(
    ([date, times]) => `${formatDateLabel(date)} (${date}): ${times.join(', ')}`,
  )

  return `Horarios libres para "${service.name}" (dura ${service.durationMinutes} min, sale ${service.price}):\n${lines.join('\n')}`
}

async function runAgendarTurno(
  ctx: ToolContext,
  input: { servicio?: string; fecha?: string; hora?: string; nombre_cliente?: string },
): Promise<string> {
  if (!input.servicio || !input.fecha || !input.hora || !input.nombre_cliente) {
    return 'Faltan datos para reservar: necesito servicio, fecha, hora y nombre del cliente.'
  }

  // Sin esto, un "3pm" o "15" termina en una hora que no se puede comparar
  // con la agenda y pasa como libre.
  if (!DATE_RE.test(input.fecha) || !TIME_RE.test(input.hora)) {
    return 'La fecha tiene que ir como YYYY-MM-DD y la hora como HH:mm (24 horas). Vuelve a intentarlo con ese formato.'
  }

  const services = await listServices(ctx.business.id)
  const service = findServiceByName(services, input.servicio)
  if (!service) {
    return `No encontré el servicio "${input.servicio}". Disponibles: ${services.map((s) => s.name).join(', ')}.`
  }

  const startsAt = buildLocal(input.fecha, input.hora)
  const appointments = await listAppointments(ctx.business.id)

  // Se revalida acá aunque el horario haya salido de consultar_disponibilidad:
  // entre una cosa y la otra otro cliente puede haber tomado la hora.
  const check = isSlotFree(
    ctx.business.hours,
    appointments,
    startsAt,
    service.durationMinutes,
    businessNow(),
  )
  if (!check.ok) {
    return `No se pudo reservar: ${check.reason} Ofrécele otro horario al cliente.`
  }

  await addAppointment({
    businessId: ctx.business.id,
    conversationId: ctx.conversation.id,
    serviceId: service.id,
    serviceName: service.name,
    contactName: input.nombre_cliente,
    contactHandle: ctx.conversation.contactHandle,
    startsAt,
    durationMinutes: service.durationMinutes,
  })

  return `Hora agendada: ${service.name} el ${formatDateLabel(input.fecha)} a las ${input.hora}, a nombre de ${input.nombre_cliente}. Confírmaselo al cliente.`
}

async function runConsultarCatalogo(
  ctx: ToolContext,
  input: { busqueda?: string },
): Promise<string> {
  const products = (await listProducts(ctx.business.id)).filter((p) => p.active)
  if (products.length === 0) {
    return 'El negocio todavía no cargó su catálogo, así que no puedo confirmar productos ni precios. Tómale el pedido y dile que se lo confirmas a la brevedad.'
  }

  const term = input.busqueda?.trim().toLowerCase()
  const matches = term
    ? products.filter((p) => p.name.toLowerCase().includes(term))
    : products

  if (matches.length === 0) {
    const available = products.filter(isOrderable).map((p) => p.name)
    return `No hay ningún producto que coincida con "${input.busqueda}". Disponibles: ${available.join(', ') || 'ninguno por ahora'}.`
  }

  const lines = matches.map(
    (p) => `- ${p.name}: ${formatPrice(p.price)} — ${stockLabel(p)}`,
  )
  const soldOut = matches.filter(isSoldOut)

  const warning = soldOut.length
    ? `\n\nOJO: ${soldOut.map((p) => p.name).join(', ')} ${soldOut.length === 1 ? 'está agotado' : 'están agotados'}. No los ofrezcas ni los agregues a un pedido; si el cliente los pide, avísale y ofrécele una alternativa.`
    : ''

  return `Catálogo:\n${lines.join('\n')}${warning}`
}

async function runCrearPedido(
  ctx: ToolContext,
  input: { items?: { producto: string; cantidad: number }[]; nombre_cliente?: string; nota?: string },
): Promise<string> {
  if (!input.nombre_cliente) {
    return 'Falta el nombre del cliente. Pregúntaselo antes de registrar el pedido.'
  }
  if (!Array.isArray(input.items) || input.items.length === 0) {
    return 'Falta el detalle del pedido: qué productos y en qué cantidad.'
  }

  const result = await createOrder({
    businessId: ctx.business.id,
    conversationId: ctx.conversation.id,
    contactName: input.nombre_cliente,
    contactHandle: ctx.conversation.contactHandle,
    requested: input.items,
    note: input.nota ?? '',
  })

  if (!result.ok) {
    return `No se pudo registrar el pedido: ${result.reason}`
  }

  const detail = result.order.items
    .map((i) => `${i.quantity}x ${i.name} (${formatPrice(i.unitPrice * i.quantity)})`)
    .join(', ')

  return `Pedido registrado a nombre de ${result.order.contactName}: ${detail}. Total ${formatPrice(result.order.total)}. Confírmaselo al cliente con el total.`
}

async function runDerivarAHumano(ctx: ToolContext, input: { motivo?: string }): Promise<string> {
  const reason = input.motivo?.trim() || 'El contacto necesita hablar con una persona.'
  const conversation = await setAgentPaused(ctx.conversation.id, true, reason)
  // Best-effort: que falle el mail no puede dejar al cliente sin la respuesta
  // de "ya te atiende alguien".
  await notifyHandoff(ctx.business, conversation, reason).catch((error) => {
    console.error('[derivar_a_humano] no se pudo avisar al equipo:', error)
  })
  return 'Listo: la conversación quedó derivada al equipo y ya les avisamos. Dile al contacto, en una frase, que una persona le va a responder por acá. No hagas nada más en esta conversación.'
}

export async function runAgentTool(
  ctx: ToolContext,
  name: string,
  input: Record<string, unknown>,
): Promise<string> {
  try {
    if (name === 'consultar_disponibilidad') {
      return await runConsultarDisponibilidad(
        ctx,
        input as { servicio?: string; desde?: string; hora_desde?: string },
      )
    }
    if (name === 'agendar_turno') {
      return await runAgendarTurno(ctx, input as Parameters<typeof runAgendarTurno>[1])
    }
    if (name === 'consultar_catalogo') {
      return await runConsultarCatalogo(ctx, input as { busqueda?: string })
    }
    if (name === 'crear_pedido') {
      return await runCrearPedido(ctx, input as Parameters<typeof runCrearPedido>[1])
    }
    if (name === 'derivar_a_humano') {
      return await runDerivarAHumano(ctx, input as { motivo?: string })
    }
    return `Herramienta desconocida: ${name}`
  } catch (error) {
    return `Error ejecutando ${name}: ${error instanceof Error ? error.message : 'desconocido'}`
  }
}
