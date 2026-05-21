import { describe, it, expect } from 'vitest'
import { puedeFiremar } from '@/lib/signatures'

describe('puedeFiremar', () => {
  it('permite firma a participante con rol trabajador', () => {
    const r = puedeFiremar('ART', 'trabajador', [], 'uid-1', ['uid-1'], [])
    expect(r.permitida).toBe(true)
  })

  it('bloquea si ya firmó', () => {
    const r = puedeFiremar('ART', 'trabajador', [], 'uid-1', ['uid-1'], ['uid-1'])
    expect(r.permitida).toBe(false)
    expect(r.motivo).toContain('Ya firmaste')
  })

  it('bloquea a no-participante con rol trabajador', () => {
    const r = puedeFiremar('ART', 'trabajador', [], 'uid-99', ['uid-1', 'uid-2'], [])
    expect(r.permitida).toBe(false)
    expect(r.motivo).toContain('participante')
  })

  it('permite a supervisor aunque no sea participante', () => {
    const r = puedeFiremar('ART', 'supervisor', [], 'uid-sup', ['uid-1'], [])
    expect(r.permitida).toBe(true)
  })

  it('bloquea trabajo en altura sin habilitación', () => {
    const r = puedeFiremar('ALTURA', 'trabajador', [], 'uid-1', ['uid-1'], [])
    expect(r.permitida).toBe(false)
    expect(r.motivo).toContain('habilitación')
  })

  it('permite trabajo en altura con habilitación', () => {
    const r = puedeFiremar('ALTURA', 'trabajador', ['altura'], 'uid-1', ['uid-1'], [])
    expect(r.permitida).toBe(true)
  })

  it('bloquea espacio confinado sin habilitación', () => {
    const r = puedeFiremar('ESPACIO_CONFINADO', 'trabajador', ['altura'], 'uid-1', ['uid-1'], [])
    expect(r.permitida).toBe(false)
  })

  it('permite LOTO con habilitación loto', () => {
    const r = puedeFiremar('LOTO', 'trabajador', ['loto'], 'uid-1', ['uid-1'], [])
    expect(r.permitida).toBe(true)
  })
})
