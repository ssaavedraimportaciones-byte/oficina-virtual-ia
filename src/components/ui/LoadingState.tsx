'use client'

import Spinner from './Spinner'

interface Props {
  message?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export default function LoadingState({
  message = 'Cargando…',
  size = 'md',
  className = '',
}: Props) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center justify-center gap-3 py-12 text-gray-400 ${className}`}
    >
      <Spinner size={size} className="text-amber-500" />
      <p className="text-sm font-medium">{message}</p>
    </div>
  )
}

// Inline variant for inside buttons / small areas
export function InlineLoader({ message }: { message?: string }) {
  return (
    <span className="flex items-center justify-center gap-2">
      <Spinner size="sm" />
      {message && <span>{message}</span>}
    </span>
  )
}
