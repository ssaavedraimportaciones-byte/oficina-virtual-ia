'use client'

import { useState } from 'react'
import type { OCRResult, FieldConflict } from '@/modules/ocr/types'
import FieldConfidenceBadge from './FieldConfidenceBadge'

interface Props {
  result: OCRResult
  conflicts?: FieldConflict[]
  onResolveConflict?: (fieldName: string, keepManual: boolean) => void
  isLoading?: boolean
}

type Tab = 'fields' | 'text' | 'tables'

export default function OCRResultPreview({
  result,
  conflicts = [],
  onResolveConflict,
  isLoading,
}: Props) {
  const [tab, setTab] = useState<Tab>('fields')

  if (isLoading) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-gray-400">Analizando documento...</p>
        <p className="text-xs text-gray-600 mt-1">
          Azure Document Intelligence está procesando el archivo
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Summary banner */}
      <div
        className={`rounded-xl px-4 py-3 border flex flex-wrap gap-x-6 gap-y-1.5 items-center ${
          result.requiresHumanReview
            ? 'bg-orange-950 border-orange-800'
            : 'bg-green-950 border-green-800'
        }`}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">{result.requiresHumanReview ? '⚠️' : '✅'}</span>
          <span
            className={`text-sm font-semibold ${
              result.requiresHumanReview ? 'text-orange-300' : 'text-green-300'
            }`}
          >
            {result.requiresHumanReview
              ? 'Requiere revisión humana'
              : 'Extracción exitosa'}
          </span>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          <span className="text-gray-400">
            Confianza:{' '}
            <span className="text-white font-medium">
              {Math.round(result.averageConfidence * 100)}%
            </span>
          </span>
          <span className="text-gray-400">
            Páginas:{' '}
            <span className="text-white font-medium">{result.pageCount}</span>
          </span>
          {result.hasHandwrittenContent && (
            <span className="bg-purple-900 text-purple-300 px-2 py-0.5 rounded-full">
              ✍️ Manuscrito detectado
            </span>
          )}
          {result.signatures.length > 0 && (
            <span className="bg-blue-900 text-blue-300 px-2 py-0.5 rounded-full">
              ✒️ {result.signatures.length} firma(s)
            </span>
          )}
        </div>
      </div>

      {/* Conflicts */}
      {conflicts.length > 0 && (
        <div className="bg-yellow-950 border border-yellow-800 rounded-xl p-4">
          <p className="text-sm font-semibold text-yellow-300 mb-3">
            ⚠️ {conflicts.length} campo(s) con valor manual — ¿qué hacer?
          </p>
          <div className="space-y-3">
            {conflicts.map((c) => (
              <div
                key={c.fieldName}
                className="bg-yellow-900/30 rounded-lg p-3 flex flex-wrap gap-3 items-start justify-between"
              >
                <div className="min-w-0">
                  <p className="text-xs text-yellow-400 font-medium mb-1">{c.fieldName}</p>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 w-14 flex-shrink-0">Manual:</span>
                      <span className="text-sm text-gray-200 truncate">{c.existingValue}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 w-14 flex-shrink-0">OCR:</span>
                      <span className="text-sm text-gray-200 truncate">{c.newValue}</span>
                      <FieldConfidenceBadge confidence={c.newConfidence} size="xs" />
                    </div>
                  </div>
                </div>
                {onResolveConflict && (
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => onResolveConflict(c.fieldName, true)}
                      className="text-xs px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg transition-colors"
                    >
                      Mantener manual
                    </button>
                    <button
                      onClick={() => onResolveConflict(c.fieldName, false)}
                      className="text-xs px-3 py-1.5 bg-amber-700 hover:bg-amber-600 text-white rounded-lg transition-colors"
                    >
                      Usar OCR
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab navigation */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="flex border-b border-gray-800">
          {(['fields', 'text', 'tables'] as Tab[]).map((t) => {
            const labels: Record<Tab, string> = {
              fields: `Campos (${result.fields.length})`,
              text: 'Texto extraído',
              tables: `Tablas (${result.tables.length})`,
            }
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
                  tab === t
                    ? 'bg-gray-800 text-white border-b-2 border-amber-500'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
                }`}
              >
                {labels[t]}
              </button>
            )
          })}
        </div>

        <div className="p-4 max-h-96 overflow-y-auto">
          {tab === 'fields' && (
            <FieldsTab fields={result.fields} />
          )}
          {tab === 'text' && (
            <TextTab text={result.rawText} lines={result.lines} />
          )}
          {tab === 'tables' && (
            <TablesTab tables={result.tables} />
          )}
        </div>
      </div>
    </div>
  )
}

function FieldsTab({ fields }: { fields: OCRResult['fields'] }) {
  if (fields.length === 0) {
    return (
      <p className="text-sm text-gray-500 text-center py-4">
        No se detectaron campos estructurados. Revisa la pestaña de texto.
      </p>
    )
  }

  return (
    <div className="divide-y divide-gray-800">
      {fields.map((f, i) => (
        <div key={i} className="py-2.5 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs text-gray-500 mb-0.5">{f.name}</p>
            <p className="text-sm text-gray-200 break-words">{f.value}</p>
            {f.isHandwritten && (
              <span className="text-xs text-purple-400 mt-0.5 inline-block">✍️ Manuscrito</span>
            )}
          </div>
          <div className="flex-shrink-0 flex flex-col items-end gap-1">
            <FieldConfidenceBadge confidence={f.confidence} size="xs" />
            {f.requiresReview && (
              <span className="text-xs text-orange-400">Rev. requerida</span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function TextTab({
  text,
  lines,
}: {
  text: string
  lines: OCRResult['lines']
}) {
  const handwrittenLines = lines.filter((l) => l.isHandwritten)

  return (
    <div className="space-y-4">
      {handwrittenLines.length > 0 && (
        <div className="bg-purple-950 border border-purple-800 rounded-lg p-3">
          <p className="text-xs text-purple-300 font-medium mb-1">
            ✍️ Líneas manuscritas detectadas ({handwrittenLines.length})
          </p>
          <div className="space-y-1">
            {handwrittenLines.map((l, i) => (
              <p key={i} className="text-sm text-purple-200 italic">
                &quot;{l.content}&quot;
              </p>
            ))}
          </div>
        </div>
      )}

      <pre className="text-sm text-gray-300 whitespace-pre-wrap font-mono leading-relaxed bg-gray-800 rounded-lg p-3 text-xs">
        {text || 'Sin texto extraído'}
      </pre>
    </div>
  )
}

function TablesTab({ tables }: { tables: OCRResult['tables'] }) {
  if (tables.length === 0) {
    return (
      <p className="text-sm text-gray-500 text-center py-4">
        No se detectaron tablas en el documento.
      </p>
    )
  }

  return (
    <div className="space-y-6">
      {tables.map((table, ti) => {
        // Build 2D grid
        const grid: string[][] = Array.from({ length: table.rowCount }, () =>
          Array(table.columnCount).fill('')
        )
        for (const cell of table.cells) {
          if (cell.rowIndex < table.rowCount && cell.columnIndex < table.columnCount) {
            grid[cell.rowIndex][cell.columnIndex] = cell.text
          }
        }

        return (
          <div key={ti}>
            <p className="text-xs text-gray-500 mb-2">
              Tabla {ti + 1} — {table.rowCount} filas × {table.columnCount} columnas
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <tbody>
                  {grid.map((row, ri) => (
                    <tr key={ri}>
                      {row.map((cell, ci) => (
                        <td
                          key={ci}
                          className={`border border-gray-700 px-2 py-1.5 text-gray-300 ${
                            ri === 0 ? 'bg-gray-800 font-medium text-gray-200' : ''
                          }`}
                        >
                          {cell || <span className="text-gray-700">—</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}
    </div>
  )
}
