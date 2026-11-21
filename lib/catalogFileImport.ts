import { getProvider } from './llm'
import { callVisionText, UnsupportedImageError } from './receipts'
import { toPesos, type CatalogItem } from './integrations/types'

/**
 * Importar el catálogo desde un archivo que el dueño ya tiene: una foto de la
 * carta, un PDF o una planilla Excel/CSV, en vez de tener que escribir cada
 * producto a mano. Tres caminos, un mismo resultado (CatalogItem[]) que se
 * previsualiza antes de guardar — nunca se escribe directo al catálogo,
 * porque una lectura automática de precios puede equivocarse y acá se habla
 * de plata real.
 */

export const MAX_FILE_BYTES = 10 * 1024 * 1024
/** Tope de items por importación: una carta real no tiene miles de líneas; esto frena una alucinación del modelo. */
const MAX_ITEMS = 300

export class CatalogFileError extends Error {}

const ITEMS_PROMPT = `Eres un asistente que pasa la carta o lista de precios de un negocio chileno a una lista estructurada.
Mira el contenido y devuelve SOLO un objeto JSON, sin texto alrededor, con esta forma:
{"items": [{"nombre": string, "precio": number, "stock": number|null}]}
Reglas:
- Un producto con variantes de tamaño o tipo (ej: "Completo" en mediano y grande, o con distintas carnes) se separa en una línea por variante, con el tamaño o la variante en el nombre (ej: "Completo mediano", "Completo grande", "As Palta Ave").
- El precio va en pesos chilenos, como número entero, sin puntos ni signo "$".
- Si no hay información de stock o cantidad disponible, usa null (no inventes un número).
- Ignora encabezados, categorías sueltas sin precio, textos promocionales, redes sociales y datos de contacto: solo productos con su precio.
- Si un precio no se alcanza a leer con certeza, no inventes: omite esa línea.
- Si el documento no parece una carta o lista de precios, responde {"items": []}.`

