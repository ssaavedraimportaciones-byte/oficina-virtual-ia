/**
 * Datos de la sociedad que opera la plataforma, copiados tal cual de la
 * declaración jurada de inicio de actividades del SII y del estatuto. Los
 * textos legales, la ficha de Meta y los contratos tienen que decir exactamente
 * lo mismo que esos documentos: una diferencia de una letra entre lo que dice
 * el sitio y lo que dice el SII es motivo de rechazo en la verificación de
 * Meta. Por eso vive en un solo archivo en vez de repetirse escrito a mano en
 * cada página.
 *
 * No usa variables de entorno, igual que `lib/brand.ts`: lo importan
 * componentes de cliente y de servidor, y tiene que dar lo mismo en los dos.
 */
export const COMPANY = {
  legalName: 'ZERO SYSTEM TECHNOLOGIES SpA',
  rut: '78.532.482-K',
  street: 'Valle del Paraíso S/N, MBN 48 Lo Arrayán, Depto 203, Bloque D',
  city: 'Quilpué',
  region: 'Región de Valparaíso',
  country: 'Chile',
  /**
   * Casilla pública para consultas legales y pedidos sobre datos personales.
   * Tiene que ser una casilla que alguien lea: acá llegan los ejercicios de
   * derechos de la Ley 19.628.
   */
  email: 'contacto@zerovistochile.com',
  phone: '+56 9 2044 8651',
  site: 'zerovistochile.com',
  /** Fecha de publicación de los textos legales: actualizar al editarlos. */
  updated: '26 de octubre de 2026',
} as const

/** Domicilio en una línea, como lo pide Meta y como figura en el SII. */
export const COMPANY_ADDRESS = `${COMPANY.street}, ${COMPANY.city}, ${COMPANY.region}, ${COMPANY.country}`
