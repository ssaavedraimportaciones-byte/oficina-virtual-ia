import type { NotificationEvent, ChannelType } from './types'

interface RenderedTemplate {
  subject: string
  text: string
  html: string
}

interface TemplateContext {
  folio: string
  taskName: string
  workArea: string
  initiatorName: string
  comment?: string
}

const APP_NAME = 'SafeCheck AI'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://safecheck.ai'

// ── Email HTML wrapper ────────────────────────────────────────────────────────

function wrapHtml(body: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><style>
  body { font-family: Arial, sans-serif; background:#f5f5f5; margin:0; padding:0; }
  .container { max-width:560px; margin:32px auto; background:#fff; border-radius:8px; overflow:hidden; border:1px solid #e0e0e0; }
  .header { background:#1a1a2e; padding:20px 24px; }
  .header h1 { color:#f59e0b; margin:0; font-size:18px; }
  .body { padding:24px; color:#333; font-size:14px; line-height:1.6; }
  .doc-box { background:#f9f9f9; border:1px solid #e0e0e0; border-radius:6px; padding:16px; margin:16px 0; }
  .doc-box p { margin:4px 0; }
  .label { color:#888; font-size:12px; }
  .btn { display:inline-block; background:#f59e0b; color:#000; font-weight:bold; padding:10px 20px; border-radius:6px; text-decoration:none; margin-top:16px; }
  .footer { padding:16px 24px; font-size:11px; color:#999; border-top:1px solid #eee; }
</style></head>
<body>
  <div class="container">
    <div class="header"><h1>${APP_NAME}</h1></div>
    <div class="body">${body}</div>
    <div class="footer">Este correo fue generado automáticamente por ${APP_NAME}. No responder.</div>
  </div>
</body>
</html>`
}

// ── Template definitions ──────────────────────────────────────────────────────

type Templates = Record<NotificationEvent, Record<'EMAIL' | 'SMS', (ctx: TemplateContext) => RenderedTemplate>>

const TEMPLATES: Templates = {
  DOCUMENT_CREATED: {
    EMAIL: (ctx) => ({
      subject: `[${APP_NAME}] Documento creado: ${ctx.folio}`,
      text: `Se ha creado el documento ${ctx.folio} — ${ctx.taskName} (${ctx.workArea}) por ${ctx.initiatorName}.`,
      html: wrapHtml(`
        <p>Se ha creado un nuevo documento de seguridad.</p>
        <div class="doc-box">
          <p><span class="label">Folio:</span> <strong>${ctx.folio}</strong></p>
          <p><span class="label">Tarea:</span> ${ctx.taskName}</p>
          <p><span class="label">Área:</span> ${ctx.workArea}</p>
          <p><span class="label">Creado por:</span> ${ctx.initiatorName}</p>
        </div>
        <a href="${APP_URL}/documents" class="btn">Ver documentos →</a>
      `),
    }),
    SMS: (ctx) => ({
      subject: '',
      text: `[SafeCheck] Nuevo doc ${ctx.folio}: ${ctx.taskName} — ${ctx.workArea}`,
      html: '',
    }),
  },

  DOCUMENT_OBSERVED: {
    EMAIL: (ctx) => ({
      subject: `[${APP_NAME}] Documento observado: ${ctx.folio}`,
      text: `El documento ${ctx.folio} ha sido observado por ${ctx.initiatorName}. Motivo: ${ctx.comment ?? '(sin comentario)'}`,
      html: wrapHtml(`
        <p>⚠️ El documento ha sido <strong>observado</strong> y requiere correcciones.</p>
        <div class="doc-box">
          <p><span class="label">Folio:</span> <strong>${ctx.folio}</strong></p>
          <p><span class="label">Tarea:</span> ${ctx.taskName}</p>
          <p><span class="label">Área:</span> ${ctx.workArea}</p>
          <p><span class="label">Observado por:</span> ${ctx.initiatorName}</p>
          ${ctx.comment ? `<p><span class="label">Observación:</span> ${ctx.comment}</p>` : ''}
        </div>
        <a href="${APP_URL}/documents" class="btn">Revisar documento →</a>
      `),
    }),
    SMS: (ctx) => ({
      subject: '',
      text: `[SafeCheck] Doc ${ctx.folio} observado por ${ctx.initiatorName}. ${ctx.comment ?? ''}`,
      html: '',
    }),
  },

  DOCUMENT_PENDING_SIGNATURE: {
    EMAIL: (ctx) => ({
      subject: `[${APP_NAME}] Firma requerida: ${ctx.folio}`,
      text: `El documento ${ctx.folio} — ${ctx.taskName} requiere su firma.`,
      html: wrapHtml(`
        <p>✍️ Se requiere su firma en el siguiente documento de seguridad.</p>
        <div class="doc-box">
          <p><span class="label">Folio:</span> <strong>${ctx.folio}</strong></p>
          <p><span class="label">Tarea:</span> ${ctx.taskName}</p>
          <p><span class="label">Área:</span> ${ctx.workArea}</p>
        </div>
        <a href="${APP_URL}/documents" class="btn">Firmar ahora →</a>
      `),
    }),
    SMS: (ctx) => ({
      subject: '',
      text: `[SafeCheck] Se requiere su firma en doc ${ctx.folio}: ${ctx.taskName}`,
      html: '',
    }),
  },

  DOCUMENT_PENDING_APPROVAL: {
    EMAIL: (ctx) => ({
      subject: `[${APP_NAME}] Aprobación requerida: ${ctx.folio}`,
      text: `El documento ${ctx.folio} — ${ctx.taskName} está pendiente de su aprobación.`,
      html: wrapHtml(`
        <p>📋 Un documento está esperando su aprobación.</p>
        <div class="doc-box">
          <p><span class="label">Folio:</span> <strong>${ctx.folio}</strong></p>
          <p><span class="label">Tarea:</span> ${ctx.taskName}</p>
          <p><span class="label">Área:</span> ${ctx.workArea}</p>
          <p><span class="label">Iniciado por:</span> ${ctx.initiatorName}</p>
        </div>
        <a href="${APP_URL}/approvals" class="btn">Revisar aprobaciones →</a>
      `),
    }),
    SMS: (ctx) => ({
      subject: '',
      text: `[SafeCheck] Doc ${ctx.folio} pendiente de su aprobación: ${ctx.taskName}`,
      html: '',
    }),
  },

  DOCUMENT_APPROVED: {
    EMAIL: (ctx) => ({
      subject: `[${APP_NAME}] Documento aprobado: ${ctx.folio}`,
      text: `El documento ${ctx.folio} — ${ctx.taskName} ha sido aprobado por ${ctx.initiatorName}.`,
      html: wrapHtml(`
        <p>✅ El documento ha sido <strong>aprobado</strong> para ejecución.</p>
        <div class="doc-box">
          <p><span class="label">Folio:</span> <strong>${ctx.folio}</strong></p>
          <p><span class="label">Tarea:</span> ${ctx.taskName}</p>
          <p><span class="label">Área:</span> ${ctx.workArea}</p>
          <p><span class="label">Aprobado por:</span> ${ctx.initiatorName}</p>
        </div>
        <a href="${APP_URL}/documents" class="btn">Ver documento →</a>
      `),
    }),
    SMS: (ctx) => ({
      subject: '',
      text: `[SafeCheck] Doc ${ctx.folio} APROBADO por ${ctx.initiatorName}: ${ctx.taskName}`,
      html: '',
    }),
  },

  DOCUMENT_REJECTED: {
    EMAIL: (ctx) => ({
      subject: `[${APP_NAME}] Documento rechazado: ${ctx.folio}`,
      text: `El documento ${ctx.folio} ha sido rechazado por ${ctx.initiatorName}. Motivo: ${ctx.comment ?? '(sin comentario)'}`,
      html: wrapHtml(`
        <p>❌ El documento ha sido <strong>rechazado</strong>.</p>
        <div class="doc-box">
          <p><span class="label">Folio:</span> <strong>${ctx.folio}</strong></p>
          <p><span class="label">Tarea:</span> ${ctx.taskName}</p>
          <p><span class="label">Área:</span> ${ctx.workArea}</p>
          <p><span class="label">Rechazado por:</span> ${ctx.initiatorName}</p>
          ${ctx.comment ? `<p><span class="label">Motivo:</span> ${ctx.comment}</p>` : ''}
        </div>
        <a href="${APP_URL}/documents" class="btn">Ver documento →</a>
      `),
    }),
    SMS: (ctx) => ({
      subject: '',
      text: `[SafeCheck] Doc ${ctx.folio} RECHAZADO por ${ctx.initiatorName}. ${ctx.comment ?? ''}`,
      html: '',
    }),
  },

  DOCUMENT_CLOSED: {
    EMAIL: (ctx) => ({
      subject: `[${APP_NAME}] Documento cerrado: ${ctx.folio}`,
      text: `El documento ${ctx.folio} — ${ctx.taskName} ha sido cerrado por ${ctx.initiatorName}.`,
      html: wrapHtml(`
        <p>🔒 El documento ha sido <strong>cerrado</strong>.</p>
        <div class="doc-box">
          <p><span class="label">Folio:</span> <strong>${ctx.folio}</strong></p>
          <p><span class="label">Tarea:</span> ${ctx.taskName}</p>
          <p><span class="label">Área:</span> ${ctx.workArea}</p>
          <p><span class="label">Cerrado por:</span> ${ctx.initiatorName}</p>
        </div>
      `),
    }),
    SMS: (ctx) => ({
      subject: '',
      text: `[SafeCheck] Doc ${ctx.folio} cerrado por ${ctx.initiatorName}: ${ctx.taskName}`,
      html: '',
    }),
  },
}

export function renderTemplate(
  event: NotificationEvent,
  channel: Extract<ChannelType, 'EMAIL' | 'SMS'>,
  ctx: TemplateContext
): RenderedTemplate {
  return TEMPLATES[event][channel](ctx)
}
