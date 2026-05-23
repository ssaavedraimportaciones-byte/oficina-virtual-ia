'use client'

interface Props {
  confidence: number | null | undefined
  showLabel?: boolean
}

function getConfig(c: number | null | undefined): {
  label: string
  className: string
  tier: 'high' | 'medium' | 'low' | 'manual'
} {
  if (c == null) return { label: 'Manual', className: 'bg-gray-800 text-gray-400 border-gray-700', tier: 'manual' }
  if (c >= 0.9) return { label: 'Alta', className: 'bg-green-950 text-green-400 border-green-800', tier: 'high' }
  if (c >= 0.8) return { label: 'Media', className: 'bg-yellow-950 text-yellow-400 border-yellow-800', tier: 'medium' }
  return { label: 'Revisar', className: 'bg-red-950 text-red-400 border-red-800', tier: 'low' }
}

export default function ConfidenceBadge({ confidence, showLabel = true }: Props) {
  const cfg = getConfig(confidence)
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium border px-1.5 py-0.5 rounded ${cfg.className}`}
      title={confidence != null ? `Confianza OCR: ${Math.round(confidence * 100)}%` : 'Ingresado manualmente'}
    >
      {confidence != null && <span>{Math.round(confidence * 100)}%</span>}
      {showLabel && <span>{cfg.label}</span>}
    </span>
  )
}

export { getConfig as getConfidenceConfig }
