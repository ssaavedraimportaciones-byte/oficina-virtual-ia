import {
  PrismaClient,
  UserRole,
  CompanyType,
  DocumentType,
  DocumentStatus,
  Criticality,
} from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Iniciando seed SafeCheck AI...')

  // ─── Empresas ──────────────────────────────────────────────────
  const mandante = await prisma.company.upsert({
    where: { rut: '76.000.001-0' },
    update: {},
    create: {
      name: 'Minera Los Andes S.A.',
      rut: '76.000.001-0',
      type: CompanyType.MANDANTE,
    },
  })

  const contratista = await prisma.company.upsert({
    where: { rut: '76.000.002-1' },
    update: {},
    create: {
      name: 'Construcciones Mineras XYZ Ltda.',
      rut: '76.000.002-1',
      type: CompanyType.CONTRATISTA,
    },
  })

  const subcontratista = await prisma.company.upsert({
    where: { rut: '76.000.003-2' },
    update: {},
    create: {
      name: 'Servicios Eléctricos ABC SpA',
      rut: '76.000.003-2',
      type: CompanyType.SUBCONTRATISTA,
    },
  })

  console.log('  ✓ Empresas:', [mandante.name, contratista.name, subcontratista.name].join(', '))

  // ─── Usuarios ──────────────────────────────────────────────────
  // contraseña para todos: SafeCheck2026!
  const passwordHash = await bcrypt.hash('SafeCheck2026!', 12)

  const admin = await prisma.user.upsert({
    where: { email: 'admin@safecheck.app' },
    update: {},
    create: {
      name: 'Admin SafeCheck',
      rut: '12.345.678-9',
      email: 'admin@safecheck.app',
      phone: '+56912345678',
      role: UserRole.SYSTEM_ADMIN,
      companyId: mandante.id,
      passwordHash,
    },
  })

  const manager = await prisma.user.upsert({
    where: { email: 'gerente@safecheck.app' },
    update: {},
    create: {
      name: 'Roberto Fuentes',
      rut: '9.999.999-9',
      email: 'gerente@safecheck.app',
      phone: '+56999999999',
      role: UserRole.MANAGER,
      companyId: mandante.id,
      passwordHash,
    },
  })

  const preventionist = await prisma.user.upsert({
    where: { email: 'prevencionista@safecheck.app' },
    update: {},
    create: {
      name: 'María González',
      rut: '22.222.222-2',
      email: 'prevencionista@safecheck.app',
      phone: '+56922222222',
      role: UserRole.PREVENTIONIST,
      companyId: mandante.id,
      passwordHash,
    },
  })

  const supervisor = await prisma.user.upsert({
    where: { email: 'supervisor@safecheck.app' },
    update: {},
    create: {
      name: 'Carlos Rojas',
      rut: '11.111.111-1',
      email: 'supervisor@safecheck.app',
      phone: '+56911111111',
      role: UserRole.SUPERVISOR,
      companyId: contratista.id,
      passwordHash,
    },
  })

  const contractAdmin = await prisma.user.upsert({
    where: { email: 'admin.contrato@safecheck.app' },
    update: {},
    create: {
      name: 'Lucía Morales',
      rut: '88.888.888-8',
      email: 'admin.contrato@safecheck.app',
      phone: '+56988888888',
      role: UserRole.CONTRACT_ADMIN,
      companyId: contratista.id,
      passwordHash,
    },
  })

  const workerUser = await prisma.user.upsert({
    where: { email: 'trabajador@safecheck.app' },
    update: {},
    create: {
      name: 'Juan Pérez',
      rut: '33.333.333-3',
      email: 'trabajador@safecheck.app',
      phone: '+56933333333',
      role: UserRole.WORKER,
      companyId: contratista.id,
      passwordHash,
    },
  })

  const auditor = await prisma.user.upsert({
    where: { email: 'auditor@safecheck.app' },
    update: {},
    create: {
      name: 'Fernando Audit',
      rut: '77.777.777-7',
      email: 'auditor@safecheck.app',
      phone: '+56977777777',
      role: UserRole.AUDITOR,
      companyId: mandante.id,
      passwordHash,
    },
  })

  console.log('  ✓ Usuarios (contraseña: SafeCheck2026!):')
  console.log('      admin@safecheck.app          → SYSTEM_ADMIN')
  console.log('      gerente@safecheck.app        → MANAGER')
  console.log('      prevencionista@safecheck.app → PREVENTIONIST')
  console.log('      supervisor@safecheck.app     → SUPERVISOR')
  console.log('      admin.contrato@safecheck.app → CONTRACT_ADMIN')
  console.log('      trabajador@safecheck.app     → WORKER')
  console.log('      auditor@safecheck.app        → AUDITOR')

  // ─── Trabajadores de campo ─────────────────────────────────────
  await prisma.worker.upsert({
    where: { rut: '44.444.444-4' },
    update: {},
    create: {
      name: 'Pedro Soto',
      rut: '44.444.444-4',
      companyId: contratista.id,
      position: 'Operador de Equipos Pesados',
      certifications: ['Trabajo en Altura', 'LOTO', 'Izaje de Cargas'],
    },
  })

  await prisma.worker.upsert({
    where: { rut: '55.555.555-5' },
    update: {},
    create: {
      name: 'Ana Martínez',
      rut: '55.555.555-5',
      companyId: contratista.id,
      position: 'Técnico de Mantención Eléctrica',
      certifications: ['LOTO', 'Espacio Confinado', 'Trabajo en Altura'],
    },
  })

  await prisma.worker.upsert({
    where: { rut: '66.666.666-6' },
    update: {},
    create: {
      name: 'Diego Vásquez',
      rut: '66.666.666-6',
      companyId: subcontratista.id,
      position: 'Electricista Industrial',
      certifications: ['LOTO', 'AT/BT'],
    },
  })

  console.log('  ✓ Trabajadores de campo: Pedro Soto, Ana Martínez, Diego Vásquez')

  // ─── Documento ART ────────────────────────────────────────────
  const docArt = await prisma.document.upsert({
    where: { folio: 'SC-2026-000001' },
    update: {},
    create: {
      folio: 'SC-2026-000001',
      type: DocumentType.ART,
      status: DocumentStatus.DRAFT,
      companyId: contratista.id,
      workArea: 'Nivel 3 — Sector Norte',
      taskName: 'Cambio de bomba hidráulica HP-301',
      supervisorId: supervisor.id,
      preventionistId: preventionist.id,
      createdById: workerUser.id,
    },
  })

  const artFieldsExist = await prisma.documentField.count({ where: { documentId: docArt.id } })
  if (artFieldsExist === 0) {
    await prisma.documentField.createMany({
      data: [
        { documentId: docArt.id, fieldName: 'tarea', fieldValue: 'Cambio de bomba hidráulica HP-301', isRequired: true, isValid: true, confidence: 1.0 },
        { documentId: docArt.id, fieldName: 'lugar', fieldValue: 'Nivel 3 — Sector Norte', isRequired: true, isValid: true, confidence: 1.0 },
        { documentId: docArt.id, fieldName: 'empresa', fieldValue: 'Construcciones Mineras XYZ Ltda.', isRequired: true, isValid: true, confidence: 1.0 },
        { documentId: docArt.id, fieldName: 'fecha', fieldValue: '2026-05-21', isRequired: true, isValid: true, confidence: 1.0 },
        { documentId: docArt.id, fieldName: 'responsable', fieldValue: 'Carlos Rojas', isRequired: true, isValid: true, confidence: 1.0 },
        { documentId: docArt.id, fieldName: 'pasos', fieldValue: null, isRequired: true, isValid: false, confidence: null },
        { documentId: docArt.id, fieldName: 'epp_requerido', fieldValue: 'Casco, guantes de nitrilo, gafas, delantal', isRequired: true, isValid: true, confidence: 0.94 },
      ],
    })
  }

  const artRisksExist = await prisma.riskControl.count({ where: { documentId: docArt.id } })
  if (artRisksExist === 0) {
    await prisma.riskControl.createMany({
      data: [
        {
          documentId: docArt.id,
          risk: 'Caída al mismo nivel por derrame de aceite hidráulico',
          control: 'Señalización, delimitación con conos y uso de absorbentes industriales.',
          criticality: Criticality.HIGH,
          isValidated: false,
        },
        {
          documentId: docArt.id,
          risk: 'Atrapamiento en partes móviles de la bomba',
          control: 'Aplicación de LOTO completo antes del inicio. Verificar energía cero.',
          criticality: Criticality.CRITICAL,
          isValidated: false,
        },
        {
          documentId: docArt.id,
          risk: 'Proyección de fluido hidráulico a presión',
          control: 'Despresurizar el sistema antes de desconectar. EPP completo.',
          criticality: Criticality.HIGH,
          isValidated: false,
        },
        {
          documentId: docArt.id,
          risk: 'Sobreesfuerzo al manipular la bomba (85 kg)',
          control: 'Uso de tecle certificado. Mínimo 2 personas. No levantar manualmente.',
          criticality: Criticality.MEDIUM,
          isValidated: false,
        },
      ],
    })
  }

  // ─── Documento SAFETY_TALK aprobado ──────────────────────────
  const docCharla = await prisma.document.upsert({
    where: { folio: 'SC-2026-000002' },
    update: {},
    create: {
      folio: 'SC-2026-000002',
      type: DocumentType.SAFETY_TALK,
      status: DocumentStatus.APPROVED,
      companyId: mandante.id,
      workArea: 'Sala de Reuniones — Administración',
      taskName: 'Charla: Uso correcto de EPP en altura',
      supervisorId: supervisor.id,
      preventionistId: preventionist.id,
      createdById: preventionist.id,
    },
  })

  const charlaFieldsExist = await prisma.documentField.count({ where: { documentId: docCharla.id } })
  if (charlaFieldsExist === 0) {
    await prisma.documentField.createMany({
      data: [
        { documentId: docCharla.id, fieldName: 'tema', fieldValue: 'Uso correcto de EPP en trabajo en altura', isRequired: true, isValid: true, confidence: 1.0 },
        { documentId: docCharla.id, fieldName: 'orador', fieldValue: 'María González', isRequired: true, isValid: true, confidence: 1.0 },
        { documentId: docCharla.id, fieldName: 'duracion_minutos', fieldValue: '20', isRequired: true, isValid: true, confidence: 1.0 },
        { documentId: docCharla.id, fieldName: 'fecha', fieldValue: '2026-05-21', isRequired: true, isValid: true, confidence: 1.0 },
        { documentId: docCharla.id, fieldName: 'lugar', fieldValue: 'Sala de Reuniones — Administración', isRequired: true, isValid: true, confidence: 1.0 },
      ],
    })
  }

  // Approval para la charla
  const charlaApprovalExists = await prisma.approval.count({ where: { documentId: docCharla.id } })
  if (charlaApprovalExists === 0) {
    await prisma.approval.create({
      data: {
        documentId: docCharla.id,
        approverId: preventionist.id,
        role: UserRole.PREVENTIONIST,
        status: 'APPROVED',
        comment: 'Charla completa y bien documentada.',
        approvedAt: new Date(),
      },
    })
  }

  // ─── Audit logs ──────────────────────────────────────────────
  await prisma.auditLog.createMany({
    data: [
      {
        documentId: docArt.id,
        userId: workerUser.id,
        action: 'CREATE',
        metadata: { folio: 'SC-2026-000001', type: 'ART' },
        ipAddress: '192.168.1.100',
      },
      {
        documentId: docCharla.id,
        userId: preventionist.id,
        action: 'CREATE',
        metadata: { folio: 'SC-2026-000002', type: 'SAFETY_TALK' },
        ipAddress: '192.168.1.101',
      },
      {
        documentId: docCharla.id,
        userId: preventionist.id,
        action: 'APPROVE',
        metadata: { folio: 'SC-2026-000002', comment: 'Charla completa y bien documentada.' },
        ipAddress: '192.168.1.101',
      },
    ],
  })

  // ─── Notificaciones pendientes ────────────────────────────────
  const notifExists = await prisma.notification.count({ where: { documentId: docArt.id } })
  if (notifExists === 0) {
    await prisma.notification.createMany({
      data: [
        {
          documentId: docArt.id,
          recipientId: supervisor.id,
          channel: 'IN_APP',
          status: 'PENDING',
          message: 'Documento SC-2026-000001 (ART) requiere su revisión antes de pasar a firma.',
        },
        {
          documentId: docArt.id,
          recipientId: preventionist.id,
          channel: 'EMAIL',
          status: 'PENDING',
          message: 'Nuevo ART creado por Juan Pérez requiere validación de prevencionista.',
        },
      ],
    })
  }

  console.log('  ✓ Documentos: SC-2026-000001 (ART/DRAFT), SC-2026-000002 (SAFETY_TALK/APPROVED)')
  console.log('  ✓ Audit logs y notificaciones de ejemplo')
  console.log('\n✅ Seed completado')
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error('❌ Error en seed:', e)
    await prisma.$disconnect()
    process.exit(1)
  })
