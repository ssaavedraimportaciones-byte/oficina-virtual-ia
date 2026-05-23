import React from 'react'
import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
  Font,
  type DocumentProps,
} from '@react-pdf/renderer'
import type { PdfDocumentData } from './types'

// Use built-in Helvetica family — no external font files needed
Font.register({
  family: 'Helvetica',
  fonts: [
    { src: 'Helvetica' },
    { src: 'Helvetica-Bold', fontWeight: 700 },
    { src: 'Helvetica-Oblique', fontStyle: 'italic' },
  ],
})

const C = {
  bg: '#0f172a',
  card: '#1e293b',
  border: '#334155',
  amber: '#f59e0b',
  amberLight: '#fef3c7',
  green: '#22c55e',
  greenDark: '#14532d',
  text: '#f8fafc',
  muted: '#94a3b8',
  red: '#ef4444',
  white: '#ffffff',
}

const s = StyleSheet.create({
  page: {
    backgroundColor: C.bg,
    fontFamily: 'Helvetica',
    padding: 36,
    color: C.text,
    fontSize: 9,
  },

  // ── Header ───────────────────────────────────
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
    paddingBottom: 14,
    borderBottom: `1 solid ${C.amber}`,
  },
  headerLeft: { flex: 1 },
  appName: { fontSize: 10, color: C.amber, fontWeight: 700, marginBottom: 2 },
  docTitle: { fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 3 },
  folio: { fontSize: 10, color: C.muted, fontFamily: 'Helvetica' },
  headerRight: { alignItems: 'flex-end' },
  statusBadge: {
    backgroundColor: C.greenDark,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 4,
  },
  statusText: { color: C.green, fontSize: 9, fontWeight: 700 },
  versionText: { color: C.muted, fontSize: 8 },

  // ── Section ──────────────────────────────────
  sectionTitle: {
    fontSize: 8,
    color: C.amber,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 14,
    marginBottom: 6,
    paddingBottom: 3,
    borderBottom: `0.5 solid ${C.border}`,
  },

  // ── Info grid ────────────────────────────────
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  infoCell: {
    width: '48%',
    backgroundColor: C.card,
    borderRadius: 4,
    padding: 8,
    borderLeft: `2 solid ${C.border}`,
  },
  infoCellLabel: { fontSize: 7, color: C.muted, marginBottom: 2 },
  infoCellValue: { fontSize: 9, color: C.text },

  // ── Fields table ─────────────────────────────
  tableRow: {
    flexDirection: 'row',
    borderBottom: `0.5 solid ${C.border}`,
    paddingVertical: 4,
    paddingHorizontal: 6,
    alignItems: 'flex-start',
  },
  tableRowAlt: { backgroundColor: '#1a2744' },
  tableLabel: { width: '35%', color: C.muted, fontSize: 8 },
  tableValue: { flex: 1, color: C.text, fontSize: 9 },
  tableConf: { width: 36, textAlign: 'right', fontSize: 7 },

  // ── Signatures ────────────────────────────────
  sigCard: {
    backgroundColor: C.card,
    borderRadius: 6,
    padding: 10,
    marginBottom: 6,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    border: `0.5 solid ${C.border}`,
  },
  sigImage: { width: 80, height: 32, objectFit: 'contain' },
  sigInfo: { flex: 1 },
  sigName: { fontSize: 9, fontWeight: 700, color: C.text, marginBottom: 2 },
  sigMeta: { fontSize: 7, color: C.muted },
  sigHash: { fontSize: 6, color: '#4a5568', marginTop: 2, fontFamily: 'Helvetica' },

  // ── Approvals ─────────────────────────────────
  approvalRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderBottom: `0.5 solid ${C.border}`,
    alignItems: 'flex-start',
  },
  approvalDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 1,
    flexShrink: 0,
  },
  approvalText: { flex: 1 },
  approvalName: { fontSize: 9, color: C.text },
  approvalMeta: { fontSize: 7, color: C.muted, marginTop: 1 },
  approvalComment: { fontSize: 7, color: '#fbbf24', marginTop: 2, fontStyle: 'italic' },

  // ── Audit ─────────────────────────────────────
  auditRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderBottom: `0.5 solid ${C.border}`,
  },
  auditDate: { width: 90, fontSize: 7, color: C.muted },
  auditAction: { width: 100, fontSize: 7, color: C.text },
  auditUser: { flex: 1, fontSize: 7, color: C.muted },

  // ── Timbre / Stamp ────────────────────────────
  stampOuter: {
    marginTop: 16,
    border: `1.5 solid ${C.amber}`,
    borderRadius: 8,
    overflow: 'hidden',
  },
  stampHeader: {
    backgroundColor: C.amber,
    paddingVertical: 6,
    paddingHorizontal: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stampHeaderText: {
    fontSize: 11,
    fontWeight: 700,
    color: '#000000',
    letterSpacing: 0.5,
  },
  stampBody: {
    backgroundColor: '#0c1929',
    flexDirection: 'row',
    gap: 0,
  },
  stampFields: {
    flex: 1,
    padding: 12,
  },
  stampFieldRow: {
    flexDirection: 'row',
    marginBottom: 4,
    gap: 4,
  },
  stampFieldLabel: { width: 90, fontSize: 7.5, color: C.muted, fontWeight: 700 },
  stampFieldValue: { flex: 1, fontSize: 8, color: C.text },
  stampQrBlock: {
    width: 110,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0c1929',
    borderLeft: `0.5 solid ${C.border}`,
  },
  stampQrImage: { width: 80, height: 80 },
  stampQrLabel: { fontSize: 6, color: C.muted, marginTop: 4, textAlign: 'center' },
  stampHashLine: {
    backgroundColor: '#060f1e',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderTop: `0.5 solid ${C.border}`,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  stampHashLabel: { fontSize: 6.5, color: C.muted, fontWeight: 700 },
  stampHashValue: { fontSize: 6, color: '#4b5563', fontFamily: 'Helvetica' },

  // ── Footer ────────────────────────────────────
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 36,
    right: 36,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTop: `0.5 solid ${C.border}`,
    paddingTop: 6,
  },
  footerText: { fontSize: 6.5, color: C.muted },
})

