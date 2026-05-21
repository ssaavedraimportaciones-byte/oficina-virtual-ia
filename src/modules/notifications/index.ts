export interface Notificacion {
  tipo: 'firma_requerida' | 'aprobacion_requerida' | 'documento_rechazado' | 'documento_aprobado' | 'timbre_emitido'
  destinatarioId: string
  documentId: string
  mensaje: string
}

// TODO: implementar con Web Push API o email transaccional
export async function enviarNotificacion(_notif: Notificacion): Promise<void> {
  console.log('[notifications] stub:', _notif.tipo, _notif.destinatarioId)
}
