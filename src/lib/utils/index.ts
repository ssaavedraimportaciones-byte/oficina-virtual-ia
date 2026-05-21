import crypto from 'crypto'

export const sha256 = (data: string) => crypto.createHash('sha256').update(data).digest('hex')

export function getIp(headers: Headers): string {
  return headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'desconocida'
}

export function formatRut(rut: string): string {
  const clean = rut.replace(/[^0-9kK]/g, '')
  if (clean.length < 2) return clean
  return `${clean.slice(0, -1)}-${clean.slice(-1).toUpperCase()}`
}

export function generarNumeroTimbre(contador: number): string {
  return `SC-${new Date().getFullYear()}-${String(contador).padStart(6, '0')}`
}
