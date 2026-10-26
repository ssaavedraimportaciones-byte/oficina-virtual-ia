/**
 * Altas de clientes: la ficha que se llena al vender, antes de que el negocio
 * exista en la plataforma, y el avance de la puesta en marcha.
 *
 * Conectar WhatsApp depende de trámites de Meta que tardan días y que no pasan
 * por este sistema, así que entre la venta y el primer mensaje real hay una
 * lista de cosas pendientes que es fácil perder de vista. Esto es esa lista,
 * escrita una vez por cliente.
 *
 * Acá viven solo las formas y las reglas, sin tocar la base: la pantalla que
 * marca los pasos corre en el navegador y la importa, así que no puede
 * arrastrar el cliente de Prisma. La persistencia está en `intakeStore.ts`.
 */

export const INTAKE_STEPS = [
  { id: 'datos', label: 'Datos del negocio recibidos' },
  { id: 'documentos', label: 'Documentos de la empresa recibidos (SII y constitución)' },
  { id: 'cuenta', label: 'Cuenta y negocio creados en el panel' },
  { id: 'conocimiento', label: 'Menú o servicios cargados' },
  { id: 'numero', label: 'Número confirmado libre de WhatsApp' },
  { id: 'meta', label: 'Verificación de Meta enviada' },
  { id: 'conectado', label: 'WhatsApp conectado y probado' },
  { id: 'cobro', label: 'Plan y cobro acordados' },
] as const

export type IntakeStepId = (typeof INTAKE_STEPS)[number]['id']

export const INTAKE_STEP_IDS = INTAKE_STEPS.map((s) => s.id) as readonly string[]

export interface ClientIntake {
  id: string
  createdAt: string
  /** Quién es la persona con la que se habla. */
  contactName: string
  contactEmail: string
  contactPhone: string
  /** Cómo se llama el negocio de cara al público. */
  businessName: string
  industry: string
  /** Lo que dice el SII, necesario para la verificación de Meta. */
  legalName: string
  rut: string
  address: string
  whatsappNumber: string
  /** El cliente confirmó que ese número no tiene WhatsApp instalado. */
  whatsappClean: boolean
  hours: string
  payments: string
  catalog: string
  /** Qué hace el agente cuando no sabe algo. */
  escalation: string
  notes: string
  /** Ids de `INTAKE_STEPS` ya cumplidos. */
  steps: string[]
  /** Negocio ya creado en la plataforma, si se enlazó. */
  businessId: string | null
}

export type ClientIntakeInput = Omit<ClientIntake, 'id' | 'createdAt' | 'steps' | 'businessId'>

/**
 * Deja solo pasos conocidos, sin repetidos y en el orden de la lista: lo que
 * llega del navegador no decide qué pasos existen ni cómo se cuentan, así que
 * un `steps` inventado no puede dar una ficha "9 de 8" ni colarse en la base.
 */
export function normalizeSteps(steps: string[]): string[] {
  return INTAKE_STEP_IDS.filter((stepId) => steps.includes(stepId))
}
