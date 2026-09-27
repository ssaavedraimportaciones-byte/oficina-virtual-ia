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
