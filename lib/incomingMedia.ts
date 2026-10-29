import { env } from './llm/env'
import type { ChannelCredentials } from './types'
import { GRAPH_VERSION, resolveCredentials } from './whatsapp'

/**
 * Audios que mandan los clientes por WhatsApp. El agente es un modelo de texto:
 * no escucha. Acá se baja la nota de voz desde Meta y se transcribe, y el
 * resultado entra a la conversación como si el cliente lo hubiera escrito.
 *
 * Todo es "mejor esfuerzo": si algo falla (sin clave, audio muy largo, el
 * servicio de voz caído), devuelve `null` y el webhook cae al aviso de siempre
 * ("el contacto envió un audio"), en vez de perder el mensaje.
 */

/** Tope de tamaño que se baja y se manda a transcribir (una nota de voz de varios minutos pesa unos MB). */
export const MAX_AUDIO_BYTES = 10 * 1024 * 1024
/** Lo que se guarda como máximo de una transcripción, por si alguien manda un audio larguísimo. */
const MAX_TRANSCRIPT_CHARS = 2000
const TIMEOUT_MS = 20_000
const TRANSCRIBE_TIMEOUT_MS = 30_000

/** Marca que lleva el texto de un audio transcrito; el prompt del agente la reconoce. */
export const AUDIO_MARK = '🎤'

/** Los archivos de WhatsApp se bajan solo de dominios de Meta: con el token puesto, no se le manda a cualquiera. */
const META_MEDIA_HOSTS = ['fbsbx.com', 'whatsapp.net', 'fbcdn.net', 'facebook.com']

export function isMetaMediaUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return (
      url.protocol === 'https:' &&
      META_MEDIA_HOSTS.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`))
    )
  } catch {
    return false
  }
}

export async function downloadWhatsAppMedia(
  mediaId: string,
  credentials?: ChannelCredentials,
): Promise<{ bytes: Uint8Array; mimeType: string }> {
  const { token } = resolveCredentials(credentials)
  if (!token) throw new Error('Faltan credenciales de WhatsApp para bajar el audio')
  const headers = { Authorization: `Bearer ${token}` }

  const meta = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(mediaId)}`, {
    headers,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!meta.ok) throw new Error(`WhatsApp no entregó los datos del audio (${meta.status})`)
  const info = (await meta.json()) as { url?: string; mime_type?: string; file_size?: number }

  if (!info.url || !isMetaMediaUrl(info.url)) throw new Error('La dirección del audio no es de Meta')
  if (info.file_size && info.file_size > MAX_AUDIO_BYTES) throw new Error('El audio es demasiado largo')

  const file = await fetch(info.url, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) })
  if (!file.ok) throw new Error(`No se pudo bajar el audio (${file.status})`)
  const bytes = new Uint8Array(await file.arrayBuffer())
  if (bytes.length === 0) throw new Error('El audio llegó vacío')
  if (bytes.length > MAX_AUDIO_BYTES) throw new Error('El audio es demasiado largo')

  return { bytes, mimeType: info.mime_type ?? 'audio/ogg' }
}

export interface TranscriptionConfig {
  url: string
  apiKey: string
  model: string
}

/**
 * Con qué servicio se transcribe. Se reutiliza la clave que ya está para el
 * agente: Groq (modelo Whisper, con capa gratuita) o OpenAI. Con otro servidor
 * compatible no se sabe si ofrece transcripción, y con solo Anthropic no hay,
 * así que ahí devuelve `null` y no se transcribe.
 */
export function transcriptionConfig(): TranscriptionConfig | null {
  const apiKey = env('OPENAI_API_KEY')
  if (!apiKey) return null
  const model = env('TRANSCRIPTION_MODEL')
  const base = env('OPENAI_BASE_URL')

  if (!base) {
    return { url: 'https://api.openai.com/v1/audio/transcriptions', apiKey, model: model ?? 'whisper-1' }
  }
  try {
    if (new URL(base).host === 'api.groq.com') {
      return {
        url: `${base.replace(/\/+$/, '')}/audio/transcriptions`,
        apiKey,
        model: model ?? 'whisper-large-v3-turbo',
      }
    }
  } catch {
    // base inválida: el agente tampoco funcionaría; acá simplemente no se transcribe.
  }
  return null
}

/** La extensión importa: el servicio de voz decide el formato por el nombre del archivo. */
export function audioExtension(mimeType: string): string {
  const type = mimeType.toLowerCase()
  if (type.includes('ogg') || type.includes('opus')) return 'ogg'
  if (type.includes('mpeg') || type.includes('mp3')) return 'mp3'
  if (type.includes('mp4') || type.includes('aac') || type.includes('m4a')) return 'm4a'
  if (type.includes('wav')) return 'wav'
  if (type.includes('webm')) return 'webm'
  if (type.includes('flac')) return 'flac'
  return 'ogg'
}

export async function transcribeAudio(bytes: Uint8Array, mimeType: string): Promise<string | null> {
  const config = transcriptionConfig()
  if (!config) return null

  const form = new FormData()
  form.append('file', new Blob([new Uint8Array(bytes)], { type: mimeType }), `audio.${audioExtension(mimeType)}`)
  form.append('model', config.model)
  // Es un negocio chileno: sin esto, un audio corto o con ruido a veces se
  // detecta como otro idioma y sale cualquier cosa.
  form.append('language', 'es')
  form.append('response_format', 'json')
  form.append('temperature', '0')

  const res = await fetch(config.url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.apiKey}` },
    body: form,
    signal: AbortSignal.timeout(TRANSCRIBE_TIMEOUT_MS),
  })
  if (!res.ok) {
    throw new Error(`La transcripción respondió ${res.status}: ${(await res.text()).slice(0, 200)}`)
  }
  const data = (await res.json()) as { text?: unknown }
  return typeof data.text === 'string' ? data.text.trim() : ''
}

/**
 * Texto de una nota de voz, listo para la conversación, o `null` si no se pudo
 * (sin servicio de voz, audio muy largo, falla de red, silencio). Nunca lanza.
 */
export async function audioMessageText(
  mediaId: string,
  credentials?: ChannelCredentials,
): Promise<string | null> {
  if (!transcriptionConfig()) return null
  try {
    const { bytes, mimeType } = await downloadWhatsAppMedia(mediaId, credentials)
    const transcript = await transcribeAudio(bytes, mimeType)
    if (!transcript) return null
    return `${AUDIO_MARK} ${transcript.slice(0, MAX_TRANSCRIPT_CHARS)}`
  } catch (error) {
    console.error('[audio whatsapp] no se pudo transcribir:', error instanceof Error ? error.message : error)
    return null
  }
}