/** Busca el primer objeto JSON con la clave "items" dentro del texto, tolerando texto alrededor (modelos que razonan antes de responder). */
function parseItemsJson(text: string): unknown[] {
  const clean = text.replace(/<think>[\s\S]*?<\/think>/g, '')
  const starts = [...clean.matchAll(/\{\s*"items"/g)].map((m) => m.index!).reverse()
  for (const start of starts) {
    for (let end = clean.lastIndexOf('}'); end > start; end = clean.lastIndexOf('}', end - 1)) {
      try {
        const parsed = JSON.parse(clean.slice(start, end + 1)) as { items?: unknown }
        if (Array.isArray(parsed.items)) return parsed.items
      } catch {
        // probar con una llave de cierre anterior
      }
    }
  }
  return []
}

function toCatalogItems(raw: unknown[]): CatalogItem[] {
  const out: CatalogItem[] = []
  for (const entry of raw.slice(0, MAX_ITEMS)) {
    if (!entry || typeof entry !== 'object') continue
    const r = entry as Record<string, unknown>
    const name = typeof r.nombre === 'string' ? r.nombre.trim() : ''
    if (!name) continue
    const price = typeof r.precio === 'number' ? r.precio : toPesos(r.precio)
    if (!Number.isFinite(price) || price <= 0) continue
    const stock = typeof r.stock === 'number' && Number.isFinite(r.stock) ? Math.max(0, Math.round(r.stock)) : null
    out.push({ name: name.slice(0, 120), price: Math.round(price), stock, active: true })
  }
  return out
}

async function extractWithTextModel(text: string): Promise<CatalogItem[]> {
  const provider = getProvider()
  const completion = await provider.complete({
    system: ITEMS_PROMPT,
    messages: [{ role: 'user', text: text.slice(0, 20_000) }],
    maxTokens: 4000,
    effort: 'low',
  })
  return toCatalogItems(parseItemsJson(completion.text))
}

/** Foto o escaneo de la carta: se manda directo a un modelo con visión. */
export async function parseImageCatalog(bytes: Uint8Array, mimeType: string): Promise<CatalogItem[]> {
  if (bytes.length > MAX_FILE_BYTES) throw new CatalogFileError('La imagen es muy pesada (máximo 10 MB).')
  let text: string | null
  try {
    text = await callVisionText(bytes, mimeType, ITEMS_PROMPT)
  } catch (error) {
    if (error instanceof UnsupportedImageError) throw new CatalogFileError(error.message)
    throw error
  }
  if (text === null) {
    throw new CatalogFileError('No hay un modelo de IA con visión configurado para leer imágenes.')
  }
  return toCatalogItems(parseItemsJson(text))
}

/** PDF con texto (no un escaneo): se saca el texto y se lo pasa a la IA para estructurarlo. */
export async function parsePdfCatalog(bytes: Uint8Array): Promise<CatalogItem[]> {
  if (bytes.length > MAX_FILE_BYTES) throw new CatalogFileError('El PDF es muy pesado (máximo 10 MB).')

  const { PDFParse } = await import('pdf-parse')
  let text = ''
  try {
    const parser = new PDFParse({ data: Buffer.from(bytes) })
    const result = await parser.getText()
    text = result.text.trim()
  } catch {
    throw new CatalogFileError('No se pudo leer ese PDF. Prueba exportarlo de nuevo o súbelo como foto.')
  }

  if (text.length < 20) {
    throw new CatalogFileError(
      'Este PDF parece ser un escaneo (una imagen dentro de un PDF) y no se le puede sacar texto. Sube una foto de la carta en su lugar: con eso sí funciona.',
    )
  }
  return extractWithTextModel(text)
}

const NAME_HEADERS = ['nombre', 'producto', 'item', 'ítem', 'descripcion', 'descripción', 'plato', 'articulo', 'artículo']
const PRICE_HEADERS = ['precio', 'valor', 'price', 'pvp']
const STOCK_HEADERS = ['stock', 'cantidad', 'existencia', 'existencias']

/** Encuentra qué columna de la fila de encabezado corresponde a nombre, precio y stock. */
function findColumns(header: unknown[]): { name: number; price: number; stock: number } {
  const norm = header.map((h) => String(h ?? '').trim().toLowerCase())
  const find = (candidates: string[]) => norm.findIndex((h) => candidates.some((c) => h.includes(c)))
  return { name: find(NAME_HEADERS), price: find(PRICE_HEADERS), stock: find(STOCK_HEADERS) }
}

/** Excel (.xlsx, .xls) o CSV: se lee la primera hoja como filas y se buscan las columnas de nombre y precio. */
export async function parseExcelCatalog(bytes: Uint8Array): Promise<CatalogItem[]> {
  if (bytes.length > MAX_FILE_BYTES) throw new CatalogFileError('El archivo es muy pesado (máximo 10 MB).')

  const XLSX = await import('xlsx')
  let rows: unknown[][]
  try {
    const workbook = XLSX.read(Buffer.from(bytes), { type: 'buffer' })
    const sheetName = workbook.SheetNames[0]
    if (!sheetName) throw new Error('vacío')
    rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, blankrows: false }) as unknown[][]
  } catch {
    throw new CatalogFileError('No se pudo leer ese archivo. Revisa que sea un Excel o CSV válido.')
  }
  if (rows.length === 0) throw new CatalogFileError('El archivo no tiene filas con datos.')

  let { name: nameCol, price: priceCol, stock: stockCol } = findColumns(rows[0])
  let dataRows = rows.slice(1)
  if (nameCol === -1 || priceCol === -1) {
    // Sin encabezados reconocibles: se asume columna 1 = nombre, columna 2 = precio.
    nameCol = 0
    priceCol = 1
    stockCol = -1
    dataRows = rows
  }

  const items: CatalogItem[] = []
  for (const row of dataRows) {
    const name = String(row[nameCol] ?? '').trim()
    if (!name) continue
    const price = toPesos(row[priceCol])
    if (price <= 0) continue
    const stockRaw = stockCol >= 0 ? row[stockCol] : undefined
    const stock = stockRaw !== undefined && stockRaw !== '' && stockRaw !== null ? Math.max(0, Math.round(toPesos(stockRaw))) : null
    items.push({ name: name.slice(0, 120), price, stock, active: true })
    if (items.length >= MAX_ITEMS) break
  }
  if (items.length === 0) {
    throw new CatalogFileError('No se encontraron productos con precio en el archivo. Revisa que tenga columnas de nombre y precio.')
  }
  return items
}
