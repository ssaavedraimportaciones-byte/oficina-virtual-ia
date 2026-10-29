import { describe, expect, it } from 'vitest'
import { buildSystemPrompt } from '../agentPrompt'

/**
 * Antes el prompt le decía al agente que mirara consultar_disponibilidad,
 * pero no que avisara cuando el negocio está cerrado en ese momento. Un
 * cliente que escribe de noche merece que se lo digan, en vez de que el
 * agente ofrezca horarios como si nada sin más contexto.
 */
describe('agenda fuera de horario', () => {
  it('le pide al agente avisar cuando está cerrado y ofrecer el próximo horario igual', () => {
    const prompt = buildSystemPrompt(
      {
        agentName: 'Bella',
        businessName: 'Uñas Bella',
        industry: 'i',
        description: 'd',
        goals: 'g',
        tone: 'cercano',
        channels: ['whatsapp'],
        configuredAt: '',
      },
      [],
      [{ id: 's1', businessId: 'b1', name: 'Manicure', durationMinutes: 60, price: '$10.000' }],
    )
    expect(prompt).toContain('fuera del horario de atención')
    expect(prompt).toContain('ahora estamos cerrados')
  })
})

import { getAvailableSlots } from '../agenda'
import type { WeekHours } from '../types'

/**
 * Los horarios de los negocios de demostración (domingo primero). Lo que se
 * verifica: si el cliente escribe cuando el negocio ya cerró, el primer horario
 * libre que ve el agente es el del próximo día que abre, no uno que ya pasó.
 */
const day = (open: string, close: string) => ({ open, close })
const DENTISTA: WeekHours = [null, day('09:00', '19:00'), day('09:00', '19:00'), day('09:00', '19:00'), day('09:00', '19:00'), day('09:00', '19:00'), day('09:00', '13:00')]
const PANCHO: WeekHours = [day('12:00', '22:00'), null, day('12:00', '23:00'), day('12:00', '23:00'), day('12:00', '23:00'), day('12:00', '23:00'), day('12:00', '23:00')]

describe('primer horario libre cuando escriben con el negocio cerrado', () => {
  it('martes a las 20:00, cerrada la clínica: ofrece el miércoles a primera hora', () => {
    const slots = getAvailableSlots(DENTISTA, [], 30, '2026-11-03', '2026-11-17', 3, { date: '2026-11-03', time: '20:00' })
    expect(slots[0]).toEqual({ date: '2026-11-04', time: '09:00' })
  })

  it('sábado después de cerrar: se salta el domingo y ofrece el lunes', () => {
    const slots = getAvailableSlots(DENTISTA, [], 30, '2026-11-07', '2026-11-21', 3, { date: '2026-11-07', time: '14:00' })
    expect(slots[0]).toEqual({ date: '2026-11-09', time: '09:00' })
  })

  it('lunes con el local cerrado todo el día: ofrece el martes al abrir', () => {
    const slots = getAvailableSlots(PANCHO, [], 15, '2026-11-02', '2026-11-16', 3, { date: '2026-11-02', time: '11:00' })
    expect(slots[0]).toEqual({ date: '2026-11-03', time: '12:00' })
  })

  it('con el negocio abierto, ofrece lo que queda del mismo día y no horarios pasados', () => {
    const slots = getAvailableSlots(DENTISTA, [], 30, '2026-11-03', '2026-11-17', 3, { date: '2026-11-03', time: '17:00' })
    expect(slots[0]).toEqual({ date: '2026-11-03', time: '17:30' })
  })
})

describe('fotos: el agente deriva a las redes del negocio', () => {
  it('le pide pasar las redes sociales cuando piden fotos y no inventar direcciones', () => {
    const prompt = buildSystemPrompt({
      agentName: 'Rodri',
      businessName: 'Pancho Rodante',
      industry: 'i',
      description: 'd',
      goals: 'g',
      tone: 'cercano',
      channels: ['whatsapp'],
      configuredAt: '',
    })
    expect(prompt).toContain('pide fotos')
    expect(prompt).toContain('redes sociales')
    expect(prompt).toContain('Nunca inventes usuarios ni direcciones')
  })
})
