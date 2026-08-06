'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function DeleteBusinessButton({
  businessId,
  businessName,
}: {
  businessId: string
  businessName: string
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function handleDelete() {
    const answer = window.prompt(
      `Esto borra "${businessName}" con todas sus conversaciones y su base de conocimiento. Escribí el nombre del negocio para confirmar:`,
    )
    if (answer !== businessName) return

    setBusy(true)
    await fetch(`/api/businesses/${businessId}`, { method: 'DELETE' })
    setBusy(false)
    router.refresh()
  }

  return (
    <button
      onClick={handleDelete}
      disabled={busy}
      className="text-xs text-gray-500 hover:text-danger disabled:opacity-50"
    >
      {busy ? 'Borrando…' : 'Eliminar'}
    </button>
  )
}
