/**
 * El registro abierto está apagado por defecto: abrirlo es una decisión de
 * negocio (precios, cupos, soporte) y no tiene que pasar sin querer en un
 * despliegue nuevo. Se activa con ALLOW_SIGNUP=true.
 */
export function signupOpen(): boolean {
  return process.env.ALLOW_SIGNUP === 'true'
}
