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
  console.log('🌱 Iniciando seed SafeCheck AI — Piloto Industrial...')

  // ─── Contraseña universal demo (nunca usar en producción real) ────────────
  const passwordHash = await bcrypt.hash('SafeCheck2026!', 12)

  // ═══════════════════════════════════════════════════════════════════════════
  // EMPRESAS — Contexto minero Chile
  // ═══════════════════════════════════════════════════════════════════════════

  const codelco = await prisma.company.upsert({
    where: { rut: '61.704.000-k' },
    update: {},
    create: {
      name: 'Codelco — División El Teniente',
      rut: '61.704.000-k',
      type: CompanyType.MANDANTE,
    },
  })

  const bhp = await prisma.company.upsert({
    where: { rut: '76.100.001-1' },
    update: {},
    create: {
      name: 'BHP Minerals Chile SpA',
      rut: '76.100.001-1',
      type: CompanyType.MANDANTE,
    },
  })

  const contratistaMant = await prisma.company.upsert({
    where: { rut: '76.200.001-2' },
    update: {},
    create: {
      name: 'Mantención Industrial Andes Ltda.',
      rut: '76.200.001-2',
      type: CompanyType.CONTRATISTA,
    },
  })

  const contratistaElec = await prisma.company.upsert({
    where: { rut: '76.200.002-0' },
    update: {},
    create: {
      name: 'Servicios Eléctricos del Norte SpA',
      rut: '76.200.002-0',
      type: CompanyType.CONTRATISTA,
    },
  })

  const subcontratista = await prisma.company.upsert({
    where: { rut: '76.300.001-5' },
    update: {},
    create: {
      name: 'Andina Grúas y Izaje Ltda.',
      rut: '76.300.001-5',
      type: CompanyType.SUBCONTRATISTA,
    },
  })

  console.log('  ✓ Empresas: Codelco, BHP, Mantención Andes, Servicios Eléctricos, Andina Grúas')

  // ═══════════════════════════════════════════════════════════════════════════
  // USUARIOS
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Sistema ───────────────────────────────────────────────────────────────
  const sysAdmin = await prisma.user.upsert({
    where: { email: 'admin@safecheck.app' },
    update: {},
    create: {
      name: 'Administrador SafeCheck',
      rut: '12.345.678-9',
      email: 'admin@safecheck.app',
      phone: '+56912345678',
      role: UserRole.SYSTEM_ADMIN,
      companyId: codelco.id,
      passwordHash,
    },
  })

  // ── Codelco — Mandante ────────────────────────────────────────────────────
  const gerenteCodelco = await prisma.user.upsert({
    where: { email: 'gerente.ssoma@codelco-teniente.cl' },
    update: {},
    create: {
      name: 'Rodrigo Vargas Espinoza',
      rut: '9.876.543-2',
      email: 'gerente.ssoma@codelco-teniente.cl',
      phone: '+56998765432',
      role: UserRole.MANAGER,
      companyId: codelco.id,
      passwordHash,
    },
  })

  const prevencionCodelco = await prisma.user.upsert({
    where: { email: 'prevencion@codelco-teniente.cl' },
    update: {},
    create: {
      name: 'Claudia Herrera Medina',
      rut: '14.200.300-4',
      email: 'prevencion@codelco-teniente.cl',
      phone: '+56914200300',
      role: UserRole.PREVENTIONIST,
      companyId: codelco.id,
      passwordHash,
    },
  })

  const auditorCodelco = await prisma.user.upsert({
    where: { email: 'auditoria@codelco-teniente.cl' },
    update: {},
    create: {
      name: 'Patricio Morales Leal',
      rut: '11.500.700-8',
      email: 'auditoria@codelco-teniente.cl',
      phone: '+56911500700',
      role: UserRole.AUDITOR,
      companyId: codelco.id,
      passwordHash,
    },
  })

  // ── Mantención Industrial Andes — Contratista ─────────────────────────────
  const adminContrato = await prisma.user.upsert({
    where: { email: 'admin@mant-andes.cl' },
    update: {},
    create: {
      name: 'Francesca Olivares Riquelme',
      rut: '16.700.400-3',
      email: 'admin@mant-andes.cl',
      phone: '+56916700400',
      role: UserRole.CONTRACT_ADMIN,
      companyId: contratistaMant.id,
      passwordHash,
    },
  })

  const supervisorMant = await prisma.user.upsert({
    where: { email: 'supervisor.mecanico@mant-andes.cl' },
    update: {},
    create: {
      name: 'Eduardo Castillo Pérez',
      rut: '13.800.500-7',
      email: 'supervisor.mecanico@mant-andes.cl',
      phone: '+56913800500',
      role: UserRole.SUPERVISOR,
      companyId: contratistaMant.id,
      passwordHash,
    },
  })

  const prevencionMant = await prisma.user.upsert({
    where: { email: 'prevencion@mant-andes.cl' },
    update: {},
    create: {
      name: 'Marcela Rojas Contreras',
      rut: '15.300.200-6',
      email: 'prevencion@mant-andes.cl',
      phone: '+56915300200',
      role: UserRole.PREVENTIONIST,
      companyId: contratistaMant.id,
      passwordHash,
    },
  })

  const trabajador1 = await prisma.user.upsert({
    where: { email: 'juan.perez@mant-andes.cl' },
    update: {},
    create: {
      name: 'Juan Pérez Soto',
      rut: '17.100.600-1',
      email: 'juan.perez@mant-andes.cl',
      phone: '+56917100600',
      role: UserRole.WORKER,
      companyId: contratistaMant.id,
      passwordHash,
    },
  })

  const trabajador2 = await prisma.user.upsert({
    where: { email: 'trabajador@safecheck.app' },
    update: {},
    create: {
      name: 'Pedro González Díaz',
      rut: '18.200.700-2',
      email: 'trabajador@safecheck.app',
      phone: '+56918200700',
      role: UserRole.WORKER,
      companyId: contratistaMant.id,
      passwordHash,
    },
  })

  // ── BHP — Mandante ────────────────────────────────────────────────────────
  const supervisorBhp = await prisma.user.upsert({
    where: { email: 'supervisor@bhp-chile.cl' },
    update: {},
    create: {
      name: 'Ricardo Núñez Araya',
      rut: '10.400.800-5',
      email: 'supervisor@bhp-chile.cl',
      phone: '+56910400800',
      role: UserRole.SUPERVISOR,
      companyId: bhp.id,
      passwordHash,
    },
  })

  // ── Servicios Eléctricos — Contratista ────────────────────────────────────
  const supervisorElec = await prisma.user.upsert({
    where: { email: 'supervisor@servelec-norte.cl' },
    update: {},
    create: {
      name: 'Gonzalo Reyes Fuentes',
      rut: '12.600.900-0',
      email: 'supervisor@servelec-norte.cl',
      phone: '+56912600900',
      role: UserRole.SUPERVISOR,
      companyId: contratistaElec.id,
      passwordHash,
    },
  })

  console.log('  ✓ Usuarios creados (contraseña: SafeCheck2026!):')
  console.log('      admin@safecheck.app                    → SYSTEM_ADMIN')
  console.log('      gerente.ssoma@codelco-teniente.cl      → MANAGER')
  console.log('      prevencion@codelco-teniente.cl         → PREVENTIONIST')
  console.log('      auditoria@codelco-teniente.cl          → AUDITOR')
  console.log('      admin@mant-andes.cl                    → CONTRACT_ADMIN')
  console.log('      supervisor.mecanico@mant-andes.cl      → SUPERVISOR')
  console.log('      prevencion@mant-andes.cl               → PREVENTIONIST')
  console.log('      juan.perez@mant-andes.cl               → WORKER')
  console.log('      trabajador@safecheck.app               → WORKER')
  console.log('      supervisor@bhp-chile.cl                → SUPERVISOR')
  console.log('      supervisor@servelec-norte.cl           → SUPERVISOR')

  // ═══════════════════════════════════════════════════════════════════════════
  // TRABAJADORES DE CAMPO
  // ═══════════════════════════════════════════════════════════════════════════

  const workers = [
    {
      rut: '19.100.001-3',
      name: 'Luis Alberto Campos Reyes',
      companyId: contratistaMant.id,
      position: 'Mecánico Industrial Senior',
      certifications: ['Trabajo en Altura', 'LOTO/LOTA', 'Izaje de Cargas', 'Espacios Confinados'],
    },
    {
      rut: '19.200.002-1',
      name: 'Cristóbal Muñoz Álvarez',
      companyId: contratistaMant.id,
      position: 'Operador de Equipos Pesados CAT 793',
      certifications: ['Operador CAT 793F', 'LOTO/LOTA', 'Trabajo en Altura'],
    },
    {
      rut: '19.300.003-k',
      name: 'Valentina Torres Ibarra',
      companyId: contratistaMant.id,
      position: 'Técnico en Mantención Mecánica',
      certifications: ['LOTO/LOTA', 'Trabajo en Altura', 'Izaje de Cargas'],
    },
    {
      rut: '19.400.004-8',
      name: 'Héctor Jara Bustamante',
      companyId: contratistaElec.id,
      position: 'Electricista Industrial AT/BT',
      certifications: ['Instalaciones AT/BT', 'LOTO/LOTA', 'Trabajo en Altura', 'Maniobras en Caliente'],
    },
    {
      rut: '19.500.005-6',
      name: 'Sebastián Figueroa Mora',
      companyId: contratistaElec.id,
      position: 'Técnico Instrumentista',
      certifications: ['Instrumentación Industrial', 'LOTO/LOTA', 'Espacios Confinados'],
    },
    {
      rut: '19.600.006-4',
      name: 'Marco Vásquez Poblete',
      companyId: subcontratista.id,
      position: 'Operador de Grúa Horquilla',
      certifications: ['Operador Grúa Horquilla', 'Izaje de Cargas Críticas', 'LOTO/LOTA'],
    },
    {
      rut: '19.700.007-2',
      name: 'Andrés Lazo Sánchez',
      companyId: subcontratista.id,
      position: 'Rigger Especialista',
      certifications: ['Rigger Nivel III', 'Izaje de Cargas Críticas', 'Trabajo en Altura'],
    },
    {
      rut: '19.800.008-0',
      name: 'Carolina Ahumada Vera',
      companyId: contratistaMant.id,
      position: 'Prevencionista de Terreno',
      certifications: ['Prevención de Riesgos', 'Primeros Auxilios', 'Evacuación de Emergencias'],
    },
  ]

  for (const w of workers) {
    await prisma.worker.upsert({
      where: { rut: w.rut },
      update: {},
      create: w,
    })
  }

  console.log(`  ✓ ${workers.length} trabajadores de campo registrados`)

  // ═══════════════════════════════════════════════════════════════════════════
  // DOCUMENTOS DEMO — casos reales minería
  // ═══════════════════════════════════════════════════════════════════════════

  // ── DOC 1: ART Cambio de Bomba (PENDING_APPROVAL) ─────────────────────────
  const docArt = await prisma.document.upsert({
    where: { folio: 'SC-2026-000001' },
    update: {},
    create: {
      folio: 'SC-2026-000001',
      type: DocumentType.ART,
      status: DocumentStatus.PENDING_APPROVAL,
      companyId: contratistaMant.id,
      workArea: 'Planta Concentradora — Sector Molienda SAG',
      taskName: 'Cambio de bomba de lubricación molino SAG-01',
      supervisorId: supervisorMant.id,
      preventionistId: prevencionMant.id,
      createdById: trabajador1.id,
      geofenceLat: -34.183,
      geofenceLng: -70.650,
      geofenceRadiusMeters: 200,
    },
  })

  const artFieldsExist = await prisma.documentField.count({ where: { documentId: docArt.id } })
  if (artFieldsExist === 0) {
    await prisma.documentField.createMany({
      data: [
        { documentId: docArt.id, fieldName: 'tarea', fieldValue: 'Cambio de bomba de lubricación molino SAG-01', isRequired: true, isValid: true, confidence: 0.97 },
        { documentId: docArt.id, fieldName: 'lugar', fieldValue: 'Planta Concentradora — Sector Molienda SAG', isRequired: true, isValid: true, confidence: 0.95 },
        { documentId: docArt.id, fieldName: 'empresa_contratista', fieldValue: 'Mantención Industrial Andes Ltda.', isRequired: true, isValid: true, confidence: 0.99 },
        { documentId: docArt.id, fieldName: 'empresa_mandante', fieldValue: 'Codelco — División El Teniente', isRequired: true, isValid: true, confidence: 0.99 },
        { documentId: docArt.id, fieldName: 'fecha_inicio', fieldValue: '2026-05-26 08:00', isRequired: true, isValid: true, confidence: 0.98 },
        { documentId: docArt.id, fieldName: 'fecha_termino_estimado', fieldValue: '2026-05-26 16:00', isRequired: true, isValid: true, confidence: 0.96 },
        { documentId: docArt.id, fieldName: 'responsable_tarea', fieldValue: 'Eduardo Castillo Pérez', isRequired: true, isValid: true, confidence: 0.98 },
        { documentId: docArt.id, fieldName: 'n_trabajadores', fieldValue: '4', isRequired: true, isValid: true, confidence: 0.99 },
        { documentId: docArt.id, fieldName: 'epp_requerido', fieldValue: 'Casco dieléctrico, guantes de nitrilo, antiparras, calzado de seguridad, chaleco reflectante, arnes si requiere', isRequired: true, isValid: true, confidence: 0.93 },
        { documentId: docArt.id, fieldName: 'herramientas', fieldValue: 'Llave torquímetro 0-300 Nm, extractor hidráulico, tecle 2 ton certificado', isRequired: true, isValid: true, confidence: 0.91 },
      ],
    })
  }

  const artRisksExist = await prisma.riskControl.count({ where: { documentId: docArt.id } })
  if (artRisksExist === 0) {
    await prisma.riskControl.createMany({
      data: [
        { documentId: docArt.id, risk: 'Atrapamiento en partes móviles del molino SAG durante intervención', control: 'Aplicar LOTO completo con candado personal — verificar energía cero antes de ingresar. Bloquear 7 puntos de energía.', criticality: Criticality.CRITICAL, isValidated: true },
        { documentId: docArt.id, risk: 'Derrame de aceite lubricante (aprox. 80 litros) — incendio o caída al mismo nivel', control: 'Instalar cubeta de contención 200L. Tener extintor CO2 a 5m. Señalizar y delimitar área. Absorbentes industriales disponibles.', criticality: Criticality.HIGH, isValidated: true },
        { documentId: docArt.id, risk: 'Proyección de aceite a presión al desconectar mangueras', control: 'Despresurizar sistema hidráulico completamente. Usar antiparras. EPP anticorte en manos.', criticality: Criticality.HIGH, isValidated: true },
        { documentId: docArt.id, risk: 'Sobreesfuerzo y lesión musculoesquelética al manipular bomba (95 kg)', control: 'Usar tecle certificado 2 ton. Mínimo 4 personas para maniobra. Prohibido levantar manualmente sobre 25 kg por persona.', criticality: Criticality.MEDIUM, isValidated: true },
        { documentId: docArt.id, risk: 'Caída a distinto nivel en plataforma de trabajo (+1.8m)', control: 'Uso obligatorio de arnés con doble eslinga y absorbedor de impacto. Verificar anclaje certificado >2200 kg.', criticality: Criticality.HIGH, isValidated: false },
      ],
    })
  }

  // ── DOC 2: SAFETY_TALK Charla Riesgo Eléctrico (APPROVED) ────────────────
  const docCharla = await prisma.document.upsert({
    where: { folio: 'SC-2026-000002' },
    update: {},
    create: {
      folio: 'SC-2026-000002',
      type: DocumentType.SAFETY_TALK,
      status: DocumentStatus.APPROVED,
      companyId: codelco.id,
      workArea: 'Sala de Capacitación — Administración Mina',
      taskName: 'Charla 5 minutos: Riesgo eléctrico en operación de equipos de alta tensión',
      supervisorId: supervisorMant.id,
      preventionistId: prevencionCodelco.id,
      createdById: prevencionCodelco.id,
    },
  })

  const charlaFieldsExist = await prisma.documentField.count({ where: { documentId: docCharla.id } })
  if (charlaFieldsExist === 0) {
    await prisma.documentField.createMany({
      data: [
        { documentId: docCharla.id, fieldName: 'tema', fieldValue: 'Riesgo eléctrico: identificación, prevención y actuación ante emergencia', isRequired: true, isValid: true, confidence: 1.0 },
        { documentId: docCharla.id, fieldName: 'orador', fieldValue: 'Claudia Herrera Medina — Prevencionista División El Teniente', isRequired: true, isValid: true, confidence: 1.0 },
        { documentId: docCharla.id, fieldName: 'duracion_minutos', fieldValue: '15', isRequired: true, isValid: true, confidence: 1.0 },
        { documentId: docCharla.id, fieldName: 'fecha', fieldValue: '2026-05-22', isRequired: true, isValid: true, confidence: 1.0 },
        { documentId: docCharla.id, fieldName: 'lugar', fieldValue: 'Sala de Capacitación — Adm. Mina', isRequired: true, isValid: true, confidence: 1.0 },
        { documentId: docCharla.id, fieldName: 'n_asistentes', fieldValue: '18', isRequired: true, isValid: true, confidence: 1.0 },
        { documentId: docCharla.id, fieldName: 'turno', fieldValue: 'Turno A — Día', isRequired: false, isValid: true, confidence: 1.0 },
      ],
    })
  }

  const charlaApprovalExists = await prisma.approval.count({ where: { documentId: docCharla.id } })
  if (charlaApprovalExists === 0) {
    await prisma.approval.create({
      data: {
        documentId: docCharla.id,
        approverId: gerenteCodelco.id,
        role: UserRole.MANAGER,
        status: 'APPROVED',
        comment: 'Charla documentada correctamente. Asistencia registrada. Aprobado para archivo DT.',
        approvedAt: new Date('2026-05-22T10:30:00Z'),
      },
    })
  }

  // ── DOC 3: DET (Diagnóstico de Elemento de Tracción) en curso (SCANNED) ───
  const docDet = await prisma.document.upsert({
    where: { folio: 'SC-2026-000003' },
    update: {},
    create: {
      folio: 'SC-2026-000003',
      type: DocumentType.DET,
      status: DocumentStatus.SCANNED,
      companyId: contratistaMant.id,
      workArea: 'Taller Mecánico — Zona B Reparación',
      taskName: 'DET: Inspección y diagnóstico de correa transportadora CV-12',
      supervisorId: supervisorMant.id,
      preventionistId: prevencionMant.id,
      createdById: trabajador2.id,
    },
  })

  const detFieldsExist = await prisma.documentField.count({ where: { documentId: docDet.id } })
  if (detFieldsExist === 0) {
    await prisma.documentField.createMany({
      data: [
        { documentId: docDet.id, fieldName: 'equipo', fieldValue: 'Correa transportadora CV-12 — Tramo Norte', isRequired: true, isValid: true, confidence: 0.88 },
        { documentId: docDet.id, fieldName: 'n_serie', fieldValue: 'CV12-2018-087', isRequired: true, isValid: true, confidence: 0.79 },
        { documentId: docDet.id, fieldName: 'fecha_inspeccion', fieldValue: '2026-05-23', isRequired: true, isValid: true, confidence: 0.95 },
        { documentId: docDet.id, fieldName: 'inspector', fieldValue: 'Luis Alberto Campos Reyes', isRequired: true, isValid: true, confidence: 0.91 },
        { documentId: docDet.id, fieldName: 'estado_general', fieldValue: null, isRequired: true, isValid: false, confidence: null },
        { documentId: docDet.id, fieldName: 'recomendaciones', fieldValue: null, isRequired: true, isValid: false, confidence: null },
      ],
    })
  }

  const detRisksExist = await prisma.riskControl.count({ where: { documentId: docDet.id } })
  if (detRisksExist === 0) {
    await prisma.riskControl.createMany({
      data: [
        { documentId: docDet.id, risk: 'Atrapamiento por puesta en marcha involuntaria durante inspección', control: 'LOTO aplicado. Tarjeta "NO OPERAR" instalada. Verificación con voltímetro antes de ingreso.', criticality: Criticality.CRITICAL, isValidated: true },
        { documentId: docDet.id, risk: 'Caída de material desde correa durante inspección visual', control: 'Usar casco con barboquejo. Prohibido estar bajo la correa cargada. Zona delimitada.', criticality: Criticality.HIGH, isValidated: false },
      ],
    })
  }

  // ── DOC 4: LOTO Procedimiento AT/BT (APPROVED + CLOSED) ──────────────────
  const docLoto = await prisma.document.upsert({
    where: { folio: 'SC-2026-000004' },
    update: {},
    create: {
      folio: 'SC-2026-000004',
      type: DocumentType.LOTO,
      status: DocumentStatus.CLOSED,
      companyId: contratistaElec.id,
      workArea: 'Subestación Eléctrica SE-03 — 23kV',
      taskName: 'LOTO: Mantenimiento preventivo transformador TR-03 23kV/4.16kV',
      supervisorId: supervisorElec.id,
      preventionistId: prevencionCodelco.id,
      createdById: supervisorElec.id,
    },
  })

  const lotoFieldsExist = await prisma.documentField.count({ where: { documentId: docLoto.id } })
  if (lotoFieldsExist === 0) {
    await prisma.documentField.createMany({
      data: [
        { documentId: docLoto.id, fieldName: 'equipo', fieldValue: 'Transformador TR-03 23kV/4.16kV — Subestación SE-03', isRequired: true, isValid: true, confidence: 1.0 },
        { documentId: docLoto.id, fieldName: 'voltaje', fieldValue: '23.000V / 4.160V', isRequired: true, isValid: true, confidence: 0.97 },
        { documentId: docLoto.id, fieldName: 'n_puntos_bloqueo', fieldValue: '12', isRequired: true, isValid: true, confidence: 0.98 },
        { documentId: docLoto.id, fieldName: 'responsable_loto', fieldValue: 'Héctor Jara Bustamante — Electricista AT/BT', isRequired: true, isValid: true, confidence: 0.96 },
        { documentId: docLoto.id, fieldName: 'fecha_bloqueo', fieldValue: '2026-05-20 06:30', isRequired: true, isValid: true, confidence: 1.0 },
        { documentId: docLoto.id, fieldName: 'fecha_desbloqueo', fieldValue: '2026-05-20 15:45', isRequired: true, isValid: true, confidence: 1.0 },
        { documentId: docLoto.id, fieldName: 'prueba_ausencia_tension', fieldValue: 'Verificado 0V en los 12 puntos con voltímetro Fluke 87V', isRequired: true, isValid: true, confidence: 0.94 },
      ],
    })
  }

  const lotoApprovalExists = await prisma.approval.count({ where: { documentId: docLoto.id } })
  if (lotoApprovalExists === 0) {
    await prisma.approval.createMany({
      data: [
        {
          documentId: docLoto.id,
          approverId: prevencionCodelco.id,
          role: UserRole.PREVENTIONIST,
          status: 'APPROVED',
          comment: 'Procedimiento LOTO correcto. 12 puntos verificados. Autorizado inicio de trabajos.',
          approvedAt: new Date('2026-05-20T06:45:00Z'),
        },
        {
          documentId: docLoto.id,
          approverId: gerenteCodelco.id,
          role: UserRole.MANAGER,
          status: 'APPROVED',
          comment: 'Aprobado. Documentación completa para cierre.',
          approvedAt: new Date('2026-05-20T17:00:00Z'),
        },
      ],
    })
  }

  // ── DOC 5: AST Izaje Crítico (DRAFT) ─────────────────────────────────────
  const docAst = await prisma.document.upsert({
    where: { folio: 'SC-2026-000005' },
    update: {},
    create: {
      folio: 'SC-2026-000005',
      type: DocumentType.AST,
      status: DocumentStatus.DRAFT,
      companyId: subcontratista.id,
      workArea: 'Área de Izaje — Chancador Primario',
      taskName: 'AST: Izaje crítico de cuerpo de chancador — 48 toneladas métricas',
      supervisorId: supervisorMant.id,
      preventionistId: prevencionCodelco.id,
      createdById: trabajador1.id,
    },
  })

  const astFieldsExist = await prisma.documentField.count({ where: { documentId: docAst.id } })
  if (astFieldsExist === 0) {
    await prisma.documentField.createMany({
      data: [
        { documentId: docAst.id, fieldName: 'carga_izaje_ton', fieldValue: '48', isRequired: true, isValid: true, confidence: 0.99 },
        { documentId: docAst.id, fieldName: 'grua', fieldValue: 'Grúa Liebherr LTM 1300-6.2 (300 ton)', isRequired: true, isValid: true, confidence: 0.92 },
        { documentId: docAst.id, fieldName: 'rigger_responsable', fieldValue: 'Andrés Lazo Sánchez — Rigger Nivel III', isRequired: true, isValid: true, confidence: 0.95 },
        { documentId: docAst.id, fieldName: 'angulo_eslingas', fieldValue: null, isRequired: true, isValid: false, confidence: null },
        { documentId: docAst.id, fieldName: 'plan_izaje_aprobado', fieldValue: null, isRequired: true, isValid: false, confidence: null },
      ],
    })
  }

  console.log('  ✓ Documentos demo:')
  console.log('      SC-2026-000001  ART — Cambio bomba SAG          → PENDING_APPROVAL')
  console.log('      SC-2026-000002  SAFETY_TALK — Riesgo eléctrico  → APPROVED')
  console.log('      SC-2026-000003  DET — Correa CV-12              → SCANNED')
  console.log('      SC-2026-000004  LOTO — Transformador TR-03      → CLOSED')
  console.log('      SC-2026-000005  AST — Izaje crítico 48 ton      → DRAFT')

  // ═══════════════════════════════════════════════════════════════════════════
  // AUDIT LOGS
  // ═══════════════════════════════════════════════════════════════════════════

  await prisma.auditLog.createMany({
    data: [
      { documentId: docArt.id, userId: trabajador1.id, action: 'CREATE', metadata: { folio: 'SC-2026-000001', type: 'ART' }, ipAddress: '10.100.1.50' },
      { documentId: docArt.id, userId: prevencionMant.id, action: 'STATUS_CHANGE', metadata: { from: 'DRAFT', to: 'PENDING_APPROVAL' }, ipAddress: '10.100.1.51' },
      { documentId: docCharla.id, userId: prevencionCodelco.id, action: 'CREATE', metadata: { folio: 'SC-2026-000002', type: 'SAFETY_TALK' }, ipAddress: '10.100.1.52' },
      { documentId: docCharla.id, userId: gerenteCodelco.id, action: 'APPROVE', metadata: { folio: 'SC-2026-000002', comment: 'Aprobado para archivo DT.' }, ipAddress: '10.100.1.53' },
      { documentId: docLoto.id, userId: supervisorElec.id, action: 'CREATE', metadata: { folio: 'SC-2026-000004', type: 'LOTO' }, ipAddress: '10.100.1.54' },
      { documentId: docLoto.id, userId: prevencionCodelco.id, action: 'APPROVE', metadata: { folio: 'SC-2026-000004', stage: 'PREVENTIONIST' }, ipAddress: '10.100.1.55' },
      { documentId: docLoto.id, userId: gerenteCodelco.id, action: 'CLOSE', metadata: { folio: 'SC-2026-000004' }, ipAddress: '10.100.1.56' },
    ],
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // NOTIFICACIONES PENDIENTES
  // ═══════════════════════════════════════════════════════════════════════════

  const notifExists = await prisma.notification.count({ where: { documentId: docArt.id } })
  if (notifExists === 0) {
    await prisma.notification.createMany({
      data: [
        {
          documentId: docArt.id,
          recipientId: supervisorMant.id,
          channel: 'IN_APP',
          status: 'PENDING',
          message: JSON.stringify({
            subject: 'ART SC-2026-000001 pendiente de aprobación',
            body: 'El ART "Cambio de bomba de lubricación molino SAG-01" está pendiente de su aprobación.',
          }),
        },
        {
          documentId: docArt.id,
          recipientId: prevencionCodelco.id,
          channel: 'EMAIL',
          status: 'PENDING',
          message: JSON.stringify({
            subject: 'Nuevo ART SC-2026-000001 requiere revisión prevencionista',
            body: 'ART creado por Juan Pérez Soto — Mantención Industrial Andes. Requiere validación antes de inicio de trabajos.',
          }),
        },
        {
          documentId: docDet.id,
          recipientId: supervisorMant.id,
          channel: 'IN_APP',
          status: 'SENT',
          sentAt: new Date(),
          message: JSON.stringify({
            subject: 'DET SC-2026-000003 escaneado — revisión pendiente',
            body: 'El DET de la correa CV-12 ha sido escaneado y está en revisión OCR.',
          }),
        },
      ],
    })
  }

  console.log('  ✓ Audit logs y notificaciones demo creados')
  console.log('\n✅ Seed piloto industrial completado')
  console.log('\n══════════════════════════════════════════')
  console.log('Acceso demo:')
  console.log('  admin@safecheck.app            SafeCheck2026!')
  console.log('  prevencion@codelco-teniente.cl SafeCheck2026!')
  console.log('  supervisor.mecanico@mant-andes.cl SafeCheck2026!')
  console.log('══════════════════════════════════════════')
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error('❌ Error en seed:', e)
    await prisma.$disconnect()
    process.exit(1)
  })
