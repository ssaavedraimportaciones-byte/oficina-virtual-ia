import type { OCRResult } from './types'

/**
 * Demo OCR fallback — used when AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT is not set.
 * Returns realistic mock data for a Charla de Seguridad document.
 */
export function runMockOCR(_buffer: Buffer, _mimeType: string): OCRResult {
  const today = new Date().toLocaleDateString('es-CL')

  return {
    rawText: [
      'CHARLA DE SEGURIDAD',
      'Empresa: Minera Demo S.A.',
      `Fecha: ${today}     Hora: 08:30`,
      'Área / Faena: Nivel 3 — Extracción',
      'Tema: Uso correcto de EPP en trabajo en altura',
      'Relator: Carlos Rojas (Prevencionista)',
      '',
      'ASISTENTES (12)',
      '1. Juan Pérez — RUT 12.345.678-9',
      '2. María González — RUT 9.876.543-2',
      '',
      '[ ] Firma relator: _______________________',
      '[ ] Firma supervisor: _______________________',
      '',
      '* OCR simulado — configura AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT para OCR real',
    ].join('\n'),

    lines: [],

    fields: [
      { name: 'empresa',        value: 'Minera Demo S.A.',                      confidence: 0.97, isHandwritten: false, requiresReview: false },
      { name: 'fecha',          value: today,                                   confidence: 0.95, isHandwritten: false, requiresReview: false },
      { name: 'area',           value: 'Nivel 3 — Extracción',                  confidence: 0.93, isHandwritten: false, requiresReview: false },
      { name: 'tema',           value: 'Uso correcto de EPP en trabajo en altura', confidence: 0.91, isHandwritten: false, requiresReview: false },
      { name: 'relator',        value: 'Carlos Rojas (Prevencionista)',          confidence: 0.96, isHandwritten: false, requiresReview: false },
      { name: 'hora',           value: '08:30',                                  confidence: 0.98, isHandwritten: false, requiresReview: false },
      { name: 'num_asistentes', value: '12',                                    confidence: 0.92, isHandwritten: false, requiresReview: false },
    ],

    tables: [
      {
        rowCount: 3,
        columnCount: 2,
        cells: [
          { text: 'Nombre',         rowIndex: 0, columnIndex: 0, confidence: 1 },
          { text: 'RUT',            rowIndex: 0, columnIndex: 1, confidence: 1 },
          { text: 'Juan Pérez',     rowIndex: 1, columnIndex: 0, confidence: 0.95 },
          { text: '12.345.678-9',   rowIndex: 1, columnIndex: 1, confidence: 0.93 },
          { text: 'María González', rowIndex: 2, columnIndex: 0, confidence: 0.96 },
          { text: '9.876.543-2',    rowIndex: 2, columnIndex: 1, confidence: 0.94 },
        ],
      },
    ],

    signatures: [
      { fieldName: 'firma_relator',    pageNumber: 1, confidence: 0.72 },
      { fieldName: 'firma_supervisor', pageNumber: 1, confidence: 0.68 },
    ],

    averageConfidence: 0.94,
    requiresHumanReview: false,
    hasHandwrittenContent: false,
    pageCount: 1,
    language: 'es',
    modelVersion: 'mock-1.0',
  }
}
