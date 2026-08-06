import type Anthropic from '@anthropic-ai/sdk'
import {
  buildLocal,
  findServiceByName,
  formatDateLabel,
  getAvailableSlots,
  isSlotFree,
} from './agenda'
import { addAppointment, listAppointments, listServices } from './store'
import type { Business, Conversation } from './types'

export const AGENT_TOOLS: Anthropic.Tool[] = [
  {
    name: 'consultar_disponibilidad',
    description:
      'Devuelve los horarios libres para reservar un servicio. Usalo SIEMPRE antes de ofrecerle horarios al cliente: nunca inventes disponibilidad.',
    input_schema: {
      type: 'object',
      properties: {
        servicio: {
          type: 'string',
          description: 'Nombre del servicio que quiere el cliente, tal como te lo dijo.',
        },
        desde: {
          type: 'string',
          description: 'Fecha inicial en formato YYYY-MM-DD. Si no la sabés, usá la fecha de hoy.',
        },
      },
      required: ['servicio'],
    },
  },
  {
    name: 'agendar_turno',
    description:
      'Reserva un turno en la agenda del negocio. Usalo solo cuando el cliente ya confirmó un horario concreto que salió de consultar_disponibilidad.',
    input_schema: {
      type: 'object',
      properties: {
        servicio: { type: 'string', description: 'Nombre del servicio a reservar.' },
        fecha: { type: 'string', description: 'Fecha en formato YYYY-MM-DD.' },
        hora: { type: 'string', description: 'Hora en formato HH:mm (24 horas).' },
        nombre_cliente: {
          type: 'string',
          description: 'Nombre del cliente. Si no lo sabés, preguntáselo antes de reservar.',
        },
      },
      required: ['servicio', 'fecha', 'hora', 'nombre_cliente'],
    },
  },
]

export interface ToolContext {
  business: Business
  conversation: Conversation
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

async function runConsultarDisponibilidad(
  ctx: ToolContext,
  input: { servicio?: string; desde?: string },
): Promise<string> {
  const services = await listServices(ctx.business.id)
  if (services.length === 0) {
    return 'El negocio todavía no cargó servicios en la agenda, así que no puedo consultar disponibilidad. Decile al cliente que le confirmás el horario a la brevedad.'
  }

  const service = input.servicio ? findServiceByName(services, input.servicio) : null
  if (!service) {
    return `No encontré ese servicio. Los disponibles son: ${services.map((s) => s.name).join(', ')}. Preguntale al cliente cuál quiere.`
  }

  const from = input.desde && input.desde >= today() ? input.desde : today()
  const appointments = await listAppointments(ctx.business.id)
  const slots = getAvailableSlots(
    ctx.business.hours,
    appointments,
    service.durationMinutes,
    from,
    // Dos semanas alcanzan para ofrecer opciones sin abrumar.
    new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
    12,
  )

  if (slots.length === 0) {
    return `No hay horarios libres para "${service.name}" en las próximas dos semanas.`
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

  const services = await listServices(ctx.business.id)
  const service = findServiceByName(services, input.servicio)
  if (!service) {
    return `No encontré el servicio "${input.servicio}". Disponibles: ${services.map((s) => s.name).join(', ')}.`
  }

  const startsAt = buildLocal(input.fecha, input.hora)
  const appointments = await listAppointments(ctx.business.id)

  // Se revalida acá aunque el horario haya salido de consultar_disponibilidad:
  // entre una cosa y la otra otro cliente puede haber tomado el turno.
  const check = isSlotFree(ctx.business.hours, appointments, startsAt, service.durationMinutes)
  if (!check.ok) {
    return `No se pudo reservar: ${check.reason} Ofrecele otro horario al cliente.`
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

  return `Turno confirmado: ${service.name} el ${formatDateLabel(input.fecha)} a las ${input.hora}, a nombre de ${input.nombre_cliente}. Confirmáselo al cliente.`
}

export async function runAgentTool(
  ctx: ToolContext,
  name: string,
  input: Record<string, unknown>,
): Promise<string> {
  try {
    if (name === 'consultar_disponibilidad') {
      return await runConsultarDisponibilidad(ctx, input as { servicio?: string; desde?: string })
    }
    if (name === 'agendar_turno') {
      return await runAgendarTurno(ctx, input as Parameters<typeof runAgendarTurno>[1])
    }
    return `Herramienta desconocida: ${name}`
  } catch (error) {
    return `Error ejecutando ${name}: ${error instanceof Error ? error.message : 'desconocido'}`
  }
}
