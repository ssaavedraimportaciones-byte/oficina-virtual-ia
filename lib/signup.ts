import { prisma } from './db'

/**
 * Quién puede crear una cuenta en ZeroVisto. Hay dos caminos y conviven:
 *
 *  - **El administrador la crea** (siempre disponible, en /admin/usuarios).
 *  - **El cliente se registra solo**, si el registro abierto está encendido.
 *
 * El interruptor vive en la base (lo prende y apaga el dueño de la plataforma
 * desde /admin/sistema), no en una variable de entorno: abrirlo o cerrarlo es
 * una decisión de negocio que tiene que poder tomarse sin un despliegue.
 * `ALLOW_SIGNUP=true` sigue sirviendo para forzarlo abierto (arranque de un
 * entorno nuevo, pruebas), pero no hace falta para operar.
 */

const KEY = 'signup_open'

export function signupForcedOpenByEnv(): boolean {
  return process.env.ALLOW_SIGNUP === 'true'
}

export async function signupOpen(): Promise<boolean> {
  if (signupForcedOpenByEnv()) return true
  try {
    const row = await prisma.platformSetting.findUnique({ where: { key: KEY } })
    return row?.value === 'true'
  } catch (error) {
    // Si la base no responde, el registro queda cerrado: es el lado seguro.
    console.error('[registro] no se pudo leer el interruptor:', error)
    return false
  }
}

export async function setSignupOpen(open: boolean): Promise<boolean> {
  const value = String(open)
  await prisma.platformSetting.upsert({ where: { key: KEY }, create: { key: KEY, value }, update: { value } })
  return signupOpen()
}
