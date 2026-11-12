import { describe, expect, it } from 'vitest'
import { fixVoseo } from '../voseo'

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
