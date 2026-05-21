import type { DocumentType, FieldSchema } from './types'

export const DOCUMENT_FIELD_SCHEMAS: Record<DocumentType, FieldSchema[]> = {
  CHARLA_DE_SEGURIDAD: [
    { name: 'empresa', description: 'Nombre de la empresa', required: true },
    { name: 'area', description: 'Área o faena', required: true },
    { name: 'fecha', description: 'Fecha de la charla (YYYY-MM-DD)', required: true },
    { name: 'hora', description: 'Hora de inicio (HH:MM)', required: true },
    { name: 'tema', description: 'Tema de la charla de seguridad', required: true },
    { name: 'relator', description: 'Nombre del relator', required: true },
    { name: 'duracion', description: 'Duración en minutos', required: false },
    { name: 'cantidad_participantes', description: 'Número de participantes', required: false },
    { name: 'observaciones', description: 'Observaciones adicionales', required: false },
  ],
  DET: [
    { name: 'empresa', description: 'Nombre de la empresa', required: true },
    { name: 'area', description: 'Área de trabajo', required: true },
    { name: 'fecha', description: 'Fecha del DET (YYYY-MM-DD)', required: true },
    { name: 'tarea', description: 'Descripción de la tarea a realizar', required: true },
    { name: 'responsable', description: 'Nombre del responsable', required: true },
    { name: 'supervisor', description: 'Nombre del supervisor', required: true },
    { name: 'observaciones', description: 'Observaciones', required: false },
  ],
  ART: [
    { name: 'empresa', description: 'Nombre de la empresa', required: true },
    { name: 'area', description: 'Área de trabajo', required: true },
    { name: 'fecha', description: 'Fecha del ART (YYYY-MM-DD)', required: true },
    { name: 'tarea', description: 'Descripción general de la tarea', required: true },
    { name: 'responsable', description: 'Nombre del responsable', required: true },
    { name: 'cantidad_items', description: 'Número de ítems evaluados', required: false },
  ],
  PERMISO_DE_TRABAJO: [
    { name: 'empresa', description: 'Nombre de la empresa', required: true },
    { name: 'area', description: 'Área o lugar de trabajo', required: true },
    { name: 'tipo_permiso', description: 'Tipo de permiso (trabajo en caliente, altura, espacio confinado, etc.)', required: true },
    { name: 'tarea', description: 'Descripción de la tarea', required: true },
    { name: 'responsable', description: 'Nombre del responsable', required: true },
    { name: 'vigencia_desde', description: 'Fecha/hora de inicio de vigencia', required: true },
    { name: 'vigencia_hasta', description: 'Fecha/hora de término de vigencia', required: true },
    { name: 'autorizador', description: 'Nombre de quien autoriza', required: false },
  ],
  CHECK_LIST: [
    { name: 'empresa', description: 'Nombre de la empresa', required: true },
    { name: 'area', description: 'Área inspeccionada', required: true },
    { name: 'fecha', description: 'Fecha de la inspección (YYYY-MM-DD)', required: true },
    { name: 'responsable', description: 'Nombre del responsable de la inspección', required: true },
    { name: 'tipo_checklist', description: 'Tipo o nombre del checklist', required: false },
    { name: 'items_ok', description: 'Número de ítems conformes', required: false },
    { name: 'items_nok', description: 'Número de ítems no conformes', required: false },
  ],
  ACTA_DE_REUNION: [
    { name: 'empresa', description: 'Nombre de la empresa', required: true },
    { name: 'area', description: 'Área o departamento', required: false },
    { name: 'fecha', description: 'Fecha de la reunión (YYYY-MM-DD)', required: true },
    { name: 'hora', description: 'Hora de la reunión (HH:MM)', required: false },
    { name: 'lugar', description: 'Lugar de la reunión', required: false },
    { name: 'facilitador', description: 'Nombre del facilitador o moderador', required: false },
    { name: 'cantidad_asistentes', description: 'Número de asistentes', required: false },
    { name: 'objetivos', description: 'Objetivos de la reunión', required: false },
    { name: 'acuerdos', description: 'Acuerdos adoptados', required: false },
  ],
  INCIDENTE: [
    { name: 'empresa', description: 'Nombre de la empresa', required: true },
    { name: 'area', description: 'Área donde ocurrió', required: true },
    { name: 'fecha', description: 'Fecha del incidente (YYYY-MM-DD)', required: true },
    { name: 'hora', description: 'Hora del incidente (HH:MM)', required: true },
    { name: 'descripcion', description: 'Descripción del incidente', required: true },
    { name: 'trabajador_involucrado', description: 'Nombre del trabajador involucrado', required: false },
    { name: 'tipo_incidente', description: 'Tipo: accidente, cuasi-accidente, incidente ambiental', required: false },
    { name: 'lesion', description: 'Descripción de la lesión si aplica', required: false },
    { name: 'testigos', description: 'Nombres de testigos', required: false },
    { name: 'reportado_por', description: 'Nombre de quien reporta', required: false },
  ],
  INVESTIGACION: [
    { name: 'empresa', description: 'Nombre de la empresa', required: true },
    { name: 'area', description: 'Área donde ocurrió', required: true },
    { name: 'fecha_incidente', description: 'Fecha del incidente investigado (YYYY-MM-DD)', required: true },
    { name: 'fecha_investigacion', description: 'Fecha de la investigación (YYYY-MM-DD)', required: true },
    { name: 'investigador', description: 'Nombre del investigador principal', required: true },
    { name: 'descripcion_incidente', description: 'Descripción del incidente', required: true },
    { name: 'causa_raiz', description: 'Causa raíz identificada', required: false },
    { name: 'medidas_correctivas', description: 'Medidas correctivas propuestas', required: false },
  ],
  AUDITORIA: [
    { name: 'empresa', description: 'Empresa auditada', required: true },
    { name: 'area', description: 'Área o proceso auditado', required: true },
    { name: 'fecha', description: 'Fecha de la auditoría (YYYY-MM-DD)', required: true },
    { name: 'auditor', description: 'Nombre del auditor', required: true },
    { name: 'tipo_auditoria', description: 'Tipo de auditoría (interna, externa, etc.)', required: false },
    { name: 'hallazgos', description: 'Número o resumen de hallazgos', required: false },
    { name: 'no_conformidades', description: 'Número de no conformidades', required: false },
    { name: 'conclusion', description: 'Conclusión general de la auditoría', required: false },
  ],
  CAPACITACION: [
    { name: 'empresa', description: 'Nombre de la empresa', required: true },
    { name: 'area', description: 'Área o grupo capacitado', required: true },
    { name: 'fecha', description: 'Fecha de la capacitación (YYYY-MM-DD)', required: true },
    { name: 'tema', description: 'Tema de la capacitación', required: true },
    { name: 'instructor', description: 'Nombre del instructor', required: true },
    { name: 'duracion', description: 'Duración en horas o minutos', required: false },
    { name: 'cantidad_participantes', description: 'Número de participantes', required: false },
    { name: 'evaluacion', description: 'Resultado de evaluación si aplica', required: false },
  ],
  OTHER: [
    { name: 'empresa', description: 'Nombre de la empresa si aparece', required: false },
    { name: 'area', description: 'Área si aparece', required: false },
    { name: 'fecha', description: 'Fecha si aparece (YYYY-MM-DD)', required: false },
    { name: 'responsable', description: 'Responsable si aparece', required: false },
  ],
}

