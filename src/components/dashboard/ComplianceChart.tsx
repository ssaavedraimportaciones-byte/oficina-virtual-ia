'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, LabelList,
} from 'recharts'

interface AreaRow {
  area: string
  total: number
  approved: number
  rate: number
}

interface Props {
  data: AreaRow[]
  loading?: boolean
}

function rateColor(rate: number): string {
  if (rate >= 80) return '#22c55e'
  if (rate >= 50) return '#f59e0b'
  return '#ef4444'
}

export default function ComplianceChart({ data, loading }: Props) {
  if (loading) {
    return (
      <div className="h-64 bg-gray-800 rounded-xl animate-pulse" />
    )
  }

  if (data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-600 text-sm">
        Sin datos en el rango seleccionado
      </div>
    )
  }

  const chartData = data.map((d) => ({
    ...d,
    area: d.area.length > 18 ? d.area.slice(0, 16) + '…' : d.area,
  }))

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={chartData} margin={{ top: 16, right: 16, bottom: 8, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
        <XAxis
          dataKey="area"
          tick={{ fill: '#6b7280', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          domain={[0, 100]}
          tickFormatter={(v) => `${v}%`}
          tick={{ fill: '#6b7280', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={36}
        />
        <Tooltip
          cursor={{ fill: 'rgba(255,255,255,0.03)' }}
          contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: '#f3f4f6', marginBottom: 4 }}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any, name: any) => [
            name === 'rate' ? `${value}%` : value,
            name === 'rate' ? 'Cumplimiento' : name === 'approved' ? 'Aprobados' : 'Total',
          ] as any}
        />
        <Bar dataKey="rate" radius={[4, 4, 0, 0]} maxBarSize={48}>
          {chartData.map((entry, i) => (
            <Cell key={i} fill={rateColor(entry.rate)} />
          ))}
          <LabelList
            dataKey="rate"
            position="top"
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={((v: number) => `${v}%`) as any}
            style={{ fill: '#9ca3af', fontSize: 11 }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
