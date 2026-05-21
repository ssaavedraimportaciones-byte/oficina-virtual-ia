import { describe, it, expect } from 'vitest'
import { puedeAprobarNivel, puedeVerAuditoria, puedeCrearDocumento, tieneHabilitacionRequerida } from '@/lib/roles'

describe('puedeAprobarNivel', () => {
  it('supervisor aprueba nivel 1', () => expect(puedeAprobarNivel('supervisor', 1)).toBe(true))
  it('supervisor NO aprueba nivel 2', () => expect(puedeAprobarNivel('supervisor', 2)).toBe(false))
  it('prevencionista aprueba nivel 1 y 2', () => {
    expect(puedeAprobarNivel('prevencionista', 1)).toBe(true)
    expect(puedeAprobarNivel('prevencionista', 2)).toBe(true)
  })
  it('prevencionista NO aprueba nivel 3', () => expect(puedeAprobarNivel('prevencionista', 3)).toBe(false))
  it('jefe_area aprueba todos los niveles', () => {
    expect(puedeAprobarNivel('jefe_area', 1)).toBe(true)
    expect(puedeAprobarNivel('jefe_area', 2)).toBe(true)
    expect(puedeAprobarNivel('jefe_area', 3)).toBe(true)
  })
  it('admin aprueba cualquier nivel', () => {
    expect(puedeAprobarNivel('admin', 1)).toBe(true)
    expect(puedeAprobarNivel('admin', 3)).toBe(true)
  })
  it('trabajador NO puede aprobar', () => expect(puedeAprobarNivel('trabajador', 1)).toBe(false))
  it('auditor NO puede aprobar', () => expect(puedeAprobarNivel('auditor', 1)).toBe(false))
})

describe('puedeVerAuditoria', () => {
  it('admin puede ver auditória', () => expect(puedeVerAuditoria('admin')).toBe(true))
  it('auditor puede ver auditória', () => expect(puedeVerAuditoria('auditor')).toBe(true))
  it('supervisor NO puede ver auditória completa', () => expect(puedeVerAuditoria('supervisor')).toBe(false))
  it('trabajador NO puede ver auditória', () => expect(puedeVerAuditoria('trabajador')).toBe(false))
})

describe('puedeCrearDocumento', () => {
  it('trabajador puede crear', () => expect(puedeCrearDocumento('trabajador')).toBe(true))
  it('auditor NO puede crear', () => expect(puedeCrearDocumento('auditor')).toBe(false))
})

describe('tieneHabilitacionRequerida', () => {
  it('CHARLA no requiere habilitación', () => {
    expect(tieneHabilitacionRequerida('CHARLA', [])).toBe(true)
  })
  it('ALTURA requiere habilitación altura', () => {
    expect(tieneHabilitacionRequerida('ALTURA', [])).toBe(false)
    expect(tieneHabilitacionRequerida('ALTURA', ['altura'])).toBe(true)
  })
  it('IZAJE requiere habilitación izaje', () => {
    expect(tieneHabilitacionRequerida('IZAJE', ['altura'])).toBe(false)
    expect(tieneHabilitacionRequerida('IZAJE', ['izaje'])).toBe(true)
  })
})
