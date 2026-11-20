import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireBusinessAccess } from '@/lib/authz'
import {
  CatalogFileError,
  MAX_FILE_BYTES,
  parseExcelCatalog,
  parseImageCatalog,
  parsePdfCatalog,
} from '@/lib/catalogFileImport'
import { applyCatalogItems } from '@/lib/integrations'
import type { CatalogItem } from '@/lib/integrations/types'

/**
 * Importar el catálogo desde un archivo (foto de la carta, PDF o Excel/CSV)
 * en vez de cargarlo producto por producto. En dos pasos, porque una lectura
 * automática de precios puede equivocarse y acá se habla de plata real:
 *   POST → lee el archivo y devuelve una vista previa, sin guardar nada.
 *   PUT  → guarda los items que el dueño ya revisó (y pudo corregir) en el panel.
 */

const EXCEL_EXTENSIONS = /\.(xlsx|xls|csv)$/i
const PDF_EXTENSIONS = /\.pdf$/i

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireBusinessAccess(id)
  if (user instanceof NextResponse) return user

  const form = await request.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Falta el archivo.' }, { status: 400 })
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: 'El archivo pesa demasiado (máximo 10 MB).' }, { status: 413 })
  }

  const bytes = new Uint8Array(await file.arrayBuffer())
  const name = file.name ?? ''
  const mimeType = file.type || ''

  try {
    let items: CatalogItem[]
    if (mimeType.startsWith('image/')) {
      items = await parseImageCatalog(bytes, mimeType)
    } else if (mimeType === 'application/pdf' || PDF_EXTENSIONS.test(name)) {
      items = await parsePdfCatalog(bytes)
    } else if (EXCEL_EXTENSIONS.test(name) || /spreadsheet|excel|csv/i.test(mimeType)) {
      items = await parseExcelCatalog(bytes)
    } else {
      return NextResponse.json(
        { error: 'Formato no reconocido. Sube una foto (JPG/PNG), un PDF o un Excel/CSV.' },
        { status: 400 },
      )
    }

    if (items.length === 0) {
      return NextResponse.json(
        { error: 'No se encontraron productos con precio. Revisa el archivo o cárgalos a mano.' },
        { status: 422 },
      )
    }
    return NextResponse.json({ items })
  } catch (error) {
    if (error instanceof CatalogFileError) {
      return NextResponse.json({ error: error.message }, { status: 422 })
    }
    console.error('[import-file] error al leer el archivo:', error)
    return NextResponse.json({ error: 'No se pudo leer el archivo. Inténtalo de nuevo.' }, { status: 502 })
  }
}

const itemSchema = z.object({
  name: z.string().trim().min(1).max(120),
  price: z.number().int().min(0),
  stock: z.number().int().min(0).nullable(),
})
const confirmSchema = z.object({ items: z.array(itemSchema).min(1).max(300) })

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireBusinessAccess(id)
  if (user instanceof NextResponse) return user

  const body = await request.json().catch(() => null)
  const parsed = confirmSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })
  }

  const items: CatalogItem[] = parsed.data.items.map((it) => ({
    name: it.name,
    price: it.price,
    stock: it.stock,
    active: true,
  }))
  const summary = await applyCatalogItems(id, items)
  return NextResponse.json({ summary })
}
