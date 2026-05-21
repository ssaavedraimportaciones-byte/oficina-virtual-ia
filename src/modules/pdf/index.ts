import path from 'path'
import fs from 'fs/promises'
import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { prisma } from '@/lib/db/client'
import { log } from '@/modules/audit'
import {
  generateQrCode,
  createDocumentHash,
  generateQrDataUrl,
  buildVerifyUrl,
} from '@/modules/qr'
import { buildPdfDocument } from './template'
import type { PdfDocumentData, GeneratePdfResult } from './types'

export type { PdfDocumentData, GeneratePdfResult }

// ── Storage helpers ───────────────────────────────────────────────────────────

async function savePdfBuffer(
  buffer: Buffer,
  documentId: string,
  version: number
): Promise<string> {
  const useAzure =
    typeof process.env.AZURE_STORAGE_CONNECTION_STRING === 'string' &&
    process.env.AZURE_STORAGE_CONNECTION_STRING.length > 0

  const fileName = `${documentId}_v${version}.pdf`

  if (useAzure) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { BlobServiceClient } = await import('@azure/storage-blob' as any)
    const client = BlobServiceClient.fromConnectionString(
      process.env.AZURE_STORAGE_CONNECTION_STRING!
    )
    const container = client.getContainerClient(
      process.env.AZURE_STORAGE_CONTAINER ?? 'safecheck-docs'
    )
    await container.createIfNotExists()
    const blob = container.getBlockBlobClient(`pdfs/${fileName}`)
    await blob.uploadData(buffer, { blobHTTPHeaders: { blobContentType: 'application/pdf' } })
    return blob.url
  }

  // Local filesystem
  const uploadDir = process.env.UPLOAD_DIR ?? path.join(process.cwd(), 'uploads')
  const pdfDir = path.join(uploadDir, 'pdfs')
  await fs.mkdir(pdfDir, { recursive: true })
  await fs.writeFile(path.join(pdfDir, fileName), buffer)
  const urlPrefix = process.env.UPLOAD_URL_PREFIX ?? '/uploads'
  return `${urlPrefix}/pdfs/${fileName}`
}

// ── detectVersion ─────────────────────────────────────────────────────────────

async function detectVersion(documentId: string): Promise<number> {
  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    select: { finalPdfUrl: true },
  })
  if (!doc?.finalPdfUrl) return 1

  // Version is embedded in the filename: documentId_vN.pdf
  const match = doc.finalPdfUrl.match(/_v(\d+)\.pdf$/)
  return match ? parseInt(match[1], 10) + 1 : 2
}

// ── generateFinalPdf ──────────────────────────────────────────────────────────
/**
 * Generates the final approved PDF for a document.
 * Collects all document data, builds the QR + stamp, renders with react-pdf,
 * saves to storage, and updates the Document record.
 *
 * Rule: if the document already has a finalPdfUrl the old file is kept intact;
 * a new versioned file is created. The PDF is rendered from DB state at
 * generation time — subsequent data changes require a new version.
 */