const APPROVAL_STATUS_COLORS: Record<string, string> = {
  APPROVED: C.green,
  REJECTED: C.red,
  OBSERVED: '#f97316',
  PENDING: '#64748b',
}

const ROLE_LABELS: Record<string, string> = {
  WORKER: 'Trabajador',
  SUPERVISOR: 'Supervisor',
  PREVENTIONIST: 'Prevencionista',
  CONTRACT_ADMIN: 'Admin. Contratos',
  MANAGER: 'Gerente',
  AUDITOR: 'Auditor',
  SYSTEM_ADMIN: 'Administrador',
}

const DOC_TYPE_LABELS: Record<string, string> = {
  SAFETY_TALK: 'Charla de Seguridad',
  DET: 'DET',
  ART: 'ART',
  AST: 'AST',
  WORK_PERMIT: 'Permiso de Trabajo',
  LOTO: 'LOTO',
  HEIGHT_WORK: 'Trabajo en Altura',
  CONFINED_SPACE: 'Espacio Confinado',
  LIFTING_PLAN: 'Plan de Izaje',
  EQUIPMENT_CHECKLIST: 'Checklist de Equipos',
  OTHER: 'Otro',
}

function fmt(isoDate: string): string {
  try {
    return new Date(isoDate).toLocaleDateString('es-CL', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })
  } catch {
    return isoDate
  }
}

