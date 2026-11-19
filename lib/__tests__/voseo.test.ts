import { describe, expect, it } from 'vitest'
import { fixVoseo, toChatText } from '../voseo'

describe('fixVoseo: corrige lo que el modelo igual se mande, pese a la instrucción', () => {
  it('corrige exactamente lo que salió en producción', () => {
    expect(fixVoseo('¿en qué rubro estás y cuántos mensajes recibís al día?')).toBe(
      '¿en qué rubro estás y cuántos mensajes recibes al día?',
    )
    expect(fixVoseo('¿qué servicios o productos ofreís y cuántos números querís conectar?')).toBe(
      '¿qué servicios o productos ofreces y cuántos números quieres conectar?',
    )
  })

  it('respeta la mayúscula inicial', () => {
    expect(fixVoseo('Vos podés elegir la hora.')).toBe('Tú puedes elegir la hora.')
  })

  it('no toca palabras reales que terminan parecido al voseo', () => {
    const frase = 'Además, el país queda lejos y el interés es alto, aunque sea después del jamás.'
    expect(fixVoseo(frase)).toBe(frase)
  })

  it('no toca el texto sin voseo', () => {
    const frase = 'Hola, ¿qué servicio te gustaría reservar? Cuéntame.'
    expect(fixVoseo(frase)).toBe(frase)
  })
})

describe('toChatText: la respuesta queda lista para WhatsApp', () => {
  it('corrige el imperativo voseante que salió en Pancho Rodante', () => {
    expect(toChatText('¿Qué te tinca de la carta? Decime qué quieres')).toBe('¿Qué te tinca de la carta? Dime qué quieres')
  })

  it('cambia las negritas de Markdown por las de WhatsApp y saca los títulos', () => {
    expect(toChatText('**¿Qué tamaño te viene?**\n## Carta\n- Mediana a $10.500')).toBe(
      '*¿Qué tamaño te viene?*\nCarta\n- Mediana a $10.500',
    )
  })

  it('no toca un precio ni una negrita de WhatsApp ya bien puesta', () => {
    const frase = 'Total *$9.000*, retiro a las 21:55 🔥'
    expect(toChatText(frase)).toBe(frase)
  })
})
