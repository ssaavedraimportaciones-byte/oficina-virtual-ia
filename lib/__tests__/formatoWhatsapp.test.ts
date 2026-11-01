import { describe, expect, it } from 'vitest'
import { redactSecrets } from '../llmLog'
import { toWhatsAppFormat } from '../whatsapp'

describe('formato de WhatsApp', () => {
  it('pasa la negrita de Markdown a la de WhatsApp', () => {
    expect(toWhatsAppFormat('Una familiar queda en **$13.500**.')).toBe('Una familiar queda en *$13.500*.')
    expect(toWhatsAppFormat('¿Te va bien a las **12:30** o a las **13:00**?')).toBe('¿Te va bien a las *12:30* o a las *13:00*?')
  })

  it('no toca la negrita que ya viene en formato de WhatsApp', () => {
    expect(toWhatsAppFormat('Total *$6.000*')).toBe('Total *$6.000*')
  })

  it('convierte títulos y links', () => {
    expect(toWhatsAppFormat('### Carta\n• Completo $3.500')).toBe('*Carta*\n• Completo $3.500')
    expect(toWhatsAppFormat('Mira [nuestro Instagram](https://instagram.com/pancho)')).toBe(
      'Mira nuestro Instagram: https://instagram.com/pancho',
    )
  })
})

describe('bitácora de errores de la IA', () => {
  it('nunca guarda una clave aunque venga en el mensaje del proveedor', () => {
    expect(redactSecrets('Invalid API Key gsk_abcDEF1234567890xyz provided')).toBe('Invalid API Key [clave oculta] provided')
    expect(redactSecrets('Incorrect key sk-proj-AbC123456789')).toBe('Incorrect key [clave oculta]')
  })
})
