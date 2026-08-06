'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import type { Conversation } from '@/lib/types'

export default function ConversationPage() {
  const params = useParams<{ id: string }>()
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  async function load() {
    const res = await fetch(`/api/conversations/${params.id}`)
    if (res.ok) {
      const data = await res.json()
      setConversation(data.conversation)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [conversation?.messages.length])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    setSending(true)
    setError(null)

    const res = await fetch(`/api/conversations/${params.id}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sender: 'contact', text }),
    })

    setSending(false)
    setText('')

    const data = await res.json()
    if (data.conversation) setConversation(data.conversation)
    if (!res.ok) setError(data.error ?? 'No se pudo generar la respuesta del agente')
  }

  if (!conversation) {
    return <div className="px-8 py-10 text-gray-500">Cargando…</div>
  }

  return (
    <div className="flex h-screen">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="border-b border-gray-800 px-8 py-4">
          <h1 className="font-medium text-white">{conversation.contactName}</h1>
          <p className="text-xs text-gray-500">{conversation.contactHandle}</p>
        </div>

        <div className="flex-1 overflow-y-auto px-8 py-6">
          <div className="mx-auto flex max-w-2xl flex-col gap-3">
            {conversation.messages.length === 0 && (
              <p className="text-center text-sm text-gray-500">
                Escribí un mensaje como si fueras el cliente para probar al agente.
              </p>
            )}
            {conversation.messages.map((message) => (
              <div
                key={message.id}
                className={`max-w-[75%] rounded-lg px-4 py-2 text-sm ${
                  message.sender === 'contact'
                    ? 'self-start bg-gray-800 text-gray-100'
                    : message.sender === 'agent'
                      ? 'self-end bg-amber-500 text-gray-950'
                      : 'self-end bg-gray-700 text-gray-100'
                }`}
              >
                {message.text}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        </div>

        {error && <p className="px-8 pb-2 text-sm text-danger">{error}</p>}

        <form onSubmit={handleSend} className="flex gap-3 border-t border-gray-800 px-8 py-4">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Escribí como si fueras el cliente…"
            className="input flex-1"
          />
          <button
            type="submit"
            disabled={sending}
            className="rounded-md bg-amber-500 px-5 py-2 text-sm font-medium text-gray-950 hover:bg-amber-400 disabled:opacity-50"
          >
            {sending ? 'Enviando…' : 'Enviar'}
          </button>
        </form>
      </div>

      <aside className="w-72 shrink-0 border-l border-gray-800 p-6">
        <h2 className="text-sm font-medium text-white">Ficha del cliente</h2>
        <p className="mt-1 text-xs text-gray-500">
          El agente la va actualizando solo con lo que va aprendiendo en la charla.
        </p>
        <div className="mt-4 whitespace-pre-line text-sm text-gray-400">
          {conversation.notes || 'Todavía no hay datos suficientes.'}
        </div>
      </aside>
    </div>
  )
}
