'use client'

import { useState, useEffect, useCallback } from 'react'
import SignatureModal from './SignatureModal'
import SignatureList from './SignatureList'
import type { SavedSignature } from '@/modules/signatures'

interface Props {
  documentId: string
  documentStatus: string
  /** Optional list of required signer role labels for display */
  requiredRoles?: string[]
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

const IMMUTABLE_STATUSES = ['APPROVED', 'CLOSED', 'ARCHIVED']

export default function RequiredSignaturesStatus({
  documentId,
  documentStatus,
  requiredRoles,
}: Props) {
  const [signatures, setSignatures] = useState<SavedSignature[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)

  const fetchSignatures = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/documents/${documentId}/signatures`)
      const data = await res.json()
      if (res.ok) setSignatures(data.signatures ?? [])
    } finally {
      setLoading(false)
    }
  }, [documentId])

  useEffect(() => {
    fetchSignatures()
  }, [fetchSignatures])

  function handleSigned(sig: SavedSignature) {
    setSignatures((prev) => [...prev, sig])
    setShowModal(false)
  }

  const canSign = !IMMUTABLE_STATUSES.includes(documentStatus)
  const signedRoles = new Set(signatures.map((s) => s.userRole))
  const required = requiredRoles ?? []

  const allRequiredSigned =
    required.length === 0 ||
    required.every((r) => signedRoles.has(r))

  return (
    <>
      <section className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-white">Firmas</h2>
          {canSign && (
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-1.5 text-sm bg-amber-500 hover:bg-amber-400 text-gray-950 font-semibold px-3 py-1.5 rounded-lg transition-colors"
            >
              ✍️ Firmar
            </button>
          )}
        </div>

        {/* Required roles status */}
        {required.length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">
              Firmas requeridas
            </p>
            <div className="flex flex-wrap gap-2">
              {required.map((role) => {
                const signed = signedRoles.has(role)
                return (
                  <span
                    key={role}
                    className={`text-xs px-2.5 py-1 rounded-full border ${
                      signed
                        ? 'bg-green-950 border-green-800 text-green-300'
                        : 'bg-gray-800 border-gray-700 text-gray-400'
                    }`}
                  >
                    {signed ? '✓ ' : '○ '}
                    {ROLE_LABELS[role] ?? role}
                  </span>
                )
              })}
            </div>
            {!allRequiredSigned && (
              <p className="text-xs text-orange-400 mt-2">
                ⚠️ Faltan firmas requeridas para avanzar el documento
              </p>
            )}
          </div>
        )}

        {/* Signature list */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-2">
          {loading ? (
            <div className="py-6 flex justify-center">
              <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <SignatureList signatures={signatures} />
          )}
        </div>

        {/* Status banner */}
        {!canSign && (
          <p className="text-xs text-gray-500 text-center mt-3">
            Las firmas están bloqueadas en estado <strong>{documentStatus}</strong>
          </p>
        )}
      </section>

      {showModal && (
        <SignatureModal
          documentId={documentId}
          onClose={() => setShowModal(false)}
          onSigned={handleSigned}
        />
      )}
    </>
  )
}
