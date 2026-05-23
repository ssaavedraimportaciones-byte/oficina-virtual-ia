import * as Sentry from '@sentry/nextjs'

export interface SentryCtx {
  userId?: string
  documentId?: string
  action?: string
  role?: string
}

/**
 * Captures an exception with SafeCheck context.
 * Never exposes email, password, or tokens to Sentry.
 */
export function captureException(err: unknown, ctx?: SentryCtx): void {
  Sentry.withScope((scope) => {
    if (ctx?.userId) scope.setUser({ id: ctx.userId })
    if (ctx?.role) scope.setTag('role', ctx.role)
    if (ctx?.documentId) scope.setTag('documentId', ctx.documentId)
    if (ctx?.action) scope.setTag('action', ctx.action)
    Sentry.captureException(err)
  })
}

/**
 * Captures a message at warning or error level.
 */
export function captureMessage(
  message: string,
  level: Sentry.SeverityLevel = 'error',
  ctx?: SentryCtx
): void {
  Sentry.withScope((scope) => {
    if (ctx?.userId) scope.setUser({ id: ctx.userId })
    if (ctx?.role) scope.setTag('role', ctx.role)
    if (ctx?.documentId) scope.setTag('documentId', ctx.documentId)
    if (ctx?.action) scope.setTag('action', ctx.action)
    Sentry.captureMessage(message, level)
  })
}

/**
 * Sets user context for the current Sentry scope.
 * Only sends id — never email, name, or PII.
 */
export function setSentryUser(userId: string): void {
  Sentry.setUser({ id: userId })
}

export function clearSentryUser(): void {
  Sentry.setUser(null)
}
