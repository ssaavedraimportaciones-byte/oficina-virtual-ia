import { describe, expect, it } from 'vitest'
import { getSetupProgress, type SetupFacts } from '../onboarding'
import { getIndustryTemplate } from '../industries'

const manicura = getIndustryTemplate('manicura')!

const fresh: SetupFacts = {
  templateId: 'manicura',
  description: manicura.description,
  goals: manicura.goals,
  knowledgeCount: 0,
  serviceCount: 0,
  productCount: 0,
  floorCount: 0,
  simulatorCount: 0,
  whatsappConnected: false,
  instagramConnected: false,
  hasLogo: false,
}

describe('primeros pasos del agente', () => {
  it('un negocio recién creado empieza por contarle al agente quién es', () => {
    const p = getSetupProgress('b1', fresh)
    expect(p.completed).toBe(0)
    expect(p.required).toBe(5)
    expect(p.next?.id).toBe('perfil')
    expect(p.next?.href).toBe('/panel/b1/configurar')
  })

  it('el texto de la plantilla sin tocar no cuenta como listo', () => {
    const p = getSetupProgress('b1', {
      ...fresh,
      description: fresh.description,
    })
    expect(p.steps.find((s) => s.id === 'perfil')?.done).toBe(false)
  })

  it('se marca solo con lo que ya está cargado', () => {
    const p = getSetupProgress('b1', {
      ...fresh,
      description: 'Estudio de uñas en Quilpué centro, con hora previa, especialistas en semipermanente.',
      goals: 'Agendar horas mirando la disponibilidad real y responder precios de cada servicio.',
      knowledgeCount: 3,
      serviceCount: 2,
    })
    expect(p.completed).toBe(3)
    expect(p.next?.id).toBe('prueba')
  })

  it('un rubro que vende productos pide la carta, no servicios', () => {
    const p = getSetupProgress('b1', { ...fresh, templateId: 'gastronomia' })
    const op = p.steps.find((s) => s.id === 'operacion')!
    expect(op.href).toBe('/panel/b1/pedidos')
    expect(
      getSetupProgress('b1', {
        ...fresh,
        templateId: 'gastronomia',
        productCount: 1,
      }).steps.find((s) => s.id === 'operacion')?.done,
    ).toBe(true)
  })

  it('el logo es opcional: sin él, igual queda listo', () => {
    const p = getSetupProgress('b1', {
      ...fresh,
      description: 'x'.repeat(50),
      goals: 'y'.repeat(50),
      knowledgeCount: 5,
      serviceCount: 1,
      simulatorCount: 1,
      whatsappConnected: true,
    })
    expect(p.ready).toBe(true)
    expect(p.next).toBeNull()
  })
})
