'use client'

interface CompanyRow {
  companyId: string
  companyName: string
  total: number
  approved: number
  rejected: number
  observed: number
  rate: number
}

interface Props {
  data: CompanyRow[]
  loading?: boolean
}

function RateBar({ rate }: { rate: number }) {
  const color =
    rate >= 80 ? 'bg-green-500' :
    rate >= 50 ? 'bg-amber-500' :
    'bg-red-500'

  return (
    <div className="flex items-center gap-2 flex-1 min-w-[80px]">
      <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all`}
          style={{ width: `${rate}%` }}
        />
      </div>
      <span className={`text-xs font-semibold font-mono w-10 text-right ${
        rate >= 80 ? 'text-green-400' : rate >= 50 ? 'text-amber-400' : 'text-red-400'
      }`}>
        {rate}%
      </span>
    </div>
  )
}

export default function CompanyComplianceRanking({ data, loading }: Props) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-14 bg-gray-800 rounded-lg animate-pulse" />
        ))}
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="py-8 text-center text-gray-600 text-sm">Sin datos disponibles</div>
    )
  }

  return (
    <div className="space-y-2">
      {data.map((row, i) => (
        <div key={row.companyId} className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-3">
          <div className="flex items-center gap-3">
            <span className={`text-xs font-bold w-5 flex-shrink-0 ${
              i === 0 ? 'text-amber-400' : i === 1 ? 'text-gray-400' : i === 2 ? 'text-orange-700' : 'text-gray-600'
            }`}>
              #{i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <p className="text-sm text-gray-200 font-medium truncate">{row.companyName}</p>
                <div className="flex items-center gap-3 flex-shrink-0 text-xs text-gray-500">
                  <span title="Total">{row.total} docs</span>
                  <span title="Aprobados" className="text-green-600">✓{row.approved}</span>
                  <span title="Rechazados" className="text-red-600">✗{row.rejected}</span>
                  <span title="Observados" className="text-orange-600">!{row.observed}</span>
                </div>
              </div>
              <RateBar rate={row.rate} />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
