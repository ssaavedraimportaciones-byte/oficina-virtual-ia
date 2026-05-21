import Anthropic from '@anthropic-ai/sdk'
import type { AIClassificationResult, DocumentType } from './types'
import {
  CLASSIFICATION_SYSTEM_PROMPT,
  buildClassificationPrompt,
  buildFieldExtractionPrompt,
  DOCUMENT_FIELD_SCHEMAS,
} from './prompts'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

async function callClaude(systemPrompt: string, userPrompt: string): Promise<string> {
  const message = await anthropic.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 4096,
    thinking: { type: 'adaptive' },
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  })

  const textBlock = message.content.find((b) => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text response from Claude')
  }

  return textBlock.text.trim()
}

function parseClassificationJSON(raw: string): AIClassificationResult {
  // Strip markdown code fences if present
  const clean = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
  const parsed = JSON.parse(clean)

  const documentType: DocumentType = parsed.documentType ?? 'OTHER'
  const confidence: number = typeof parsed.confidence === 'number' ? parsed.confidence : 0
  const fields: Record<string, { value: string | null; inferred: boolean }> = parsed.fields ?? {}
  const missingFields: string[] = Array.isArray(parsed.missingFields) ? parsed.missingFields : []
  const observations: string[] = Array.isArray(parsed.observations) ? parsed.observations : []
  const inferredFields: string[] = Array.isArray(parsed.inferredFields) ? parsed.inferredFields : []

  return { documentType, confidence, fields, missingFields, observations, inferredFields }
}

export async function callClassifyDocument(fileText: string): Promise<AIClassificationResult> {
  const raw = await callClaude(CLASSIFICATION_SYSTEM_PROMPT, buildClassificationPrompt(fileText))
  return parseClassificationJSON(raw)
}

export async function callExtractFields(
  documentType: DocumentType,
  extractedText: string
): Promise<AIClassificationResult> {
  const raw = await callClaude(
    CLASSIFICATION_SYSTEM_PROMPT,
    buildFieldExtractionPrompt(documentType, extractedText)
  )
  return parseClassificationJSON(raw)
}

export function computeMissingFields(
  documentType: DocumentType,
  fields: Record<string, { value: string | null; inferred: boolean }>
): string[] {
  const schema = DOCUMENT_FIELD_SCHEMAS[documentType]
  return schema
    .filter((f) => f.required && (!fields[f.name] || fields[f.name].value === null))
    .map((f) => f.name)
}
