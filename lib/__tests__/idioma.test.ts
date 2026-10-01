import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'fs'
import { join } from 'path'

/**
 * El producto se escribe en español latino con trato de tú (y "usted" en el tono
 * formal), pensando en Chile. El voseo ("tenés", "elegí", "vos") suena a
 * Argentina y no se quiere en pantallas, mails ni en el prompt del agente: si
 * está en el prompt, el modelo lo imita al hablarle al cliente.
 */
const ROOT = join(__dirname, '..', '..')
const DIRS = ['app', 'lib']

const LETTERS = 'A-Za-zñÑáéíóúÁÉÍÓÚ'
const VOSEO = new RegExp(
  `(?<![${LETTERS}])(vos|sos|tenés|podés|querés|sabés|necesitás|preferís|elegís|hacés|decís|ponés|venís|llegás|usás|cargás|mirás|confirmás|derivás|respondés|mantenés|` +
    // imperativos: "cargá", "elegí", "respondé", "escribilo", "decile", "preguntale"…
    `(?:agregá|ajustá|cargá|completá|configurá|confirmá|consultá|copiá|dejá|devolvé|elegí|escribí|esperá|generá|ignorá|ingresá|iniciá|llamá|pasá|pegá|poné|probá|registrá|reintentá|reservá|respondé|revisá|seguí|tené|usá|volvé|` +
    `escribilo|escribinos|decile|decilo|preguntale|ofrecele|avisale|confirmale|tomale|contale|pedile|usalo|confirmalo)` +
    `)(?![${LETTERS}])`,
  'i',
)

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (name === 'node_modules' || name === 'generated' || name === '__tests__') return []
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return /\.(ts|tsx)$/.test(name) ? [path] : []
  })
}

describe('idioma del producto', () => {
  it('no usa voseo en pantallas, mails ni prompts', () => {
    const offenders: string[] = []
    for (const dir of DIRS) {
      for (const file of sourceFiles(join(ROOT, dir))) {
        readFileSync(file, 'utf-8')
          .split('\n')
          .forEach((line, index) => {
            // La instrucción que le prohíbe el voseo al agente tiene que nombrarlo.
            if (line.includes('Nunca uses voseo')) return
            const match = line.match(VOSEO)
            if (match) offenders.push(`${file.replace(ROOT + '/', '')}:${index + 1} → "${match[0]}"`)
          })
      }
    }
    expect(offenders).toEqual([])
  })

  it('el prompt del agente le pide tutear y hablar de "hora" como en Chile', async () => {
    const { buildSystemPrompt } = await import('../agentPrompt')
    const prompt = buildSystemPrompt(
      { agentName: 'Bella', businessName: 'Uñas Bella', industry: 'i', description: 'd', goals: 'g', tone: 'cercano', channels: ['whatsapp'], configuredAt: '' },
    )
    expect(prompt).toContain('Nunca uses voseo')
    expect(prompt).toContain('agendar una hora')
    expect(prompt).toContain('Eres Bella')
  })
})
