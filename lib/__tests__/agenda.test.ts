import { describe, expect, it } from 'vitest'
import { addDays, getAvailableSlots, isSlotFree, weekdayOf } from '../agenda'
import type { Appointment, WeekHours } from '../types'

// Lunes a viernes 09:00-12:00 para que la grilla sea chica y verificable.
const HOURS: WeekHours = [
  null,
  { open: '09:00', close: '12:00' },
  { open: '09:00', close: '12:00' },
  { open: '09:00', close: '12:00' },
  { open: '09:00', close: '12:00' },
  { open: '09:00', close: '12:00' },
  null,
]

function appointment(startsAt: string, durationMinutes: number): Appointment {
  return {
    id: 'a', businessId: 'b', conversationId: null, serviceId: null,
    serviceName: 'x', contactName: 'n', contactHandle: 'h',
    startsAt, durationMinutes, status: 'confirmado', createdAt: '',
  }
}

describe('weekdayOf', () => {
  it('calcula el día correcto', () => {
    expect(weekdayOf('2026-08-10')).toBe(1) // lunes
    expect(weekdayOf('2026-08-09')).toBe(0) // domingo
  })
})

describe('getAvailableSlots', () => {
  it('genera la grilla de un día abierto', () => {
    const slots = getAvailableSlots(HOURS, [], 60, '2026-08-10', '2026-08-10')
    expect(slots.map((s) => s.time)).toEqual(['09:00', '09:30', '10:00', '10:30', '11:00'])
  })

  it('saltea los días cerrados', () => {
    const slots = getAvailableSlots(HOURS, [], 60, '2026-08-09', '2026-08-09')
    expect(slots).toEqual([])
  })

  it('descarta los horarios que se pisan con un turno existente', () => {
    const slots = getAvailableSlots(HOURS, [appointment('2026-08-10T10:00', 60)], 60, '2026-08-10', '2026-08-10')
    // 09:30 se pisa (09:30-10:30), 10:00 y 10:30 también.
    expect(slots.map((s) => s.time)).toEqual(['09:00', '11:00'])
  })

  it('ignora los turnos cancelados', () => {
    const cancelled = { ...appointment('2026-08-10T10:00', 60), status: 'cancelado' as const }
    const slots = getAvailableSlots(HOURS, [cancelled], 60, '2026-08-10', '2026-08-10')
    expect(slots).toHaveLength(5)
  })

  it('no ofrece un turno que no entra antes del cierre', () => {
    const slots = getAvailableSlots(HOURS, [], 180, '2026-08-10', '2026-08-10')
    expect(slots.map((s) => s.time)).toEqual(['09:00'])
  })
})

describe('isSlotFree', () => {
  it('rechaza un día cerrado', () => {
    const result = isSlotFree(HOURS, [], '2026-08-09T10:00', 60)
    expect(result.ok).toBe(false)
  })

  it('rechaza fuera del horario de atención', () => {
    expect(isSlotFree(HOURS, [], '2026-08-10T08:00', 60).ok).toBe(false)
    expect(isSlotFree(HOURS, [], '2026-08-10T11:30', 60).ok).toBe(false)
  })

  it('rechaza un horario ya ocupado', () => {
    const result = isSlotFree(HOURS, [appointment('2026-08-10T10:00', 60)], '2026-08-10T10:30', 60)
    expect(result.ok).toBe(false)
  })

  it('acepta un horario libre', () => {
    expect(isSlotFree(HOURS, [appointment('2026-08-10T10:00', 60)], '2026-08-10T09:00', 60).ok).toBe(true)
  })
})

describe('addDays', () => {
  it('cruza fin de mes', () => {
    expect(addDays('2026-08-31', 1)).toBe('2026-09-01')
  })
})
