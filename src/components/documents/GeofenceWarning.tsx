'use client'

export type GeofenceStatus =
  | 'checking'
  | 'inside'
  | 'outside'
  | 'no_geofence'
  | 'gps_unavailable'
  | 'error'

interface Props {
  status: GeofenceStatus
  distanceMeters?: number
  radiusMeters?: number
  error?: string
}

const CONFIG: Record<GeofenceStatus, { icon: string; message: string; className: string }> = {
  checking:       { icon: '📍', message: 'Obteniendo ubicación GPS…',                     className: 'bg-blue-950 border-blue-800 text-blue-300' },
  inside:         { icon: '✅', message: 'Ubicación validada dentro del área autorizada', className: 'bg-green-950 border-green-800 text-green-300' },
  outside:        { icon: '🚫', message: 'Firma bloqueada: fuera del área configurada',    className: 'bg-red-950 border-red-800 text-red-300' },
  no_geofence:    { icon: '📌', message: 'Sin restricción de geofence — ubicación opcional', className: 'bg-gray-900 border-gray-700 text-gray-400' },
  gps_unavailable:{ icon: '❌', message: 'No se pudo validar ubicación — GPS no disponible', className: 'bg-yellow-950 border-yellow-800 text-yellow-300' },
  error:          { icon: '⚠️', message: 'Error al validar geofence',                     className: 'bg-orange-950 border-orange-800 text-orange-300' },
}

export default function GeofenceWarning({ status, distanceMeters, radiusMeters, error }: Props) {
  const cfg = CONFIG[status]
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-start gap-3 p-3 rounded-xl border text-sm ${cfg.className}`}
    >
      <span className="text-base flex-shrink-0 mt-0.5" aria-hidden>{cfg.icon}</span>
      <div className="flex-1 min-w-0">
        <p className="font-medium">{cfg.message}</p>
        {status === 'outside' && distanceMeters != null && radiusMeters != null && (
          <p className="text-xs mt-0.5 opacity-80">
            Distancia al área: {Math.round(distanceMeters)} m (radio máximo: {radiusMeters} m)
          </p>
        )}
        {status === 'gps_unavailable' && (
          <p className="text-xs mt-0.5 opacity-70">
            Active el GPS del dispositivo e intente nuevamente.
          </p>
        )}
        {status === 'error' && error && (
          <p className="text-xs mt-0.5 opacity-70">{error}</p>
        )}
      </div>
    </div>
  )
}
