'use client'

import { useState } from 'react'

export default function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-gray-500">{label}</span>
      <div className="flex gap-2">
        <code className="min-w-0 flex-1 truncate rounded-md border border-gray-800 bg-gray-900 px-3 py-2 text-sm text-amber-400">
          {value}
        </code>
        <button
          onClick={handleCopy}
          className="shrink-0 rounded-md border border-gray-700 px-3 py-2 text-xs text-gray-300 hover:border-amber-500 hover:text-amber-400"
        >
          {copied ? 'Copiado' : 'Copiar'}
        </button>
      </div>
    </div>
  )
}
