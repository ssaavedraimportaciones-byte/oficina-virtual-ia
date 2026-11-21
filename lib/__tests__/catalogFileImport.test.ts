import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * `lib/catalogFileImport.ts` habla con la IA (visión y texto) para leer una
 * foto, un PDF o un Excel/CSV de la carta. Acá se prueba sin red: lo que
 * importa es que arme bien los productos a partir de lo que la IA (o el
 * Excel) devuelve, no que la IA funcione (eso ya lo prueban sus proveedores).
 */

const callVisionText = vi.fn()
vi.mock('../receipts', async () => {
  const actual = await vi.importActual<typeof import('../receipts')>('../receipts')
  return { ...actual, callVisionText: (...args: unknown[]) => callVisionText(...args) }
})

const complete = vi.fn()
vi.mock('../llm', async () => {
  const actual = await vi.importActual<typeof import('../llm')>('../llm')
  return { ...actual, getProvider: () => ({ complete }) }
})

const ITEMS_JSON = (items: unknown[]) => JSON.stringify({ items })

beforeEach(() => {
  callVisionText.mockReset()
  complete.mockReset()
})

describe('importación de catálogo: foto de la carta', () => {
  it('convierte la respuesta de la IA en productos, separando cada variante', async () => {
    const { parseImageCatalog } = await import('../catalogFileImport')
    callVisionText.mockResolvedValue(
      ITEMS_JSON([
        { nombre: 'Completo mediano', precio: 1500, stock: null },
        { nombre: 'Completo grande', precio: 2500, stock: null },
      ]),
    )
    const items = await parseImageCatalog(new Uint8Array([1, 2, 3]), 'image/jpeg')
    expect(items).toEqual([
      { name: 'Completo mediano', price: 1500, stock: null, active: true },
      { name: 'Completo grande', price: 2500, stock: null, active: true },
    ])
  })

  it('descarta líneas sin nombre o con precio inválido, sin romper el resto', async () => {
    const { parseImageCatalog } = await import('../catalogFileImport')
    callVisionText.mockResolvedValue(
      ITEMS_JSON([
        { nombre: '', precio: 1000, stock: null },
        { nombre: 'Sin precio', precio: 0, stock: null },
        { nombre: 'Bebida', precio: 1500, stock: 10 },
      ]),
    )
    const items = await parseImageCatalog(new Uint8Array([1]), 'image/jpeg')
    expect(items).toEqual([{ name: 'Bebida', price: 1500, stock: 10, active: true }])
  })

  it('tolera texto de razonamiento alrededor del JSON (modelos que piensan antes de responder)', async () => {
    const { parseImageCatalog } = await import('../catalogFileImport')
    callVisionText.mockResolvedValue(`<think>dejame revisar la foto</think>\nAcá está:\n${ITEMS_JSON([{ nombre: 'Papas fritas', precio: 2000, stock: null }])}\nListo.`)
    const items = await parseImageCatalog(new Uint8Array([1]), 'image/jpeg')
    expect(items).toEqual([{ name: 'Papas fritas', price: 2000, stock: null, active: true }])
  })

  it('sin IA con visión configurada, avisa en vez de fallar feo', async () => {
    const { parseImageCatalog } = await import('../catalogFileImport')
    callVisionText.mockResolvedValue(null)
    await expect(parseImageCatalog(new Uint8Array([1]), 'image/jpeg')).rejects.toThrow(
      /no hay un modelo de ia con visión configurado/i,
    )
  })

  it('un formato de imagen no soportado (ej. HEIC) da un mensaje claro, no el error crudo del proveedor', async () => {
    const { parseImageCatalog } = await import('../catalogFileImport')
    const { UnsupportedImageError } = await import('../receipts')
    callVisionText.mockRejectedValue(new UnsupportedImageError('formato no soportado'))
    await expect(parseImageCatalog(new Uint8Array([1]), 'image/heic')).rejects.toThrow('formato no soportado')
  })

  it('rechaza una imagen mayor a 10 MB sin leerla', async () => {
    const { parseImageCatalog, MAX_FILE_BYTES } = await import('../catalogFileImport')
    const big = new Uint8Array(MAX_FILE_BYTES + 1)
    await expect(parseImageCatalog(big, 'image/jpeg')).rejects.toThrow(/muy pesada/)
    expect(callVisionText).not.toHaveBeenCalled()
  })

  it('no guarda más de 300 productos aunque la IA devuelva más (freno a una alucinación)', async () => {
    const { parseImageCatalog } = await import('../catalogFileImport')
    const many = Array.from({ length: 500 }, (_, i) => ({ nombre: `Producto ${i}`, precio: 100 + i, stock: null }))
    callVisionText.mockResolvedValue(ITEMS_JSON(many))
    const items = await parseImageCatalog(new Uint8Array([1]), 'image/jpeg')
    expect(items.length).toBe(300)
  })
})

