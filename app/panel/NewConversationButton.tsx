'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Conversation } from '@/lib/types'

export default function NewConversationButton() {
  const router = useRouter()
  const [creating, setCreating] = useState(false)

  async function handleClick() {
    const contactName = window.prompt('¿Cómo se llama el contacto de prueba?', 'Cliente de prueba')
    if (!contactName) return

    setCreating(true)
    const res = await fetch('/api/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel: 'simulador',
        contactName,
        contactHandle: `sim-${Date.now()}`,
      }),
    })
    setCreating(false)

    if (res.ok) {
      const { conversation }: { conversation: Conversation } = await res.json()
      router.push(`/panel/conversaciones/${conversation.id}`)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={creating}
      className="rounded-md border border-gray-700 px-4 py-2 text-sm text-gray-200 hover:border-amber-500 hover:text-amber-400 disabled:opacity-50"
    >
      {creating ? 'Creando…' : '+ Probar conversación'}
    </button>
  )
}
