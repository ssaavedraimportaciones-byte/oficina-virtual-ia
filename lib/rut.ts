/**
 * RUT chileno: se guarda normalizado ("76.543.210-K") y solo si el dígito
 * verificador cuadra (módulo 11), para no pasarle a otros sistemas un RUT mal tipeado.
 */

const clean = (v: string) => v.replace(/[^0-9kK]/g, '').toUpperCase()

export function rutCheckDigit(body: string): string {
  let sum = 0
  let factor = 2
  for (let i = body.length - 1; i >= 0; i -= 1) {
    sum += Number(body[i]) * factor
    factor = factor === 7 ? 2 : factor + 1
  }
  const rest = 11 - (sum % 11)
  return rest === 11 ? '0' : rest === 10 ? 'K' : String(rest)
}

/** Devuelve el RUT con puntos y guion, o `null` si no es válido. */
export function normalizeRut(input: string): string | null {
  const c = clean(input)
  if (c.length < 8 || c.length > 9) return null
  const body = c.slice(0, -1)
  const dv = c.slice(-1)
  if (!/^\d+$/.test(body) || rutCheckDigit(body) !== dv) return null
  return `${body.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}-${dv}`
}
