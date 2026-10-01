/**
 * Nombre de la marca y su eslogan, en un solo lugar: pantallas, mails, 2FA y
 * textos legales salen de acá, así un cambio de nombre es editar este archivo.
 * No usa variables de entorno a propósito: lo importan componentes de cliente
 * y de servidor, y tiene que dar lo mismo en los dos.
 */
export const BRAND = {
  name: 'ZeroVisto',
  tagline: 'Cero clientes en visto',
} as const
