// Almacenamiento de archivos (firmas escaneadas, PDFs) — configurar proveedor en Fase 3
export interface StorageFile {
  key: string
  url: string
  size: number
  contentType: string
}

export async function uploadFile(_key: string, _buffer: Buffer, _contentType: string): Promise<StorageFile> {
  throw new Error('storage: sin proveedor configurado — usar Vercel Blob, S3 o Supabase')
}

export async function getFileUrl(_key: string): Promise<string> {
  throw new Error('storage: sin proveedor configurado')
}
