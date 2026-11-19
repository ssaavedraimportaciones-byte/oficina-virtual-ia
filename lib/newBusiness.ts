import type { Channel, Tone } from './types'

/**
 * Crear un negocio nuevo, paso a paso: 1) tu empresa, 2) tu agente, 3) dónde
 * atiende. Acá vive lo que no es pantalla: qué se exige en cada paso y a dónde
 * lleva el panel a cada persona según los negocios que tiene.
 */

export const WIZARD_STEPS = [
  { id: 'empresa', title: 'Tu empresa', hint: 'Qué negocio es' },
  { id: 'agente', title: 'Tu agente', hint: 'Cómo se llama y cómo habla' },
  { id: 'canales', title: 'Dónde atiende', hint: 'WhatsApp o Instagram' },
] as const

export type WizardStepId = (typeof WIZARD_STEPS)[number]['id']

export interface WizardForm {
  businessName: string
  industry: string
  description: string
  agentName: string
  goals: string
  tone: Tone
  channels: Channel[]
}

/** Un ejemplo de cómo suena cada tono, para elegir sin adivinar. */
export const TONE_CHOICES: { value: Tone; label: string; example: string }[] = [
  { value: 'cercano', label: 'Cercano y amigable', example: '¡Hola! Claro que sí 😊 ¿Te dejo la hora para mañana?' },
  { value: 'formal', label: 'Profesional y formal', example: 'Buenas tardes. Con gusto le agendo una hora para mañana.' },
  { value: 'directo', label: 'Directo y resolutivo', example: 'Mañana 15:00 disponible. ¿Te la reservo?' },
]

/** Nombres de persona para el agente: con nombre, los clientes conversan más tranquilos. */
export const AGENT_NAME_IDEAS = ['Sofía', 'Camila', 'Valentina', 'Rodri', 'Nico', 'Javi']

export const CHANNEL_CHOICES: { value: Channel; label: string; hint: string }[] = [
  { value: 'whatsapp', label: 'WhatsApp', hint: 'Donde te escribe la mayoría de tus clientes.' },
  { value: 'instagram', label: 'Instagram', hint: 'Los mensajes directos de tu cuenta.' },
]

/** Qué falta en un paso. Lista vacía = se puede avanzar. */
export function stepProblems(step: WizardStepId, form: WizardForm): string[] {
  const missing: string[] = []
  if (step === 'empresa') {
    if (!form.businessName.trim()) missing.push('Escribe el nombre de tu negocio.')
    if (!form.industry.trim()) missing.push('Cuéntanos a qué se dedica.')
    if (!form.description.trim()) missing.push('Agrega una descripción corta de tu negocio.')
  }
  if (step === 'agente') {
    if (!form.agentName.trim()) missing.push('Ponle un nombre a tu agente.')
    if (!form.goals.trim()) missing.push('Cuéntale qué tiene que lograr en cada conversación.')
  }
  if (step === 'canales' && form.channels.length === 0) {
    missing.push('Elige al menos un lugar donde va a atender.')
  }
  return missing
}

/**
 * A dónde lleva /panel a alguien que entra. Quien tiene un solo negocio va
 * directo a su panel (no hay nada que elegir) y quien aún no tiene ninguno va
 * a crear el primero. El administrador de la plataforma y quien maneja varios
 * negocios ven la lista. `null` = mostrar la lista.
 */
export function panelLanding(user: { role: string; businesses: { businessId: string }[] }): string | null {
  if (user.role === 'PLATFORM_ADMIN') return null
  const ids = [...new Set(user.businesses.map((b) => b.businessId))]
  if (ids.length === 0) return '/panel/nuevo'
  if (ids.length === 1) return `/panel/${ids[0]}`
  return null
}
