import { describe, it, expect } from 'vitest'
import { validarCamposDocumento } from '@/lib/validators'

describe('validarCamposDocumento', () => {
  it('ART válido con todos los campos', () => {
    const campos = {
      tarea: 'Cambio de bomba hidráulica',
      lugar: 'Nivel 3 - Sector Norte',
      empresa: 'Contratista XYZ',
      fecha: '2026-05-21',
      responsable: 'Juan Pérez',
      pasos: ['Paso 1', 'Paso 2'],
      riesgos: ['Caída', 'Atrapamiento'],
      medidas_control: ['Baliza', 'EPP'],
      epp_requerido: ['Casco', 'Guantes'],
    }
    const r = validarCamposDocumento('ART', campos)
    expect(r.valido).toBe(true)
    expect(r.errores).toHaveLength(0)
  })

  it('ART inválido por campo vacío', () => {
    const campos = {
      tarea: '',
      lugar: 'Nivel 3',
      empresa: 'XYZ',
      fecha: '2026-05-21',
      responsable: 'Juan',
      pasos: ['P1'],
      riesgos: ['R1'],
      medidas_control: ['M1'],
      epp_requerido: ['E1'],
    }
    const r = validarCamposDocumento('ART', campos)
    expect(r.valido).toBe(false)
    expect(r.errores.some(e => e.includes('tarea'))).toBe(true)
  })

  it('ART inválido por array vacío', () => {
    const campos = {
      tarea: 'Tarea',
      lugar: 'Lugar',
      empresa: 'Empresa',
      fecha: '2026-05-21',
      responsable: 'Responsable',
      pasos: [],
      riesgos: ['R1'],
      medidas_control: ['M1'],
      epp_requerido: ['E1'],
    }
    const r = validarCamposDocumento('ART', campos)
    expect(r.valido).toBe(false)
    expect(r.errores.some(e => e.includes('pasos'))).toBe(true)
  })

  it('CHARLA válida con campos mínimos', () => {
    const campos = {
      tema: 'Uso correcto de EPP',
      orador: 'Carlos Rojas',
      duracion_minutos: 15,
      fecha: '2026-05-21',
      lugar: 'Sala de reuniones',
    }
    const r = validarCamposDocumento('CHARLA', campos)
    expect(r.valido).toBe(true)
  })

  it('ESPACIO_CONFINADO inválido sin vigias', () => {
    const campos = {
      tipo_espacio: 'Tanque de almacenamiento',
      atmosfera_peligrosa: true,
      prueba_gas: ['O2: 20.9%', 'LEL: 0%'],
      vigias: [],
      plan_rescate: 'Plan de rescate adjunto',
    }
    const r = validarCamposDocumento('ESPACIO_CONFINADO', campos)
    expect(r.valido).toBe(false)
    expect(r.errores.some(e => e.includes('vigias'))).toBe(true)
  })
})