describe('importación de catálogo: PDF', () => {
  it('un PDF escaneado (sin texto real) pide una foto en su lugar, no revienta', async () => {
    const { parsePdfCatalog } = await import('../catalogFileImport')
    const blankPdf = Buffer.from(
      '%PDF-1.1\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\nxref\n0 4\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n0\n%%EOF',
    )
    await expect(parsePdfCatalog(blankPdf)).rejects.toThrow(/escaneo/)
    expect(complete).not.toHaveBeenCalled()
  })

  it('con texto real, se lo pasa a la IA de texto y arma los productos', async () => {
    const { parsePdfCatalog } = await import('../catalogFileImport')
    const pdfWithText = Buffer.from(
      '%PDF-1.1\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n4 0 obj<</Length 55>>stream\nBT /F1 18 Tf 10 100 Td (Completo mediano 1500) Tj ET\nendstream\nendobj\n5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\nxref\n0 6\ntrailer<</Size 6/Root 1 0 R>>\nstartxref\n0\n%%EOF',
    )
    complete.mockResolvedValue({ text: ITEMS_JSON([{ nombre: 'Completo mediano', precio: 1500, stock: null }]), toolCalls: [] })
    const items = await parsePdfCatalog(pdfWithText)
    expect(items).toEqual([{ name: 'Completo mediano', price: 1500, stock: null, active: true }])
    expect(complete).toHaveBeenCalledOnce()
  })

  it('rechaza un PDF mayor a 10 MB sin leerlo', async () => {
    const { parsePdfCatalog, MAX_FILE_BYTES } = await import('../catalogFileImport')
    const big = Buffer.alloc(MAX_FILE_BYTES + 1)
    await expect(parsePdfCatalog(big)).rejects.toThrow(/muy pesado/)
  })

  it('un archivo que no es un PDF de verdad da un error claro, no una excepción cruda', async () => {
    const { parsePdfCatalog } = await import('../catalogFileImport')
    await expect(parsePdfCatalog(Buffer.from('esto no es un pdf'))).rejects.toThrow(/no se pudo leer ese pdf/i)
  })
})

describe('importación de catálogo: Excel y CSV', () => {
  async function toXlsxBuffer(rows: unknown[][]): Promise<Uint8Array> {
    const XLSX = await import('xlsx')
    const sheet = XLSX.utils.aoa_to_sheet(rows)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, sheet, 'Carta')
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Uint8Array
  }

  it('reconoce las columnas por encabezado, en cualquier orden', async () => {
    const { parseExcelCatalog } = await import('../catalogFileImport')
    const bytes = await toXlsxBuffer([
      ['Stock', 'Precio', 'Nombre'],
      [10, 1500, 'Completo mediano'],
      ['', 2500, 'Completo grande'],
    ])
    const items = await parseExcelCatalog(bytes)
    expect(items).toEqual([
      { name: 'Completo mediano', price: 1500, stock: 10, active: true },
      { name: 'Completo grande', price: 2500, stock: null, active: true },
    ])
  })

  it('sin encabezados reconocibles, asume nombre en la 1ª columna y precio en la 2ª', async () => {
    const { parseExcelCatalog } = await import('../catalogFileImport')
    const bytes = await toXlsxBuffer([
      ['Completo mediano', 1500],
      ['Completo grande', 2500],
    ])
    const items = await parseExcelCatalog(bytes)
    expect(items).toEqual([
      { name: 'Completo mediano', price: 1500, stock: null, active: true },
      { name: 'Completo grande', price: 2500, stock: null, active: true },
    ])
  })

  it('un CSV se lee igual que un Excel', async () => {
    const { parseExcelCatalog } = await import('../catalogFileImport')
    const csv = Buffer.from('nombre,precio\nCompleto mediano,1500\nCompleto grande,2500\n', 'utf-8')
    const items = await parseExcelCatalog(csv)
    expect(items).toEqual([
      { name: 'Completo mediano', price: 1500, stock: null, active: true },
      { name: 'Completo grande', price: 2500, stock: null, active: true },
    ])
  })

  it('salta filas sin precio válido en vez de romper toda la importación', async () => {
    const { parseExcelCatalog } = await import('../catalogFileImport')
    const bytes = await toXlsxBuffer([
      ['nombre', 'precio'],
      ['Sin precio', ''],
      ['Completo grande', 2500],
    ])
    const items = await parseExcelCatalog(bytes)
    expect(items).toEqual([{ name: 'Completo grande', price: 2500, stock: null, active: true }])
  })

  it('si no hay ningún producto con precio, avisa en vez de guardar un catálogo vacío', async () => {
    const { parseExcelCatalog } = await import('../catalogFileImport')
    const bytes = await toXlsxBuffer([['nombre', 'precio']])
    await expect(parseExcelCatalog(bytes)).rejects.toThrow(/no se encontraron productos/i)
  })

  it('rechaza un archivo mayor a 10 MB sin leerlo', async () => {
    const { parseExcelCatalog, MAX_FILE_BYTES } = await import('../catalogFileImport')
    const big = new Uint8Array(MAX_FILE_BYTES + 1)
    await expect(parseExcelCatalog(big)).rejects.toThrow(/muy pesado/)
  })
})
