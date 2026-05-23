'use client'

import { useToast, type Toast, type ToastType } from '@/contexts/toast-context'

const TOAST_CONFIG: Record<ToastType, { icon: string; className: string }> = {
  success: { icon: '✅', className: 'bg-green-950 border-green-700 text-green-200' },
  error:   { icon: '❌', className: 'bg-red-950 border-red-700 text-red-200' },
  warning: { icon: '⚠️', className: 'bg-yellow-950 border-yellow-700 text-yellow-200' },
  info:    { icon: 'ℹ️', className: 'bg-gray-900 border-gray-700 text-gray-200' },
}

function ToastItem({ t, onDismiss }: { t: Toast; onDismiss: (id: string) => void }) {
  const cfg = TOAST_CONFIG[t.type]
  return (
    <div
      role="alert"
      aria-live="polite"
      className={`flex items-start gap-3 px-4 py-3 rounded-xl border shadow-lg text-sm max-w-sm w-full ${cfg.className}`}
    >
      <span aria-hidden className="text-base flex-shrink-0 mt-0.5">{cfg.icon}</span>
      <span className="flex-1 leading-snug">{t.message}</span>
      <button
        onClick={() => onDismiss(t.id)}
        aria-label="Cerrar"
        className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity text-lg leading-none"
      >
        ×
      </button>
    </div>
  )
}

export default function ToastContainer() {
  const { toasts, dismiss } = useToast()
  if (toasts.length === 0) return null
  return (
    <div
      aria-label="Notificaciones"
      className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none"
    >
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto animate-in fade-in slide-in-from-bottom-2">
          <ToastItem t={t} onDismiss={dismiss} />
        </div>
      ))}
    </div>
  )
}
