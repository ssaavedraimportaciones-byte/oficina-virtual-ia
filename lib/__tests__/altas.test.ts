import { describe, expect, it } from 'vitest'
import { INTAKE_STEPS, normalizeSteps } from '../intake'

/**
 * Los pasos de un alta se marcan desde el navegador, así que el servidor no
 * puede confiar en la lista que recibe: de ahí sale el "N de 8" que el dueño
 * usa para saber qué falta antes de prometerle una fecha a un cliente.
 */
describe('normalizeSteps', () => {
  it('descarta pasos que no existen', () => {
    expect(normalizeSteps(['datos', 'inventado'])).toEqual(['datos'])
  })

  it('no deja repetir un paso para inflar el avance', () => {
    expect(normalizeSteps(['cobro', 'cobro', 'cobro'])).toEqual(['cobro'])
  })

  it('ordena los pasos como la lista, sin importar cómo lleguen', () => {
    expect(normalizeSteps(['cobro', 'datos'])).toEqual(['datos', 'cobro'])
  })

  it('acepta la lista completa', () => {
    const todos = INTAKE_STEPS.map((step) => step.id)
    expect(normalizeSteps([...todos])).toHaveLength(INTAKE_STEPS.length)
  })

  it('una lista vacía deja el alta en cero', () => {
    expect(normalizeSteps([])).toEqual([])
  })
})
