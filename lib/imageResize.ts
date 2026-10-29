/**
 * Achica una foto en el navegador antes de subirla. Un celular saca fotos de
 * 3 a 8 MB; para mostrar un plato en el chat alcanza con unos 900 px de lado
 * largo. Así la subida es rápida aunque el cliente use datos móviles y la base
 * no se llena con originales gigantes. Solo corre en el navegador.
 */
const MAX_SIDE = 900

export async function resizeForUpload(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const context = canvas.getContext('2d')
  if (!context) throw new Error('El navegador no pudo procesar la imagen.')
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()

  // WebP pesa menos; Safari antiguo no lo genera y cae a JPEG sin avisar.
  for (const type of ['image/webp', 'image/jpeg']) {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.82))
    if (blob && blob.type === type) return blob
  }
  throw new Error('No se pudo preparar la imagen.')
}
