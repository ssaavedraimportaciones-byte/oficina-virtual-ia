import type { OCRResult, OCRLine, OCRField, OCRTable, SignatureRegion, OCRWord } from './types'
import { CONFIDENCE_THRESHOLD } from './types'

const ENDPOINT = process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT ?? ''
const API_KEY = process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY ?? ''
const API_VERSION = '2024-02-29-preview'

// prebuilt-read: printed + handwritten text, confidence scores, multi-language
const READ_MODEL = 'prebuilt-read'
// prebuilt-document: key-value pairs + signature detection
const DOC_MODEL = 'prebuilt-document'

interface AzureAnalyzeResponse {
  status: 'notStarted' | 'running' | 'succeeded' | 'failed'
  analyzeResult?: AzureAnalyzeResult
  error?: { code: string; message: string }
}

interface AzureAnalyzeResult {
  modelId: string
  apiVersion: string
  content: string
  pages: AzurePage[]
  tables?: AzureTable[]
  keyValuePairs?: AzureKeyValuePair[]
  styles?: AzureStyle[]
  languages?: AzureLanguage[]
}

interface AzurePage {
  pageNumber: number
  lines?: AzureLine[]
}

interface AzureLine {
  content: string
  words?: AzureWord[]
  spans?: Array<{ offset: number; length: number }>
  polygon?: number[]
}

interface AzureWord {
  content: string
  confidence: number
  polygon?: number[]
  span?: { offset: number; length: number }
}

interface AzureTable {
  rowCount: number
  columnCount: number
  cells: AzureTableCell[]
}

interface AzureTableCell {
  content: string
  rowIndex: number
  columnIndex: number
  rowSpan?: number
  columnSpan?: number
  boundingRegions?: Array<{ polygon: number[] }>
}

interface AzureKeyValuePair {
  key: { content: string }
  value?: { content: string; confidence: number; polygon?: number[] }
  confidence: number
}

interface AzureStyle {
  isHandwritten?: boolean
  confidence: number
  spans?: Array<{ offset: number; length: number }>
}

interface AzureLanguage {
  locale: string
  confidence: number
}

async function analyzeDocument(
  buffer: Buffer,
  mimeType: string,
  modelId: string
): Promise<AzureAnalyzeResult> {
  if (!ENDPOINT || !API_KEY) {
    throw new Error(
      'Azure Document Intelligence no configurado. Define AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT y AZURE_DOCUMENT_INTELLIGENCE_KEY.'
    )
  }

  const url = `${ENDPOINT}/documentintelligence/documentModels/${modelId}:analyze?api-version=${API_VERSION}`

  const startRes = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': mimeType,
      'Ocp-Apim-Subscription-Key': API_KEY,
    },
    body: buffer as unknown as BodyInit,
  })

  if (!startRes.ok) {
    const err = await startRes.text()
    throw new Error(`Azure OCR error ${startRes.status}: ${err}`)
  }

  const pollUrl = startRes.headers.get('Operation-Location')
  if (!pollUrl) throw new Error('Azure OCR: no Operation-Location header')

  return pollForResult(pollUrl)
}

async function pollForResult(pollUrl: string): Promise<AzureAnalyzeResult> {
  const MAX_ATTEMPTS = 30
  const POLL_INTERVAL_MS = 2000

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    await sleep(POLL_INTERVAL_MS)

    const res = await fetch(pollUrl, {
      headers: { 'Ocp-Apim-Subscription-Key': API_KEY },
    })

    if (!res.ok) {
      throw new Error(`Azure OCR poll error ${res.status}`)
    }

    const data = (await res.json()) as AzureAnalyzeResponse

    if (data.status === 'succeeded' && data.analyzeResult) {
      return data.analyzeResult
    }

    if (data.status === 'failed') {
      throw new Error(`Azure OCR failed: ${data.error?.message ?? 'unknown'}`)
    }
  }

  throw new Error('Azure OCR timeout: analysis did not complete in time')
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

function buildHandwrittenSpanSet(styles: AzureStyle[]): Set<number> {
  const handwrittenOffsets = new Set<number>()
  for (const style of styles) {
    if (style.isHandwritten && style.spans) {
      for (const span of style.spans) {
        for (let i = span.offset; i < span.offset + span.length; i++) {
          handwrittenOffsets.add(i)
        }
      }
    }
  }
  return handwrittenOffsets
}

