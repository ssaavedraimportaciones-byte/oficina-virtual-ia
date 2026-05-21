import { CONFIDENCE_THRESHOLD } from '@/modules/ocr'

interface Props {
  confidence: number | null
  size?: 'xs' | 'sm'
}

export default function FieldConfidenceBadge({ confidence, size = 'sm' }: Props) {
  if (confidence === null) {
    return (
      <span
        className={`inline-flex items-center font-medium rounded-full bg-gray-700 text-gray-400 ${
          size === 'xs' ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-0.5 text-xs'
        }`}
      >
        Manual
      </span>
    )
  }

  const pct = Math.round(confidence * 100)

  let cls = ''
  let label = ''

  if (confidence >= CONFIDENCE_THRESHOLD) {
    cls = 'bg-green-900 text-green-300'
    label = `${pct}%`
  } else if (confidence >= 0.6) {
    cls = 'bg-yellow-900 text-yellow-300'
    label = `${pct}% ⚠`
  } else {
    cls = 'bg-red-900 text-red-300'
    label = `${pct}% ✗`
  }

  return (
    <span
      className={`inline-flex items-center font-mono font-medium rounded-full ${cls} ${
        size === 'xs' ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-0.5 text-xs'
      }`}
      title={confidence < CONFIDENCE_THRESHOLD ? 'Requiere revisión humana' : undefined}
    >
      {label}
    </span>
  )
}