export const CLASSIFICATION_SYSTEM_PROMPT = `Eres un sistema experto en clasificación y extracción de documentos de seguridad en minería y construcción en Chile.

Tu tarea es analizar texto extraído de documentos y:
1. Clasificar el tipo de documento
2. Extraer campos relevantes según el tipo detectado
3. Identificar campos faltantes
4. Generar observaciones de calidad

TIPOS DE DOCUMENTO VÁLIDOS:
- CHARLA_DE_SEGURIDAD: Charlas, toolbox meetings, reuniones de seguridad breves
- DET: Definición Estratégica de la Tarea, planificación de trabajo seguro
- ART: Análisis de Riesgo de la Tarea, evaluación de riesgos por pasos
- PERMISO_DE_TRABAJO: Permisos de trabajo en caliente, altura, espacio confinado
- CHECK_LIST: Listas de verificación, inspecciones de equipos o áreas
- ACTA_DE_REUNION: Actas de reuniones, minutas
- INCIDENTE: Reportes de accidentes, cuasi-accidentes, incidentes
- INVESTIGACION: Investigaciones de accidentes, análisis de causas raíz
- AUDITORIA: Auditorías de seguridad, inspecciones formales
- CAPACITACION: Registros de capacitación, cursos, entrenamiento
- OTHER: Cuando no corresponde a ninguna categoría anterior

REGLAS CRÍTICAS:
- Devuelve ÚNICAMENTE JSON válido, sin texto adicional, sin bloques de código markdown
- Si no estás seguro del tipo, usa OTHER con confidence menor a 0.5
- Si un campo no aparece claramente en el texto, su value debe ser null
- Solo marca inferred: true si el valor fue deducido, no si fue extraído directamente
- No inventes datos que no estén en el texto
- confidence debe ser un número entre 0 y 1
- Las observaciones deben ser en español y referirse a problemas de calidad o completitud del documento`

export function buildClassificationPrompt(fileText: string): string {
  return `Analiza el siguiente texto extraído de un documento de seguridad y clasifícalo.

TEXTO DEL DOCUMENTO:
---
${fileText.slice(0, 8000)}
---

Responde ÚNICAMENTE con el siguiente JSON (sin markdown, sin explicaciones):
{
  "documentType": "<tipo>",
  "confidence": <0-1>,
  "fields": {
    "<nombre_campo>": { "value": "<valor o null>", "inferred": <true|false> }
  },
  "missingFields": ["<campo1>", "<campo2>"],
  "observations": ["<observacion1>", "<observacion2>"],
  "inferredFields": ["<campo1_inferido>"]
}`
}

export function buildFieldExtractionPrompt(documentType: DocumentType, extractedText: string): string {
  const schema = DOCUMENT_FIELD_SCHEMAS[documentType]
  const fieldList = schema
    .map((f) => `- ${f.name}: ${f.description}${f.required ? ' [REQUERIDO]' : ' [opcional]'}`)
    .join('\n')

  return `Extrae los campos de un documento de tipo ${documentType}.

CAMPOS ESPERADOS:
${fieldList}

TEXTO DEL DOCUMENTO:
---
${extractedText.slice(0, 8000)}
---

Responde ÚNICAMENTE con el siguiente JSON (sin markdown, sin explicaciones):
{
  "documentType": "${documentType}",
  "confidence": <0-1>,
  "fields": {
    "<nombre_campo>": { "value": "<valor o null>", "inferred": <true|false> }
  },
  "missingFields": ["<campos requeridos que no aparecen>"],
  "observations": ["<observaciones sobre calidad o completitud>"],
  "inferredFields": ["<campos cuyo valor fue inferido, no extraído directamente>"]
}`
}
