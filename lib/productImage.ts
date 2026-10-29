/**
 * Reglas de las fotos de productos. Viven aparte de la ruta para poder
 * probarlas sin levantar nada: lo que decide si un archivo se acepta es lo
 * único que protege a la base de recibir cualquier cosa.
 */

/** Tope de lo que se acepta. El navegador las reduce a ~150 KB antes de subir. */
export const MAX_IMAGE_BYTES = 1_000_000

export type ImageType = 'image/jpeg' | 'image/png' | 'image/webp'

/**
 * Tipo real del archivo según sus primeros bytes. No se confía en el
 * `Content-Type` ni en la extensión que manda el navegador: un SVG o un HTML
 * disfrazado de .jpg serviría después desde nuestro dominio. Por eso tampoco
 * se acepta SVG, aunque sea imagen.
 */
export function detectImageType(bytes: Uint8Array): ImageType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    return 'image/png'
  }
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
    String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
  ) {
    return 'image/webp'
  }
  return null
}

export type ImageCheck = { ok: true; type: ImageType } | { ok: false; reason: string }

export function checkImage(bytes: Uint8Array): ImageCheck {
  if (bytes.length === 0) return { ok: false, reason: 'El archivo está vacío.' }
  if (bytes.length > MAX_IMAGE_BYTES) {
    return { ok: false, reason: 'La imagen pesa demasiado (máximo 1 MB).' }
  }
  const type = detectImageType(bytes)
  if (!type) return { ok: false, reason: 'Solo se aceptan fotos JPG, PNG o WebP.' }
  return { ok: true, type }
}