export async function generateFinalPdf(
  documentId: string,
  initiatorId: string,
  ip?: string
): Promise<GeneratePdfResult> {
  // ── Fetch everything needed ────────────────────────────────────────────────
  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    include: {
      company: { select: { name: true, rut: true } },
      createdBy: { select: { name: true } },
      supervisor: { select: { name: true } },
      preventionist: { select: { name: true } },
      fields: { orderBy: { fieldName: 'asc' } },
      signatures: {
        orderBy: { signedAt: 'asc' },
        include: { user: { select: { name: true, role: true } } },
      },
      approvals: {
        orderBy: { approvedAt: 'asc' },
        include: { approver: { select: { name: true, role: true } } },
      },
      auditLogs: {
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { user: { select: { name: true, role: true } } },
      },
    },
  })

  if (!doc) throw new Error('Documento no encontrado')
  if (doc.status !== 'APPROVED') {
    throw new Error(`Solo se puede generar PDF de documentos APPROVED (estado actual: ${doc.status})`)
  }

  // Find approval timestamp
  const lastApproval = doc.approvals
    .filter((a) => a.status === 'APPROVED')
    .sort((a, b) =>
      (b.approvedAt?.getTime() ?? 0) - (a.approvedAt?.getTime() ?? 0)
    )[0]
  const approvedAt = lastApproval?.approvedAt?.toISOString() ?? new Date().toISOString()

  const version = await detectVersion(documentId)

  // ── QR + hash ──────────────────────────────────────────────────────────────
  const qrCode = generateQrCode({
    documentId: doc.id,
    folio: doc.folio,
    approvedAt,
  })

  const documentHash = createDocumentHash({
    documentId: doc.id,
    folio: doc.folio,
    taskName: doc.taskName,
    workArea: doc.workArea,
    documentType: doc.type,
    approvedAt,
  })

  const qrDataUrl = await generateQrDataUrl(qrCode)

  // ── Build PDF data model ───────────────────────────────────────────────────
  const pdfData: PdfDocumentData = {
    id: doc.id,
    folio: doc.folio,
    type: doc.type,
    taskName: doc.taskName,
    workArea: doc.workArea,
    companyName: doc.company.name,
    companyRut: doc.company.rut,
    createdByName: doc.createdBy.name,
    supervisorName: doc.supervisor?.name ?? '',
    preventionistName: doc.preventionist?.name ?? '',
    createdAt: doc.createdAt.toISOString(),
    approvedAt,
    documentStatus: doc.status,
    version,

    fields: doc.fields.map((f) => ({
      name: f.fieldName,
      value: f.fieldValue,
      confidence: f.confidence,
    })),

    signatures: doc.signatures.map((sig) => {
      const di = sig.deviceInfo as Record<string, string> | null
      return {
        signerName: sig.user.name,
        signerRole: sig.user.role,
        method: di?.subMethod ?? sig.method,
        signedAt: sig.signedAt.toISOString(),
        imageDataUrl: sig.signatureImageUrl,
        hash: di?.hash ?? '',
      }
    }),

    approvals: doc.approvals.map((a) => ({
      approverName: a.approver.name,
      approverRole: a.approver.role,
      status: a.status,
      comment: a.comment,
      decidedAt: a.approvedAt?.toISOString() ?? null,
    })),

    auditEntries: doc.auditLogs.map((e) => ({
      action: e.action,
      userName: e.user.name,
      userRole: e.user.role,
      createdAt: e.createdAt.toISOString(),
      ipAddress: e.ipAddress,
    })),

    stamp: {
      folio: doc.folio,
      approvedAt,
      workArea: doc.workArea,
      companyName: doc.company.name,
      supervisorName: doc.supervisor?.name ?? '—',
      preventionistName: doc.preventionist?.name ?? '—',
      documentStatus: doc.status,
      qrCode,
      documentHash,
    },

    qrDataUrl,
    documentHash,
  }

  // ── Render PDF ─────────────────────────────────────────────────────────────
  const element = buildPdfDocument(pdfData)
  const buffer = await renderToBuffer(element)

  // ── Save ───────────────────────────────────────────────────────────────────
  const pdfUrl = await savePdfBuffer(Buffer.from(buffer), documentId, version)

  // ── Persist URLs + lock ───────────────────────────────────────────────────
  await prisma.document.update({
    where: { id: documentId },
    data: {
      finalPdfUrl: pdfUrl,
      qrCode,
    },
  })

  await log(
    { userId: initiatorId, ip },
    'PDF_GENERATED',
    {
      documentId,
      metadata: { pdfUrl, version, qrCode, documentHash },
    }
  )

  return { pdfUrl, qrCode, documentHash, version }
}

// ── verifyDocument ────────────────────────────────────────────────────────────
/**
 * Looks up a document by its QR code and returns verification data.
 * Called by the public /verify/[code] page.
 */
export async function verifyDocument(qrCode: string) {
  const doc = await prisma.document.findUnique({
    where: { qrCode },
    select: {
      id: true,
      folio: true,
      type: true,
      status: true,
      taskName: true,
      workArea: true,
      finalPdfUrl: true,
      createdAt: true,
      company: { select: { name: true } },
      approvals: {
        where: { status: 'APPROVED' },
        orderBy: { approvedAt: 'desc' },
        take: 1,
        include: { approver: { select: { name: true } } },
      },
    },
  })

  if (!doc) return null

  const approvedAt = doc.approvals[0]?.approvedAt?.toISOString() ?? null

  // Recompute hash to verify tampering
  const expectedHash = approvedAt
    ? createDocumentHash({
        documentId: doc.id,
        folio: doc.folio,
        taskName: doc.taskName,
        workArea: doc.workArea,
        documentType: doc.type,
        approvedAt,
      })
    : null

  return {
    folio: doc.folio,
    status: doc.status,
    taskName: doc.taskName,
    workArea: doc.workArea,
    companyName: doc.company.name,
    approvedAt,
    approvedBy: doc.approvals[0]?.approver?.name ?? null,
    documentHash: expectedHash,
    pdfUrl: doc.finalPdfUrl,
    isValid: doc.status === 'APPROVED',
  }
}
