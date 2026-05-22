/**
 * File type validation by magic bytes.
 * Never trust the MIME type or file extension declared by the client.
 * Only PDF, PNG, and JPG are accepted for MVP.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type AllowedFileType = 'pdf' | 'png' | 'jpg'

export interface FileTypeResult {
  valid: true
  detectedType: AllowedFileType
  mimeType: 'application/pdf' | 'image/png' | 'image/jpeg'
  extension: 'pdf' | 'png' | 'jpg'
}

export interface FileTypeError {
  valid: false
  reason: 'unsupported_file_type' | 'empty_file' | 'file_too_small' | 'mime_mismatch'
}

export type FileValidationResult = FileTypeResult | FileTypeError

// ── Magic byte signatures ─────────────────────────────────────────────────────

const SIGNATURES: Array<{
  type: AllowedFileType
  mimeType: FileTypeResult['mimeType']
  extension: FileTypeResult['extension']
  magic: number[]
}> = [
  {
    type: 'pdf',
    mimeType: 'application/pdf',
    extension: 'pdf',
    magic: [0x25, 0x50, 0x44, 0x46], // %PDF
  },
  {
    type: 'png',
    mimeType: 'image/png',
    extension: 'png',
    magic: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  },
  {
    type: 'jpg',
    mimeType: 'image/jpeg',
    extension: 'jpg',
    magic: [0xff, 0xd8, 0xff], // SOI + first marker
  },
]

// Minimum bytes needed to read the longest magic sequence
const MIN_BYTES = 8

// Allowed client MIME types → expected detected file type
const MIME_TO_ALLOWED_TYPE: Record<string, AllowedFileType> = {
  'application/pdf': 'pdf',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg', // Some browsers send this non-standard variant
}

// ── Core functions ────────────────────────────────────────────────────────────

/**
 * Inspects the first bytes of a buffer and returns the detected file type.
 * Does NOT check declared MIME type — use validateAllowedUpload() for that.
 */
export function detectFileTypeByMagicBytes(buffer: Buffer): FileValidationResult {
  if (!buffer || buffer.length === 0) {
    return { valid: false, reason: 'empty_file' }
  }
  if (buffer.length < MIN_BYTES) {
    return { valid: false, reason: 'file_too_small' }
  }

  for (const sig of SIGNATURES) {
    if (sig.magic.every((byte, i) => buffer[i] === byte)) {
      return {
        valid: true,
        detectedType: sig.type,
        mimeType: sig.mimeType,
        extension: sig.extension,
      }
    }
  }

  return { valid: false, reason: 'unsupported_file_type' }
}

/**
 * Validates a file buffer and optionally cross-checks the client-declared MIME type.
 * Returns an error result (never throws) — use assertAllowedUpload() if you prefer exceptions.
 */
export function validateAllowedUpload(
  buffer: Buffer,
  declaredMimeType?: string
): FileValidationResult {
  const detected = detectFileTypeByMagicBytes(buffer)
  if (!detected.valid) return detected

  if (declaredMimeType) {
    const allowedType = MIME_TO_ALLOWED_TYPE[declaredMimeType]

    // Client MIME is not in our allowed list
    if (!allowedType) {
      return { valid: false, reason: 'unsupported_file_type' }
    }

    // Client MIME contradicts magic bytes (e.g., claims PNG but bytes are PDF)
    if (allowedType !== detected.detectedType) {
      return { valid: false, reason: 'mime_mismatch' }
    }
  }

  return detected
}

/**
 * Like validateAllowedUpload but throws FileValidationError on failure.
 * Use in upload handlers where you want a single throw point.
 */
export function assertAllowedUpload(
  buffer: Buffer,
  declaredMimeType?: string
): FileTypeResult {
  const result = validateAllowedUpload(buffer, declaredMimeType)
  if (!result.valid) {
    throw new FileValidationError(result.reason)
  }
  return result
}

/** Returns the list of supported file types for MVP. */
export function getAllowedFileTypes(): AllowedFileType[] {
  return ['pdf', 'png', 'jpg']
}

// ── Error class ───────────────────────────────────────────────────────────────

export class FileValidationError extends Error {
  readonly reason: FileTypeError['reason']

  constructor(
    reason: FileTypeError['reason'],
    message = 'Archivo no permitido. Solo se aceptan PDF, PNG o JPG válidos.'
  ) {
    super(message)
    this.name = 'FileValidationError'
    this.reason = reason
  }
}
