'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import type { Conversation, MessageSender } from '@/lib/types'

const CHANNEL_LABELS: Record<Conversation['channel'], string> = {
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  simulador: 'Simulador',
}

/** Cada cuánto se buscan mensajes nuevos en una conversación real. */
const POLL_MS = 5000

export default function ConversationPage() {
  const params = useParams<{ businessId: string; conversationId: string }>()
  const conversationId = params.conversationId

  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [text, setText] = useState('')
  // En el simulador se puede escribir como cliente (para probar al agente) o
  // como equipo (para probar la derivación). En un canal real, solo como equipo.
  const [writeAs, setWriteAs] = useState<'contact' | 'human'>('contact')
  const [sending, setSending] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    const res = await fetch(`/api/conversations/${conversationId}`)
    if (res.ok) {
      const data = await res.json()
      setConversation(data.conversation)
    }
  }, [conversationId])

  useEffect(() => {
    load()
  }, [load])

  const loaded = conversation !== null
  const isSimulator = conversation?.channel === 'simulador'

  // Los mensajes de WhatsApp/Instagram entran por webhook: sin esto, quien
  // tomó la conversación no ve lo que responde el cliente hasta recargar.
  useEffect(() => {
    if (!loaded || isSimulator) return
    const timer = setInterval(load, POLL_MS)
    return () => clearInterval(timer)
  }, [loaded, isSimulator, load])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [conversation?.messages.length])

  const sender: MessageSender = isSimulator ? writeAs : 'human'

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    setSending(true)
    setError(null)

    const res = await fetch(`/api/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sender, text }),
    })

    setSending(false)
    const data = await res.json()
    if (data.conversation) setConversation(data.conversation)
    if (!res.ok) {
      setError(
        typeof data.error === 'string'
          ? data.error
          : sender === 'human'
            ? 'No se pudo enviar el mensaje'
            : 'No se pudo generar la respuesta del agente',
      )
      return
    }
    setText('')
  }

  async function toggleAgent() {
    if (!conversation) return
    setToggling(true)
    setError(null)
    const res = await fetch(`/api/conversations/${conversationId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentPaused: !conversation.agentPaused }),
    })
    setToggling(false)
    const data = await res.json()
    if (data.conversation) setConversation(data.conversation)
    if (!res.ok) setError('No se pudo cambiar el estado del agente')
  }

  if (!conversation) {
    return <div className="px-8 py-10 text-gray-500">Cargando…</div>
  }

  const placeholder =
    sender === 'contact'
      ? 'Escribí como si fueras el cliente…'
      : isSimulator
        ? 'Escribí como alguien del equipo…'
        : `Responder como equipo (le llega por ${CHANNEL_LABELS[conversation.channel]})…`

  return (
    <div className="flex h-screen">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between gap-4 border-b border-gray-800 px-8 py-4">
          <div className="min-w-0">
            <h1 className="truncate font-medium text-white">{conversation.contactName}</h1>
            <p className="text-xs text-gray-500">
              {CHANNEL_LABELS[conversation.channel]} · {conversation.contactHandle}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] uppercase ${
                conversation.agentPaused
                  ? 'border-amber-700 text-amber-400'
                  : 'border-emerald-800 text-emerald-500'
              }`}
            >
              {conversation.agentPaused ? 'Atiende una persona' : 'Responde el agente'}
            </span>
            <button
              onClick={toggleAgent}
              disabled={toggling}
              className="text-xs text-amber-400 hover:underline disabled:opacity-50"
            >
              {conversation.agentPaused ? 'Devolverle al agente' : 'Tomar la conversación'}
            </button>
          </div>
        </div>

        {conversation.agentPaused && conversation.handoffReason && (
          <div className="border-b border-amber-900/50 bg-amber-950/30 px-8 py-2 text-xs text-amber-300">
            {conversation.handoffReason}
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-8 py-6">
          <div className="mx-auto flex max-w-2xl flex-col gap-3">
            {conversation.messages.length === 0 && (
              <p className="text-center text-sm text-gray-500">
                {isSimulator
                  ? 'Escribí un mensaje como si fueras el cliente para probar al agente.'
                  : 'Todavía no hay mensajes.'}
              </p>
            )}
            {conversation.messages.map((message) => (
              <div
                key={message.id}
                className={`flex max-w-[75%] flex-col ${message.sender === 'contact' ? 'self-start' : 'self-end items-end'}`}
              >
                <div
                  className={`whitespace-pre-line rounded-lg px-4 py-2 text-sm ${
                    message.sender === 'contact'
                      ? 'bg-gray-800 text-gray-100'
                      : message.sender === 'agent'
                        ? 'bg-amber-500 text-gray-950'
                        : 'bg-gray-700 text-gray-100'
                  }`}
                >
                  {message.text}
                </div>
                {message.sender === 'human' && (
                  <span className="mt-0.5 text-[10px] text-gray-500">Equipo</span>
                )}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        </div>

        {error && <p className="px-8 pb-2 text-sm text-danger">{error}</p>}

        <form onSubmit={handleSend} className="flex flex-col gap-2 border-t border-gray-800 px-8 py-4">
          {isSimulator && (
            <div className="flex gap-3 text-xs">
              <span className="text-gray-500">Escribir como:</span>
              {(['contact', 'human'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setWriteAs(option)}
                  className={writeAs === option ? 'text-amber-400' : 'text-gray-500 hover:text-gray-300'}
                >
                  {option === 'contact' ? 'Cliente' : 'Equipo'}
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-3">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={placeholder}
              className="input flex-1"
            />
            <button
              type="submit"
              disabled={sending}
              className="rounded-md bg-amber-500 px-5 py-2 text-sm font-medium text-gray-950 hover:bg-amber-400 disabled:opacity-50"
            >
              {sending ? 'Enviando…' : 'Enviar'}
            </button>
          </div>
          {sender === 'human' && !conversation.agentPaused && (
            <p className="text-xs text-gray-600">
              Al responder vos, el agente deja de contestar en esta conversación hasta que se la devuelvas.
            </p>
          )}
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
