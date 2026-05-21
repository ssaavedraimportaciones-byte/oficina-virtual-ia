import crypto from 'crypto'
import type { SafeDocument, Signature, Approval } from '@/types/document'

export function generarHashDocumento(
  documento: SafeDocument,
  firmas: Signature[],
  aprobaciones: Approval[]
): string {
  const contenido = JSON.stringify({
    id: documento.id,
    tipo: documento.tipo,
    version: documento.version,
    campos: documento.campos,
    firmas: firmas.map(f => ({
      userId: f.userId,
      firmadoAt: f.firmadoAt,
      hash_documento: f.hash_documento,
    })),
    aprobaciones: aprobaciones.map(a => ({
      aprobadorId: a.aprobadorId,
      decision: a.decision,
      timestamp: a.timestamp,
    })),
  })
  return crypto.createHash('sha256').update(contenido).digest('hex')
}

export function generarNumeroTimbre(contador: number): string {
  const anio = new Date().getFullYear()
  const numero = String(contador).padStart(6, '0')
  return `SC-${anio}-${numero}`
}
