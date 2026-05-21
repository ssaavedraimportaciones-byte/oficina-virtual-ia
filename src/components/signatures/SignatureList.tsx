'use client'

import { useState } from 'react'
import type { SavedSignature } from '@/modules/signatures'

interface Props {
  signatures: SavedSignature[]
}

const METHOD_LABELS: Record<string, string> = {
  CANVAS: 'Manuscrita',
  PIN: 'PIN',
  QR: 'QR',
  DIGITAL: 'Digital',
  HANDWRITTEN: 'Manuscrita',
  BIOMETRIC: 'Biométrica',
}

const ROLE_LABELS: Record<string, string> = {
  WORKER: 'Trabajador',
  SUPERVISOR: 'Supervisor',
  PREVENTIONIST: 'Prevencionista',
  CONTRACT_ADMIN: 'Admin. Contratos',
  MANAGER: 'Gerente',
  AUDITOR: 'Auditor',
  SYSTEM_ADMIN: 'Administrador',
}

export default function SignatureList({ signatures }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null)

  if (signatures.length === 0) {
    return (
      <p className="text-sm text-gray-500 text-center py-4">
        Aún no hay firmas en este documento.
      </p>
    )
  }

  return (
    <div className="divide-y divide-gray-800">
      {signatures.map((sig) => (
        <div key={sig.id} className="py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {/* Signature thumbnail */}
              <button
                onClick={() => setExpanded(expanded === sig.id ? null : sig.id)}
                className="flex-shrink-0 w-16 h-10 rounded-lg overflow-hidden border border-gray-700 hover:border-amber-600 transition-colors bg-gray-900"
                title="Ver firma"
              >
                <img
                  src={sig.signatureImageUrl}
                  alt={`Firma de ${sig.userName}`}
                  className="w-full h-full object-contain"
                />
              </button>

              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-200 truncate">{sig.userName}</p>
                <p className="text-xs text-gray-500">
                  {ROLE_LABELS[sig.userRole] ?? sig.userRole}
                  {' · '}
                  {METHOD_LABELS[sig.method] ?? sig.method}
                </p>
              </div>
            </div>

            <div className="text-right flex-shrink-0">
              <p className="text-xs text-gray-400">
                {new Date(sig.signedAt).toLocaleDateString('es-CL', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </p>
              <p className="text-xs text-gray-600">
                {new Date(sig.signedAt).toLocaleTimeString('es-CL', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
              {sig.gpsLat && (
                <p className="text-xs text-gray-700 mt-0.5">
                  📍 {sig.gpsLat.toFixed(3)}, {sig.gpsLng?.toFixed(3)}
                </p>
              )}
            </div>
          </div>

          {/* Expanded hash detail */}
          {expanded === sig.id && (
            <div className="mt-3 bg-gray-900 border border-gray-800 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="w-full">
                  <img
                    src={sig.signatureImageUrl}
                    alt={`Firma ampliada de ${sig.userName}`}
                    className="w-full max-h-24 object-contain bg-gray-950 rounded-lg border border-gray-800 p-2"
                  />
                </div>
                {sig.hash && (
                  <div className="w-full">
                    <p className="text-xs text-gray-500 mb-1">Hash SHA-256</p>
                    <p className="font-mono text-xs text-gray-400 break-all">{sig.hash}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
