export interface PdfSignature {
  signerName: string
  signerRole: string
  method: string
  signedAt: string
  imageDataUrl: string
  hash: string
}

export interface PdfAuditEntry {
  action: string
  userName: string
  userRole: string
  createdAt: string
  ipAddress: string | null
}

export interface PdfApproval {
  approverName: string
  approverRole: string
  status: string
  comment: string | null
  decidedAt: string | null
}

export interface PdfStamp {
  folio: string
  approvedAt: string
  workArea: string
  companyName: string
  supervisorName: string
  preventionistName: string
  documentStatus: string
  qrCode: string
  documentHash: string
}

export interface PdfDocumentData {
  id: string
  folio: string
  type: string
  taskName: string
  workArea: string
  companyName: string
  companyRut: string
  createdByName: string
  supervisorName: string
  preventionistName: string
  createdAt: string
  approvedAt: string
  documentStatus: string
  fields: Array<{ name: string; value: string | null; confidence: number | null }>
  signatures: PdfSignature[]
  approvals: PdfApproval[]
  auditEntries: PdfAuditEntry[]
  stamp: PdfStamp
  qrDataUrl: string
  documentHash: string
  version: number
}

export interface GeneratePdfResult {
  pdfUrl: string
  qrCode: string
  documentHash: string
  version: number
}
