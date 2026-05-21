import { describe, it, expect } from 'vitest'
import { validarTransicion } from '@/lib/workflow'

const docBase = {
  tipo: 'ART' as const,
  firmasCompletadas: ['uid-1'],
  firmasRequeridas: ['uid-1'],
  aprobacionesCompletadas: 2,
  aprobacionesRequeridas: 2,
}

describe('validarTransicion', () => {
  it('permite borrador → completado para trabajador', () => {
    const r = validarTransicion('borrador', 'completado', 'trabajador', docBase)
    expect(r.permitida).toBe(true)
  })

  it('bloquea borrador → timbrado (salto ilegal)', () => {
    const r = validarTransicion('borrador', 'timbrado', 'admin', docBase)
    expect(r.permitida).toBe(false)
  })

  it('bloquea aprobación si faltan firmas', () => {
    const doc = { ...docBase, firmasCompletadas: [], firmasRequeridas: ['uid-1'] }
    const r = validarTransicion('completado', 'firmado', 'supervisor', doc)
    expect(r.permitida).toBe(false)
    expect(r.motivo).toContain('firma')
  })

  it('bloquea aprobado → timbrado para trabajador', () => {
    const r = validarTransicion('aprobado', 'timbrado', 'trabajador', docBase)
    expect(r.permitida).toBe(false)
  })

  it('permite aprobado → timbrado para prevencionista', () => {
    const r = validarTransicion('aprobado', 'timbrado', 'prevencionista', docBase)
    expect(r.permitida).toBe(true)
  })

  it('permite rechazado → borrador para reiniciar flujo', () => {
    const r = validarTransicion('rechazado', 'borrador', 'trabajador', docBase)
    expect(r.permitida).toBe(true)
  })

  it('bloquea cualquier transición desde archivado', () => {
    const r = validarTransicion('archivado', 'borrador', 'admin', docBase)
    expect(r.permitida).toBe(false)
  })

  it('bloquea aprobación completa si faltan aprobaciones', () => {
    const doc = { ...docBase, aprobacionesCompletadas: 1, aprobacionesRequeridas: 2 }
    const r = validarTransicion('pendiente_aprobacion', 'aprobado', 'supervisor', doc)
    expect(r.permitida).toBe(false)
    expect(r.motivo).toContain('aprobación')
  })

  it('auditor no puede cambiar estado (no en roles permitidos)', () => {
    const r = validarTransicion('borrador', 'completado', 'auditor', docBase)
    expect(r.permitida).toBe(false)
  })
})
