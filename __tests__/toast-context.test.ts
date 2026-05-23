import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Pure logic tests for toast state management — no React/DOM required.

type ToastType = 'success' | 'error' | 'warning' | 'info'

interface Toast {
  id: string
  message: string
  type: ToastType
  durationMs: number
}

const DEFAULT_DURATIONS: Record<ToastType, number> = {
  success: 3000,
  info: 4000,
  warning: 5000,
  error: 6000,
}

const MAX_TOASTS = 5

function createToast(message: string, type: ToastType = 'info', durationMs?: number): Toast {
  return {
    id: Math.random().toString(36).slice(2),
    message,
    type,
    durationMs: durationMs ?? DEFAULT_DURATIONS[type],
  }
}

function addToast(toasts: Toast[], newToast: Toast): Toast[] {
  const updated = [...toasts, newToast]
  return updated.length > MAX_TOASTS ? updated.slice(updated.length - MAX_TOASTS) : updated
}

function removeToast(toasts: Toast[], id: string): Toast[] {
  return toasts.filter((t) => t.id !== id)
}

describe('toast state logic', () => {
  it('assigns correct default duration for each type', () => {
    expect(createToast('ok', 'success').durationMs).toBe(3000)
    expect(createToast('info', 'info').durationMs).toBe(4000)
    expect(createToast('warn', 'warning').durationMs).toBe(5000)
    expect(createToast('err', 'error').durationMs).toBe(6000)
  })

  it('respects custom durationMs when provided', () => {
    const t = createToast('msg', 'success', 1500)
    expect(t.durationMs).toBe(1500)
  })

  it('adds toast to list', () => {
    const t = createToast('hello', 'info')
    const result = addToast([], t)
    expect(result).toHaveLength(1)
    expect(result[0].message).toBe('hello')
  })

  it('removes toast by id', () => {
    const t1 = createToast('a', 'info')
    const t2 = createToast('b', 'error')
    const list = [t1, t2]
    const result = removeToast(list, t1.id)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe(t2.id)
  })

  it('caps at MAX_TOASTS (5) — drops oldest when exceeded', () => {
    let toasts: Toast[] = []
    for (let i = 0; i < 6; i++) {
      toasts = addToast(toasts, createToast(`msg ${i}`, 'info'))
    }
    expect(toasts).toHaveLength(MAX_TOASTS)
    expect(toasts[0].message).toBe('msg 1')
    expect(toasts[MAX_TOASTS - 1].message).toBe('msg 5')
  })

  it('exactly MAX_TOASTS does not drop any', () => {
    let toasts: Toast[] = []
    for (let i = 0; i < MAX_TOASTS; i++) {
      toasts = addToast(toasts, createToast(`msg ${i}`, 'info'))
    }
    expect(toasts).toHaveLength(MAX_TOASTS)
  })

  it('each toast gets a unique id', () => {
    const toasts = [createToast('a'), createToast('b'), createToast('c')]
    const ids = toasts.map((t) => t.id)
    const unique = new Set(ids)
    expect(unique.size).toBe(3)
  })
})