function wordIsHandwritten(word: AzureWord, handwrittenOffsets: Set<number>): boolean {
  if (!word.span) return false
  return handwrittenOffsets.has(word.span.offset)
}

export async function runAzureOCR(
  buffer: Buffer,
  mimeType: string
): Promise<OCRResult> {
  // Run both models in parallel: read for text+handwriting, document for key-values+signatures
  const [readResult, docResult] = await Promise.allSettled([
    analyzeDocument(buffer, mimeType, READ_MODEL),
    analyzeDocument(buffer, mimeType, DOC_MODEL),
  ])

  if (readResult.status === 'rejected') {
    throw readResult.reason as Error
  }

  const read = readResult.value
  const doc = docResult.status === 'fulfilled' ? docResult.value : null

  const handwrittenOffsets = buildHandwrittenSpanSet(read.styles ?? [])
  const hasHandwrittenContent = (read.styles ?? []).some((s) => s.isHandwritten)

  // Build lines
  const lines: OCRLine[] = []
  for (const page of read.pages ?? []) {
    for (const line of page.lines ?? []) {
      const words: OCRWord[] = (line.words ?? []).map((w) => ({
        content: w.content,
        confidence: w.confidence ?? 1,
        isHandwritten: wordIsHandwritten(w, handwrittenOffsets),
        polygon: w.polygon,
      }))

      const lineIsHandwritten =
        words.length > 0 && words.every((w) => w.isHandwritten)

      lines.push({
        content: line.content,
        words,
        isHandwritten: lineIsHandwritten,
        pageNumber: page.pageNumber,
      })
    }
  }

  // Build fields from key-value pairs
  const fields: OCRField[] = []
  for (const kv of doc?.keyValuePairs ?? []) {
    if (!kv.value?.content) continue
    const confidence = Math.min(kv.confidence, kv.value.confidence ?? kv.confidence)
    const valuePolygon = kv.value.polygon
    const valueOffset = 0 // approximate: check if any word in polygon is handwritten

    fields.push({
      name: kv.key.content.replace(/[:\s]+$/, '').trim(),
      value: kv.value.content.trim(),
      confidence,
      isHandwritten: handwrittenOffsets.size > 0 && hasHandwrittenContent,
      requiresReview: confidence < CONFIDENCE_THRESHOLD,
      polygon: valuePolygon,
    })
  }

  // Build tables
  const tables: OCRTable[] = (doc?.tables ?? read.tables ?? []).map((t) => ({
    rowCount: t.rowCount,
    columnCount: t.columnCount,
    cells: t.cells.map((c) => ({
      text: c.content,
      rowIndex: c.rowIndex,
      columnIndex: c.columnIndex,
      confidence: 1,
      rowSpan: c.rowSpan,
      columnSpan: c.columnSpan,
    })),
  }))

  // Detect signatures (prebuilt-document marks them as key-value pairs with :signature type)
  const signatures: SignatureRegion[] = (doc?.keyValuePairs ?? [])
    .filter(
      (kv) =>
        kv.key.content.toLowerCase().includes('firma') ||
        kv.key.content.toLowerCase().includes('signature')
    )
    .map((kv, i) => ({
      fieldName: kv.key.content,
      pageNumber: 1,
      confidence: kv.confidence,
      polygon: kv.value?.polygon,
    }))

  // Compute average confidence from all word confidences
  const allWordConfidences = lines.flatMap((l) => l.words.map((w) => w.confidence))
  const averageConfidence =
    allWordConfidences.length > 0
      ? allWordConfidences.reduce((a, b) => a + b, 0) / allWordConfidences.length
      : 0

  // Detect language
  const language =
    (doc?.languages ?? read.languages ?? [])[0]?.locale ??
    (read.languages ?? [])[0]?.locale ??
    'es'

  return {
    rawText: read.content,
    lines,
    fields,
    tables,
    signatures,
    averageConfidence,
    requiresHumanReview:
      averageConfidence < CONFIDENCE_THRESHOLD ||
      fields.some((f) => f.requiresReview),
    hasHandwrittenContent,
    pageCount: read.pages?.length ?? 1,
    language,
    modelVersion: read.apiVersion,
  }
}
