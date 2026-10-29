import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  audioExtension,
  audioMessageText,
  isMetaMediaUrl,
  MAX_AUDIO_BYTES,
  transcriptionConfig,
} from '../incomingMedia'

/**
 * Notas de voz de clientes: se bajan de Meta y se transcriben para que el
 * agente (un modelo de texto) pueda responderlas. Lo que importa acá es que
 * nunca se pierda el mensaje si algo falla, y que el token de WhatsApp no
 * salga hacia un servidor que no sea de Meta.
 */
const ORIGINAL = { ...process.env }
const CREDENTIALS = {
  whatsappAccessToken: 'token-whatsapp',
  whatsappPhoneNumberId: '123',
  instagramPageId: null,
  instagramAccessToken: null,
}
const OGG = new Uint8Array([0x4f, 0x67, 0x67, 0x53, 1, 2, 3])

function useGroq() {
  process.env.OPENAI_API_KEY = 'gsk_prueba'
  process.env.OPENAI_BASE_URL = 'https://api.groq.com/openai/v1'
  delete process.env.TRANSCRIPTION_MODEL
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
  process.env = { ...ORIGINAL }
})

/** Simula las tres llamadas: datos del archivo en Meta, el archivo, y la transcripción. */
function mockFetch(opts: {
  mediaUrl?: string
  fileSize?: number
  transcription?: () => Response
  file?: Uint8Array
} = {}) {
  const calls: Array<{ url: string; init?: RequestInit }> = []
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input)
    calls.push({ url, init })
    if (url.startsWith('https://graph.facebook.com/')) {
      return Response.json({
        url: opts.mediaUrl ?? 'https://lookaside.fbsbx.com/whatsapp_business/attachments/?mid=1',
        mime_type: 'audio/ogg; codecs=opus',
        file_size: opts.fileSize ?? OGG.length,
      })
    }
    if (url.includes('/audio/transcriptions')) {
      return opts.transcription?.() ?? Response.json({ text: '  Hola, quiero una pizza  ' })
    }
    return new Response(new Uint8Array(opts.file ?? OGG))
  })
  return calls
}

describe('de qué dominios se baja un audio', () => {
  it('acepta los dominios de Meta', () => {
    expect(isMetaMediaUrl('https://lookaside.fbsbx.com/whatsapp_business/attachments/?mid=1')).toBe(true)
    expect(isMetaMediaUrl('https://mmg.whatsapp.net/v/t62/x.enc')).toBe(true)
  })

  it('rechaza los que solo se le parecen o no son https', () => {
    expect(isMetaMediaUrl('http://lookaside.fbsbx.com/x')).toBe(false)
    expect(isMetaMediaUrl('https://fbsbx.com.evil.com/x')).toBe(false)
    expect(isMetaMediaUrl('https://notfbsbx.com/x')).toBe(false)
    expect(isMetaMediaUrl('https://evil.com/fbsbx.com')).toBe(false)
    expect(isMetaMediaUrl('no es una url')).toBe(false)
  })
})

describe('con qué servicio se transcribe', () => {
  it('usa Whisper de Groq con la misma clave del agente', () => {
    useGroq()
    expect(transcriptionConfig()).toEqual({
      url: 'https://api.groq.com/openai/v1/audio/transcriptions',
      apiKey: 'gsk_prueba',
      model: 'whisper-large-v3-turbo',
    })
  })

  it('usa whisper-1 con OpenAI directo', () => {
    process.env.OPENAI_API_KEY = 'sk-prueba'
    delete process.env.OPENAI_BASE_URL
    expect(transcriptionConfig()).toMatchObject({ url: 'https://api.openai.com/v1/audio/transcriptions', model: 'whisper-1' })
  })

  it('no transcribe con otro servidor compatible ni sin clave', () => {
    process.env.OPENAI_API_KEY = 'x'
    process.env.OPENAI_BASE_URL = 'http://localhost:11434/v1'
    expect(transcriptionConfig()).toBeNull()
    delete process.env.OPENAI_API_KEY
    expect(transcriptionConfig()).toBeNull()
  })

  it('permite cambiar el modelo por variable de entorno', () => {
    useGroq()
    process.env.TRANSCRIPTION_MODEL = 'whisper-large-v3'
    expect(transcriptionConfig()?.model).toBe('whisper-large-v3')
  })

  it('le pone al archivo la extensión que corresponde al formato', () => {
    expect(audioExtension('audio/ogg; codecs=opus')).toBe('ogg')
    expect(audioExtension('audio/mpeg')).toBe('mp3')
    expect(audioExtension('audio/mp4')).toBe('m4a')
    expect(audioExtension('algo/raro')).toBe('ogg')
  })
})

describe('nota de voz a texto', () => {
  it('baja el audio con el token, lo transcribe y lo marca con 🎤', async () => {
    useGroq()
    const calls = mockFetch()

    expect(await audioMessageText('media-1', CREDENTIALS)).toBe('🎤 Hola, quiero una pizza')

    expect(calls).toHaveLength(3)
    const header = (call: number) => (calls[call].init?.headers as Record<string, string>)?.Authorization
    expect(header(0)).toBe('Bearer token-whatsapp')
    expect(header(1)).toBe('Bearer token-whatsapp')
    expect(header(2)).toBe('Bearer gsk_prueba')
    const form = calls[2].init?.body as FormData
    expect(form.get('model')).toBe('whisper-large-v3-turbo')
    expect(form.get('language')).toBe('es')
    expect((form.get('file') as File).name).toBe('audio.ogg')
  })

  it('no manda el token de WhatsApp a un servidor que no es de Meta', async () => {
    useGroq()
    const calls = mockFetch({ mediaUrl: 'https://evil.com/audio' })

    expect(await audioMessageText('media-1', CREDENTIALS)).toBeNull()
    expect(calls.map((c) => c.url).some((url) => url.includes('evil.com'))).toBe(false)
  })

  it('no baja ni transcribe un audio que pasa el tope de tamaño', async () => {
    useGroq()
    const calls = mockFetch({ fileSize: MAX_AUDIO_BYTES + 1 })

    expect(await audioMessageText('media-1', CREDENTIALS)).toBeNull()
    expect(calls).toHaveLength(1)
  })

  it('si el servicio de voz falla, devuelve null y no lanza error', async () => {
    useGroq()
    mockFetch({ transcription: () => new Response('límite de uso', { status: 429 }) })
    await expect(audioMessageText('media-1', CREDENTIALS)).resolves.toBeNull()
  })

  it('un audio en silencio (transcripción vacía) devuelve null', async () => {
    useGroq()
    mockFetch({ transcription: () => Response.json({ text: '   ' }) })
    expect(await audioMessageText('media-1', CREDENTIALS)).toBeNull()
  })

  it('sin servicio de voz configurado no hace ninguna llamada', async () => {
    delete process.env.OPENAI_API_KEY
    const calls = mockFetch()
    expect(await audioMessageText('media-1', CREDENTIALS)).toBeNull()
    expect(calls).toHaveLength(0)
  })

  it('recorta una transcripción larguísima', async () => {
    useGroq()
    mockFetch({ transcription: () => Response.json({ text: 'a'.repeat(5000) }) })
    const text = await audioMessageText('media-1', CREDENTIALS)
    expect(text!.length).toBeLessThan(2100)
  })
})
