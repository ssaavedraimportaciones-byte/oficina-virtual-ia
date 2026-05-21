interface Props {
  title: string
  value: string | number | null
  subtitle?: string
  icon: string
  color?: 'amber' | 'green' | 'red' | 'blue' | 'orange' | 'gray' | 'purple'
  trend?: { value: number; label: string }
  loading?: boolean
}

const COLOR_MAP: Record<NonNullable<Props['color']>, { bg: string; border: string; text: string; icon: string }> = {
  amber:  { bg: 'bg-amber-950/40',  border: 'border-amber-800/50',  text: 'text-amber-300',  icon: 'bg-amber-500/20 text-amber-400' },
  green:  { bg: 'bg-green-950/40',  border: 'border-green-800/50',  text: 'text-green-300',  icon: 'bg-green-500/20 text-green-400' },
  red:    { bg: 'bg-red-950/40',    border: 'border-red-800/50',    text: 'text-red-300',    icon: 'bg-red-500/20 text-red-400' },
  blue:   { bg: 'bg-blue-950/40',   border: 'border-blue-800/50',   text: 'text-blue-300',   icon: 'bg-blue-500/20 text-blue-400' },
  orange: { bg: 'bg-orange-950/40', border: 'border-orange-800/50', text: 'text-orange-300', icon: 'bg-orange-500/20 text-orange-400' },
  gray:   { bg: 'bg-gray-900',      border: 'border-gray-800',      text: 'text-gray-300',   icon: 'bg-gray-700 text-gray-400' },
  purple: { bg: 'bg-purple-950/40', border: 'border-purple-800/50', text: 'text-purple-300', icon: 'bg-purple-500/20 text-purple-400' },
}

export default function DashboardCard({ title, value, subtitle, icon, color = 'gray', trend, loading }: Props) {
  const c = COLOR_MAP[color]

  return (
    <div className={`rounded-xl border p-4 ${c.bg} ${c.border}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide truncate">{title}</p>
          {loading ? (
            <div className="h-8 w-16 bg-gray-800 rounded animate-pulse mt-2" />
          ) : (
            <p className={`text-3xl font-bold mt-1 ${c.text}`}>
              {value ?? '—'}
            </p>
          )}
          {subtitle && !loading && (
            <p className="text-xs text-gray-500 mt-1 truncate">{subtitle}</p>
          )}
          {trend && !loading && (
            <p className={`text-xs mt-1 ${trend.value >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {trend.value >= 0 ? '▲' : '▼'} {Math.abs(trend.value)}% {trend.label}
            </p>
          )}
        </div>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 text-lg ${c.icon}`}>
          {icon}
        </div>
      </div>
    </div>
  )
}
