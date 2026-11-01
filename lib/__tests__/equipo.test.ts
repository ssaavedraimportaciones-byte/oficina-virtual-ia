import { describe, expect, it } from 'vitest'
import { randomUUID } from 'crypto'
import {
  assignProfessional,
  findProfessionalByName,
  getAvailableTeamSlots,
} from '../agenda'
import { runAgentTool } from '../agentTools'
import { buildSystemPrompt } from '../agentPrompt'
import * as store from '../store'
import type { Appointment, Professional, WeekHours } from '../types'

const DAY = { open: '09:00', close: '12:00' }
const HOURS: WeekHours = [null, DAY, DAY, DAY, DAY, DAY, null]
const MONDAY = '2026-08-10'

const ana: Professional = { id: 'ana', businessId: 'b', name: 'Ana María' }
const caro: Professional = { id: 'caro', businessId: 'b', name: 'Carolina' }

function booked(professionalId: string | null, time: string, minutes = 60): Appointment {
  return {
    id: randomUUID(), businessId: 'b', conversationId: null, serviceId: null, serviceName: 'x',
    professionalId, professionalName: professionalId, contactName: 'n', contactHandle: 'h',
    startsAt: `${MONDAY}T${time}`, durationMinutes: minutes, status: 'confirmado', createdAt: '',
  }
}

describe('equipo: disponibilidad por persona', () => {
  it('encuentra a alguien por nombre, sin acentos ni mayúsculas', () => {
    expect(findProfessionalByName([ana, caro], 'ana')?.id).toBe('ana')
    expect(findProfessionalByName([ana, caro], 'CAROLINA')?.id).toBe('caro')
    expect(findProfessionalByName([ana, caro], 'maria')?.id).toBe('ana')
    expect(findProfessionalByName([ana, caro], 'pedro')).toBeNull()
  })

  it('dos clientes pueden tener la misma hora si los atienden personas distintas', () => {
    const slots = getAvailableTeamSlots(HOURS, [booked('ana', '09:00')], [ana, caro], 60, MONDAY, MONDAY)
    const nine = slots.find((s) => s.time === '09:00')
    expect(nine?.free.map((p) => p.id)).toEqual(['caro'])
    const ten = slots.find((s) => s.time === '10:00')
    expect(ten?.free.map((p) => p.id)).toEqual(['ana', 'caro'])
  })

  it('una hora sin persona asignada (de antes del equipo) bloquea a todos', () => {
    const slots = getAvailableTeamSlots(HOURS, [booked(null, '09:00')], [ana, caro], 60, MONDAY, MONDAY)
    expect(slots.find((s) => s.time === '09:00')).toBeUndefined()
  })

  it('si piden a alguien ocupado, no se asigna a otra en silencio', () => {
    const result = assignProfessional(HOURS, [booked('ana', '09:00')], [ana, caro], `${MONDAY}T09:00`, 60, undefined, ana)
    expect(result.ok).toBe(false)
  })

  it('sin preferencia, se asigna a quien tenga menos horas ese día', () => {
    const result = assignProfessional(HOURS, [booked('ana', '09:00')], [ana, caro], `${MONDAY}T10:00`, 60, undefined)
    expect(result.ok && result.professional.id).toBe('caro')
  })
})

describe('equipo: agente', () => {
  async function setup(withTeam: boolean) {
    const business = await store.createBusiness(
      { agentName: 'A', businessName: `Glam ${randomUUID()}`, industry: 'i', description: 'd',
        goals: 'g', tone: 'cercano', channels: ['whatsapp'], configuredAt: '' },
      'manicura',
    )
    await store.updateBusinessHours(business.id, HOURS)
    await store.addService({ businessId: business.id, name: 'Manicure', durationMinutes: 60, price: '$15.000' })
    if (withTeam) {
      await store.addProfessional(business.id, 'Camila')
      await store.addProfessional(business.id, 'Valentina')
    }
    const conversation = await store.createConversation({ businessId: business.id, channel: 'whatsapp', contactName: 'Cliente', contactHandle: `h-${randomUUID()}` })
    return { business: (await store.getBusiness(business.id))!, conversation }
  }

  it('el prompt lista los nombres del equipo', async () => {
    const { business } = await setup(true)
    const team = await store.listProfessionals(business.id)
    const prompt = buildSystemPrompt(business.config, [], await store.listServices(business.id), [], [], team)
    expect(prompt).toContain('Camila, Valentina')
  })

  it('agenda con la persona pedida y la deja guardada en la hora', async () => {
    const { business, conversation } = await setup(true)
    const ctx = { business, conversation }
    const date = '2099-01-05' // lunes lejano
    const reply = await runAgentTool(ctx, 'agendar_turno', {
      servicio: 'Manicure', fecha: date, hora: '10:00', nombre_cliente: 'Rosa', profesional: 'valentina',
    })
    expect(reply).toContain('con Valentina')
    const [appointment] = await store.listAppointments(business.id)
    expect(appointment.professionalName).toBe('Valentina')

    const again = await runAgentTool(ctx, 'agendar_turno', {
      servicio: 'Manicure', fecha: date, hora: '10:00', nombre_cliente: 'Luz', profesional: 'Valentina',
    })
    expect(again).toContain('No se pudo reservar')
  })

  it('sin pedir a nadie, asigna a quien esté libre y no repite la hora', async () => {
    const { business, conversation } = await setup(true)
    const ctx = { business, conversation }
    const date = '2099-01-05'
    const call = (name: string) =>
      runAgentTool(ctx, 'agendar_turno', { servicio: 'Manicure', fecha: date, hora: '10:00', nombre_cliente: name })
    expect(await call('Uno')).toContain('Hora agendada')
    expect(await call('Dos')).toContain('Hora agendada')
    expect(await call('Tres')).toContain('No se pudo reservar')
    const names = (await store.listAppointments(business.id)).map((a) => a.professionalName).sort()
    expect(names).toEqual(['Camila', 'Valentina'])
  })

  it('con un nombre que no existe, responde con la lista del equipo', async () => {
    const { business, conversation } = await setup(true)
    const reply = await runAgentTool({ business, conversation }, 'consultar_disponibilidad', {
      servicio: 'Manicure', desde: '2099-01-05', profesional: 'Pedro',
    })
    expect(reply).toContain('Camila, Valentina')
  })

  it('sin equipo cargado funciona como siempre, con una sola agenda', async () => {
    const { business, conversation } = await setup(false)
    const reply = await runAgentTool({ business, conversation }, 'agendar_turno', {
      servicio: 'Manicure', fecha: '2099-01-05', hora: '10:00', nombre_cliente: 'Rosa',
    })
    expect(reply).toContain('Hora agendada')
    expect((await store.listAppointments(business.id))[0].professionalName).toBeNull()
  })
})
