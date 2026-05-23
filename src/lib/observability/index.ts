import { randomUUID } from 'crypto'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogContext {
  requestId?: string
  userId?: string
  documentId?: string
  action?: string
  durationMs?: number
  [key: string]: unknown
}

function shouldLog(level: LogLevel): boolean {
  if (process.env.NODE_ENV === 'test') return false
  if (level === 'debug' && process.env.NODE_ENV === 'production') return false
  return true
}

function emit(level: LogLevel, message: string, ctx: LogContext = {}): void {
  if (!shouldLog(level)) return
  const entry = {
    ts: new Date().toISOString(),
    level,
    message,
    ...ctx,
  }
  const line = JSON.stringify(entry)
  if (level === 'error' || level === 'warn') {
    process.stderr.write(line + '\n')
  } else {
    process.stdout.write(line + '\n')
  }
}

export const logger = {
  debug: (message: string, ctx?: LogContext) => emit('debug', message, ctx),
  info:  (message: string, ctx?: LogContext) => emit('info',  message, ctx),
  warn:  (message: string, ctx?: LogContext) => emit('warn',  message, ctx),
  error: (message: string, ctx?: LogContext) => emit('error', message, ctx),
}

export function generateRequestId(): string {
  return randomUUID()
}

export function logRequest(
  method: string,
  path: string,
  status: number,
  durationMs: number,
  ctx: LogContext = {}
): void {
  const level: LogLevel = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info'
  emit(level, `${method} ${path} ${status}`, { durationMs, ...ctx })
}

// Metrics counters (in-process, reset on restart — use external monitoring for persistence)
const counters: Record<string, number> = {}

export function increment(metric: string, by = 1): void {
  counters[metric] = (counters[metric] ?? 0) + by
}

export function getMetrics(): Record<string, number> {
  return { ...counters }
}
