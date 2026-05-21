import type { DocumentTipo } from '@/types/document'

export const DOCUMENT_LABELS: Record<DocumentTipo, string> = {
  CHARLA: 'Charla de Seguridad',
  DET: 'Declaración de Estado del Trabajador',
  ART: 'Análisis de Riesgo en el Trabajo',
  AST: 'Análisis de Seguridad en el Trabajo',
  PERMISO: 'Permiso de Trabajo',
  LOTO: 'Bloqueo y Etiquetado',
  ALTURA: 'Trabajo en Altura',
  IZAJE: 'Izaje de Cargas',
  ESPACIO_CONFINADO: 'Espacio Confinado',
}

export const APROBACIONES_REQUERIDAS: Record<DocumentTipo, number> = {
  CHARLA: 1, DET: 1, ART: 2, AST: 3, PERMISO: 3,
  LOTO: 2, ALTURA: 2, IZAJE: 2, ESPACIO_CONFINADO: 3,
}

export const REQUIERE_GPS: Record<DocumentTipo, boolean> = {
  CHARLA: false, DET: false, ART: false, AST: false, PERMISO: false,
  LOTO: false, ALTURA: true, IZAJE: true, ESPACIO_CONFINADO: true,
}

export const CAMPOS_REQUERIDOS: Record<DocumentTipo, string[]> = {
  CHARLA: ['tema', 'orador', 'duracion_minutos', 'fecha', 'lugar'],
  DET: ['trabajador_nombre', 'trabajador_rut', 'estado_salud', 'declaracion'],
  ART: ['tarea', 'lugar', 'empresa', 'fecha', 'responsable', 'pasos', 'riesgos', 'medidas_control', 'epp_requerido'],
  AST: ['tarea', 'lugar', 'empresa', 'fecha', 'responsable', 'pasos', 'peligros', 'controles'],
  PERMISO: ['tipo_trabajo', 'area', 'empresa_ejecutante', 'fecha_inicio', 'fecha_termino', 'trabajos_simultaneos'],
  LOTO: ['equipo', 'punto_aislamiento', 'tipo_energia', 'responsable_bloqueo'],
  ALTURA: ['altura_maxima', 'tipo_estructura', 'sistema_anticaida', 'plan_rescate'],
  IZAJE: ['tipo_grua', 'capacidad_toneladas', 'peso_carga', 'radio_operacion', 'operador_nombre', 'rigger_nombre'],
  ESPACIO_CONFINADO: ['tipo_espacio', 'atmosfera_peligrosa', 'prueba_gas', 'vigias', 'plan_rescate'],
}
