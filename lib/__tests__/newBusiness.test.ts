import { describe, expect, it } from 'vitest'
import { panelLanding, stepProblems, type WizardForm } from '../newBusiness'

const full: WizardForm = {
  businessName: 'Completos Don Tito',
  industry: 'Comida rápida',
  description: 'Carro de completos en Viña.',
  agentName: 'Rodri',
  goals: 'Tomar pedidos para retiro.',
  tone: 'cercano',
  channels: ['whatsapp'],
}

describe('crear negocio en 3 pasos', () => {
  it('cada paso pide solo lo suyo', () => {
    expect(stepProblems('empresa', full)).toEqual([])
    expect(stepProblems('agente', full)).toEqual([])
    expect(stepProblems('canales', full)).toEqual([])
    expect(stepProblems('empresa', { ...full, businessName: '  ' })).toEqual(['Escribe el nombre de tu negocio.'])
    // Lo del agente faltando no bloquea el paso de la empresa.
    expect(stepProblems('empresa', { ...full, agentName: '' })).toEqual([])
    expect(stepProblems('agente', { ...full, agentName: '', goals: '' })).toHaveLength(2)
    expect(stepProblems('canales', { ...full, channels: [] })).toHaveLength(1)
  })
})

describe('a dónde lleva /panel', () => {
  const owner = (...ids: string[]) => ({ role: 'USER', businesses: ids.map((businessId) => ({ businessId })) })

  it('sin negocios: a crear el primero', () => {
    expect(panelLanding(owner())).toBe('/panel/nuevo')
  })

  it('con un solo negocio: directo a su panel, sin pasar por una lista', () => {
    expect(panelLanding(owner('abc'))).toBe('/panel/abc')
    // La misma membresía repetida no cuenta como dos negocios.
    expect(panelLanding(owner('abc', 'abc'))).toBe('/panel/abc')
  })

  it('con varios negocios: la lista para elegir', () => {
    expect(panelLanding(owner('a', 'b'))).toBeNull()
  })

  it('el administrador de la plataforma siempre ve la lista', () => {
    expect(panelLanding({ role: 'PLATFORM_ADMIN', businesses: [] })).toBeNull()
    expect(panelLanding({ role: 'PLATFORM_ADMIN', businesses: [{ businessId: 'a' }] })).toBeNull()
  })
})
