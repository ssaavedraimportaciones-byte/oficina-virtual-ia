/**
 * La agenda guarda horas locales del negocio ("2026-08-07T14:00"), pero el
 * servidor corre en UTC: a las 21:00 en Chile, `new Date().toISOString()` ya
 * dice que es mañana. Todo lo que el agente interprete como "hoy" o "ahora"
 * tiene que salir de acá, en la zona horaria del negocio.
 */

const DEFAULT_TIMEZONE = 'America/Santiago'

export function businessTimezone(): string {
  const configured = process.env.BUSINESS_TIMEZONE
  if (!configured) return DEFAULT_TIMEZONE
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: configured })
    return configured
  } catch {
    // Una zona mal escrita no tiene que dejar al agente sin poder reservar.
    return DEFAULT_TIMEZONE
  }
}

/** Fecha ("YYYY-MM-DD") y hora ("HH:mm") actuales en la zona del negocio. */
export function businessNow(at: Date = new Date()): { date: string; time: string } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: businessTimezone(),
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  )
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  }
}

/** Instante UTC en que empieza el día (o el mes) de `at` en la zona del negocio. */
function startOfLocal(at: Date, unit: 'day' | 'month'): Date {
  const tz = businessTimezone()
  const wall = (d: Date) => {
    const p = Object.fromEntries(
      new Intl.DateTimeFormat('en-CA', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      })
        .formatToParts(d)
        .map((x) => [x.type, x.value]),
    )
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute)
  }
  const p = businessNow(at).date.split('-').map(Number)
  const target = Date.UTC(p[0], p[1] - 1, unit === 'month' ? 1 : p[2])
  // Dos pasadas: el desfase (-3 / -4 h) cambia con el horario de verano.
  let guess = target
  for (let i = 0; i < 2; i += 1) guess = target - (wall(new Date(guess)) - guess)
  return new Date(guess)
}

export const startOfBusinessDay = (at: Date = new Date()) => startOfLocal(at, 'day')
export const startOfBusinessMonth = (at: Date = new Date()) => startOfLocal(at, 'month')