function fmtTime(isoDate: string): string {
  try {
    return new Date(isoDate).toLocaleTimeString('es-CL', {
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

function confLabel(c: number | null): string {
  if (c === null) return 'Manual'
  return `${Math.round(c * 100)}%`
}

// ── Document template ─────────────────────────────────────────────────────────

export function buildPdfDocument(data: PdfDocumentData): React.ReactElement<DocumentProps> {
  return (
    <Document
      title={`${data.folio} — ${data.taskName}`}
      author="SafeCheck AI"
      subject={DOC_TYPE_LABELS[data.type] ?? data.type}
      creator="SafeCheck AI v1"
      producer="SafeCheck AI"
    >
      <Page size="A4" style={s.page}>
        {/* ── Header ── */}
        <View style={s.header}>
          <View style={s.headerLeft}>
            <Text style={s.appName}>SafeCheck AI</Text>
            <Text style={s.docTitle}>{DOC_TYPE_LABELS[data.type] ?? data.type}</Text>
            <Text style={s.folio}>{data.taskName}</Text>
          </View>
          <View style={s.headerRight}>
            <View style={s.statusBadge}>
              <Text style={s.statusText}>{data.documentStatus}</Text>
            </View>
            <Text style={s.versionText}>v{data.version} · {data.folio}</Text>
          </View>
        </View>

        {/* ── Document info ── */}
        <Text style={s.sectionTitle}>Información del documento</Text>
        <View style={s.infoGrid}>
          <View style={s.infoCell}>
            <Text style={s.infoCellLabel}>Empresa</Text>
            <Text style={s.infoCellValue}>{data.companyName}</Text>
            <Text style={[s.infoCellLabel, { marginTop: 2 }]}>RUT</Text>
            <Text style={s.infoCellValue}>{data.companyRut}</Text>
          </View>
          <View style={s.infoCell}>
            <Text style={s.infoCellLabel}>Faena / Área</Text>
            <Text style={s.infoCellValue}>{data.workArea}</Text>
          </View>
          <View style={s.infoCell}>
            <Text style={s.infoCellLabel}>Creado por</Text>
            <Text style={s.infoCellValue}>{data.createdByName}</Text>
          </View>
          <View style={s.infoCell}>
            <Text style={s.infoCellLabel}>Supervisor</Text>
            <Text style={s.infoCellValue}>{data.supervisorName || '—'}</Text>
            <Text style={[s.infoCellLabel, { marginTop: 2 }]}>Prevencionista</Text>
            <Text style={s.infoCellValue}>{data.preventionistName || '—'}</Text>
          </View>
          <View style={s.infoCell}>
            <Text style={s.infoCellLabel}>Fecha creación</Text>
            <Text style={s.infoCellValue}>{fmt(data.createdAt)}</Text>
          </View>
          <View style={s.infoCell}>
            <Text style={s.infoCellLabel}>Fecha aprobación</Text>
            <Text style={s.infoCellValue}>{fmt(data.approvedAt)}</Text>
          </View>
        </View>

        {/* ── Extracted fields ── */}
        {data.fields.length > 0 && (
          <>
            <Text style={s.sectionTitle}>Campos del documento</Text>
            <View style={{ border: `0.5 solid ${C.border}`, borderRadius: 4, overflow: 'hidden' }}>
              {data.fields.map((f, i) => (
                <View
                  key={i}
                  style={[s.tableRow, i % 2 === 1 ? s.tableRowAlt : {}]}
                >
                  <Text style={s.tableLabel}>{f.name}</Text>
                  <Text style={s.tableValue}>{f.value ?? '—'}</Text>
                  <Text style={s.tableConf}>{confLabel(f.confidence)}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* ── Signatures ── */}
        {data.signatures.length > 0 && (
          <>
            <Text style={s.sectionTitle}>Firmas ({data.signatures.length})</Text>
            {data.signatures.map((sig, i) => (
              <View key={i} style={s.sigCard}>
                <Image src={sig.imageDataUrl} style={s.sigImage} />
                <View style={s.sigInfo}>
                  <Text style={s.sigName}>{sig.signerName}</Text>
                  <Text style={s.sigMeta}>
                    {ROLE_LABELS[sig.signerRole] ?? sig.signerRole} · {sig.method} · {fmt(sig.signedAt)} {fmtTime(sig.signedAt)}
                  </Text>
                  <Text style={s.sigHash}>SHA-256: {sig.hash}</Text>
                </View>
              </View>
            ))}
          </>
        )}

        {/* ── Approval flow ── */}
        {data.approvals.length > 0 && (
          <>
            <Text style={s.sectionTitle}>Flujo de aprobación</Text>
            <View style={{ border: `0.5 solid ${C.border}`, borderRadius: 4, overflow: 'hidden' }}>
              {data.approvals.map((a, i) => (
                <View key={i} style={s.approvalRow}>
                  <View
                    style={[
                      s.approvalDot,
                      { backgroundColor: APPROVAL_STATUS_COLORS[a.status] ?? C.muted },
                    ]}
                  />
                  <View style={s.approvalText}>
                    <Text style={s.approvalName}>
                      {a.approverName} — {ROLE_LABELS[a.approverRole] ?? a.approverRole}
                    </Text>
                    <Text style={s.approvalMeta}>
                      {a.status}
                      {a.decidedAt ? ` · ${fmt(a.decidedAt)} ${fmtTime(a.decidedAt)}` : ''}
                    </Text>
                    {a.comment && (
                      <Text style={s.approvalComment}>"{a.comment}"</Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        {/* ── Audit trail ── */}
        {data.auditEntries.length > 0 && (
          <>
            <Text style={s.sectionTitle}>Historial de actividad (últimas {data.auditEntries.length} acciones)</Text>
            <View style={{ border: `0.5 solid ${C.border}`, borderRadius: 4, overflow: 'hidden' }}>
              {data.auditEntries.map((e, i) => (
                <View
                  key={i}
                  style={[s.auditRow, i % 2 === 1 ? { backgroundColor: '#1a2744' } : {}]}
                >
                  <Text style={s.auditDate}>{fmt(e.createdAt)} {fmtTime(e.createdAt)}</Text>
                  <Text style={s.auditAction}>{e.action}</Text>
                  <Text style={s.auditUser}>{e.userName} ({ROLE_LABELS[e.userRole] ?? e.userRole})</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* ── Digital stamp / Timbre ── */}
        <View style={s.stampOuter} break>
          <View style={s.stampHeader}>
            <Text style={s.stampHeaderText}>✦ APROBADO PARA EJECUCIÓN</Text>
            <Text style={{ fontSize: 9, color: '#000000' }}>SafeCheck AI</Text>
          </View>

          <View style={s.stampBody}>
            <View style={s.stampFields}>
              {[
                ['Folio', data.stamp.folio],
                ['Fecha', fmt(data.stamp.approvedAt)],
                ['Hora', fmtTime(data.stamp.approvedAt)],
                ['Faena', data.stamp.workArea],
                ['Empresa', data.stamp.companyName],
                ['Supervisor', data.stamp.supervisorName || '—'],
                ['Prevencionista', data.stamp.preventionistName || '—'],
                ['Estado', data.stamp.documentStatus],
              ].map(([label, value]) => (
                <View key={label} style={s.stampFieldRow}>
                  <Text style={s.stampFieldLabel}>{label}:</Text>
                  <Text style={s.stampFieldValue}>{value}</Text>
                </View>
              ))}
            </View>

            <View style={s.stampQrBlock}>
              <Image src={data.qrDataUrl} style={s.stampQrImage} />
              <Text style={s.stampQrLabel}>Escanee para verificar</Text>
            </View>
          </View>

          <View style={s.stampHashLine}>
            <Text style={s.stampHashLabel}>HASH SHA-256:</Text>
            <Text style={s.stampHashValue}>{data.documentHash}</Text>
          </View>
        </View>

        {/* ── Footer ── */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>
            SafeCheck AI · {data.folio} v{data.version} · Generado: {fmt(new Date().toISOString())} {fmtTime(new Date().toISOString())}
          </Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) =>
            `Página ${pageNumber} de ${totalPages}`
          } />
        </View>
      </Page>

      {/* ── Certificado Legal — Ley 19.799 ─────────────────────────────── */}
      <Page size="A4" style={{ ...s.page, justifyContent: 'flex-start' }}>
        {/* Certificate header */}
        <View style={{ borderBottom: `2 solid ${C.amber}`, paddingBottom: 14, marginBottom: 18 }}>
          <Text style={{ fontSize: 7, color: C.amber, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
            SafeCheck AI — Certificado de Firma Electrónica Simple
          </Text>
          <Text style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 4 }}>
            Certificado de Autenticidad e Integridad
          </Text>
          <Text style={{ fontSize: 8, color: C.muted }}>
            Ley Nº 19.799 sobre Documentos Electrónicos, Firma Electrónica y Servicios de Certificación
          </Text>
        </View>

        {/* Legal body */}
        <View style={{ backgroundColor: C.card, borderRadius: 6, padding: 14, marginBottom: 14, border: `0.5 solid ${C.border}` }}>
          <Text style={{ fontSize: 9, color: C.text, lineHeight: 1.6, marginBottom: 10 }}>
            El presente documento ha sido generado, suscrito y almacenado a través de la plataforma
            SafeCheck AI, que implementa mecanismos de firma electrónica simple conforme a lo
            establecido en la Ley N° 19.799 (D.O. 25.03.2002) y su Reglamento (D.S. N° 181/2002
            del Ministerio de Economía).
          </Text>
          <Text style={{ fontSize: 9, color: C.text, lineHeight: 1.6 }}>
            Cada firma registrada en este documento incluye: (a) imagen capturada en dispositivo del
            firmante, (b) identidad verificada mediante autenticación activa en la plataforma, (c)
            dirección IP y User-Agent del dispositivo firmante, (d) coordenadas GPS cuando disponibles,
            (e) marca de tiempo del servidor, y (f) hash SHA-256 del registro. Estos elementos
            constituyen una firma electrónica simple según el Art. 2° letra f) de la citada ley.
          </Text>
        </View>

        {/* Document identity */}
        <Text style={{ fontSize: 8, color: C.amber, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 }}>
          Identificación del Documento
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
          {[
            ['Folio', data.folio],
            ['Tipo', DOC_TYPE_LABELS[data.type] ?? data.type],
            ['Empresa', `${data.companyName} · RUT ${data.companyRut}`],
            ['Faena / Área', data.workArea],
            ['Creado por', data.createdByName],
            ['Supervisor', data.supervisorName],
            ['Prevencionista', data.preventionistName],
            ['Fecha creación', fmt(data.createdAt)],
            ['Fecha aprobación', fmt(data.approvedAt)],
            ['Estado', data.documentStatus],
            ['Versión PDF', `v${data.version}`],
          ].map(([label, value]) => (
            <View key={label} style={{ width: '48%', backgroundColor: '#1a2744', borderRadius: 4, padding: 7, borderLeft: `2 solid ${C.border}` }}>
              <Text style={{ fontSize: 7, color: C.muted, marginBottom: 1 }}>{label}</Text>
              <Text style={{ fontSize: 8, color: C.text }}>{value ?? '—'}</Text>
            </View>
          ))}
        </View>

        {/* Integrity hash */}
        <Text style={{ fontSize: 8, color: C.amber, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 }}>
          Integridad del Documento
        </Text>
        <View style={{ backgroundColor: '#0a1628', borderRadius: 4, padding: 10, marginBottom: 14, border: `0.5 solid ${C.border}` }}>
          <Text style={{ fontSize: 7, color: C.muted, marginBottom: 3 }}>Hash SHA-256 del documento (folio + contenido + fecha aprobación)</Text>
          <Text style={{ fontSize: 7, color: '#34d399', fontFamily: 'Helvetica', letterSpacing: 0.3 }}>{data.documentHash}</Text>
        </View>

        {/* Signers summary */}
        {data.signatures.length > 0 && (
          <>
            <Text style={{ fontSize: 8, color: C.amber, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 }}>
              Firmantes ({data.signatures.length})
            </Text>
            {data.signatures.map((sig, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: 8, paddingVertical: 5, borderBottom: `0.5 solid ${C.border}`, alignItems: 'flex-start' }}>
                <View style={{ width: 16, height: 16, backgroundColor: C.greenDark, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 8, color: C.green, fontWeight: 700 }}>{i + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 8, color: C.text, fontWeight: 700 }}>{sig.signerName}</Text>
                  <Text style={{ fontSize: 7, color: C.muted }}>{ROLE_LABELS[sig.signerRole] ?? sig.signerRole} · {sig.method} · {fmt(sig.signedAt)} {fmtTime(sig.signedAt)}</Text>
                  <Text style={{ fontSize: 6, color: '#4a5568', marginTop: 1 }}>Hash: {sig.hash}</Text>
                </View>
              </View>
            ))}
            <View style={{ marginBottom: 14 }} />
          </>
        )}

        {/* Verification QR */}
        <View style={{ flexDirection: 'row', gap: 14, alignItems: 'flex-start', marginBottom: 14 }}>
          {data.qrDataUrl && (
            <Image src={data.qrDataUrl} style={{ width: 64, height: 64 }} />
          )}
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 8, color: C.amber, fontWeight: 700, marginBottom: 4 }}>Verificación independiente</Text>
            <Text style={{ fontSize: 7.5, color: C.text, lineHeight: 1.5 }}>
              Este documento puede verificarse de forma independiente accediendo al código QR adyacente
              o ingresando el código {data.stamp.qrCode} en el sistema SafeCheck AI. La verificación
              compara el hash del documento con el registro de la base de datos para detectar cualquier
              alteración posterior a la aprobación.
            </Text>
          </View>
        </View>

        {/* Legal footer */}
        <View style={{ borderTop: `0.5 solid ${C.border}`, paddingTop: 10, marginTop: 'auto' }}>
          <Text style={{ fontSize: 6.5, color: C.muted, lineHeight: 1.5, textAlign: 'center' }}>
            Documento generado automáticamente por SafeCheck AI · Firma Electrónica Simple · Ley N° 19.799 Chile
            {'\n'}
            Este certificado no reemplaza la firma electrónica avanzada (FEA) requerida para actos y contratos
            que exijan escritura pública. Para actos de prevención de riesgos laborales regidos por la Ley N° 16.744
            y sus reglamentos, la firma electrónica simple tiene plena validez legal.
            {'\n'}
            Generado: {fmt(new Date().toISOString())} {fmtTime(new Date().toISOString())} · SafeCheck AI v{data.version}
          </Text>
        </View>
      </Page>
    </Document>
  )
}
