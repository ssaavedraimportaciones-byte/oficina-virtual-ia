'use client'

interface Company { id: string; name: string }

interface Filters {
  dateFrom: string
  dateTo: string
  companyId: string
  workArea: string
  docType: string
  status: string
  createdBy: string
}

interface Props {
  filters: Filters
  companies: Company[]
  onChange: (f: Filters) => void
  canViewAll: boolean
}

const DOC_TYPES = [
  { value: '', label: 'Todos los tipos' },
  { value: 'SAFETY_TALK', label: 'Charla de Seguridad' },
  { value: 'DET', label: 'DET' },
  { value: 'ART', label: 'ART' },
  { value: 'AST', label: 'AST' },
  { value: 'WORK_PERMIT', label: 'Permiso de Trabajo' },
  { value: 'LOTO', label: 'LOTO' },
  { value: 'HEIGHT_WORK', label: 'Trabajo en Altura' },
  { value: 'CONFINED_SPACE', label: 'Espacio Confinado' },
  { value: 'LIFTING_PLAN', label: 'Plan de Izaje' },
  { value: 'EQUIPMENT_CHECKLIST', label: 'Checklist Equipos' },
  { value: 'OTHER', label: 'Otro' },
]

const STATUSES = [
  { value: '', label: 'Todos los estados' },
  { value: 'DRAFT', label: 'Borrador' },
  { value: 'PENDING_SIGNATURE', label: 'Pend. Firma' },
  { value: 'PENDING_APPROVAL', label: 'Pend. Aprobación' },
  { value: 'APPROVED', label: 'Aprobado' },
  { value: 'REJECTED', label: 'Rechazado' },
  { value: 'OBSERVED', label: 'Observado' },
  { value: 'CLOSED', label: 'Cerrado' },
  { value: 'ARCHIVED', label: 'Archivado' },
]

const selectCls = 'w-full bg-gray-900 border border-gray-700 text-gray-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-amber-600 appearance-none'
const inputCls  = 'w-full bg-gray-900 border border-gray-700 text-gray-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-amber-600'

export default function DashboardFilters({ filters, companies, onChange, canViewAll }: Props) {
  function set(key: keyof Filters, value: string) {
    onChange({ ...filters, [key]: value })
  }

  function resetToThisMonth() {
    const now = new Date()
    const from = new Date(now.getFullYear(), now.getMonth(), 1)
    onChange({
      ...filters,
      dateFrom: from.toISOString().slice(0, 10),
      dateTo: now.toISOString().slice(0, 10),
    })
  }

  function resetToToday() {
    const today = new Date().toISOString().slice(0, 10)
    onChange({ ...filters, dateFrom: today, dateTo: today })
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Filtros</p>
        <div className="flex gap-2">
          <button
            onClick={resetToToday}
            className="text-xs text-gray-500 hover:text-amber-400 transition-colors"
          >
            Hoy
          </button>
          <span className="text-gray-700">·</span>
          <button
            onClick={resetToThisMonth}
            className="text-xs text-gray-500 hover:text-amber-400 transition-colors"
          >
            Este mes
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Desde</label>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => set('dateFrom', e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Hasta</label>
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => set('dateTo', e.target.value)}
            className={inputCls}
          />
        </div>

        {canViewAll && (
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Empresa</label>
            <select value={filters.companyId} onChange={(e) => set('companyId', e.target.value)} className={selectCls}>
              <option value="">Todas</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="text-xs text-gray-500 mb-1 block">Área / Faena</label>
          <input
            type="text"
            placeholder="Filtrar por área…"
            value={filters.workArea}
            onChange={(e) => set('workArea', e.target.value)}
            className={inputCls}
          />
        </div>

        <div>
          <label className="text-xs text-gray-500 mb-1 block">Tipo doc.</label>
          <select value={filters.docType} onChange={(e) => set('docType', e.target.value)} className={selectCls}>
            {DOC_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs text-gray-500 mb-1 block">Estado</label>
          <select value={filters.status} onChange={(e) => set('status', e.target.value)} className={selectCls}>
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs text-gray-500 mb-1 block">Responsable</label>
          <input
            type="text"
            placeholder="ID usuario…"
            value={filters.createdBy}
            onChange={(e) => set('createdBy', e.target.value)}
            className={inputCls}
          />
        </div>
      </div>
    </div>
  )
}
