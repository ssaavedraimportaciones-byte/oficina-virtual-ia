import type { DocumentTipo } from '@/types/document'
import type { UserRole } from '@/types/user'

export interface DocumentTypeConfig {
  label: string
  descripcion: string
  requiereGps: boolean
  aprobacionesRequeridas: number
  rolesAprobacion: { nivel: 1 | 2 | 3; roles: UserRole[] }[]
  camposRequeridos: string[]
}

export const DOCUMENT_TYPES: Record<DocumentTipo, DocumentTypeConfig> = {
  CHARLA: {
    label: 'Charla de Seguridad',
    descripcion: 'Registro de charla diaria de seguridad',
    requiereGps: false,
    aprobacionesRequeridas: 1,
    rolesAprobacion: [{ nivel: 1, roles: ['supervisor', 'prevencionista', 'admin'] }],
    camposRequeridos: ['tema', 'orador', 'duracion_minutos', 'fecha', 'lugar'],
  },
  DET: {
    label: 'DET',
    descripcion: 'Declaración de Estado del Trabajador',
    requiereGps: false,
    aprobacionesRequeridas: 1,
    rolesAprobacion: [{ nivel: 1, roles: ['supervisor', 'prevencionista', 'admin'] }],
    camposRequeridos: ['trabajador_nombre', 'trabajador_rut', 'estado_salud', 'declaracion'],
  },
  ART: {
    label: 'ART',
    descripcion: 'Análisis de Riesgo en el Trabajo',
    requiereGps: false,
    aprobacionesRequeridas: 2,
    rolesAprobacion: [
      { nivel: 1, roles: ['supervisor', 'admin'] },
      { nivel: 2, roles: ['prevencionista', 'admin'] },
    ],
    camposRequeridos: ['tarea', 'lugar', 'empresa', 'fecha', 'responsable', 'pasos', 'riesgos', 'medidas_control', 'epp_requerido'],
  },
  AST: {
    label: 'AST',
    descripcion: 'Análisis de Seguridad en el Trabajo',
    requiereGps: false,
    aprobacionesRequeridas: 3,
    rolesAprobacion: [
      { nivel: 1, roles: ['supervisor', 'admin'] },
      { nivel: 2, roles: ['prevencionista', 'admin'] },
      { nivel: 3, roles: ['jefe_area', 'admin'] },
    ],
    camposRequeridos: ['tarea', 'lugar', 'empresa', 'fecha', 'responsable', 'pasos', 'peligros', 'controles'],
  },
  PERMISO: {
    label: 'Permiso de Trabajo',
    descripcion: 'Permiso formal para ejecución de trabajos de riesgo',
    requiereGps: false,
    aprobacionesRequeridas: 3,
    rolesAprobacion: [
      { nivel: 1, roles: ['supervisor', 'admin'] },
      { nivel: 2, roles: ['prevencionista', 'admin'] },
      { nivel: 3, roles: ['jefe_area', 'admin'] },
    ],
    camposRequeridos: ['tipo_trabajo', 'area', 'empresa_ejecutante', 'fecha_inicio', 'fecha_termino', 'trabajos_simultaneos'],
  },
  LOTO: {
    label: 'LOTO',
    descripcion: 'Bloqueo y Etiquetado (Lock Out / Tag Out)',
    requiereGps: false,
    aprobacionesRequeridas: 2,
    rolesAprobacion: [
      { nivel: 1, roles: ['supervisor', 'admin'] },
      { nivel: 2, roles: ['jefe_area', 'admin'] },
    ],
    camposRequeridos: ['equipo', 'punto_aislamiento', 'tipo_energia', 'responsable_bloqueo'],
  },
  ALTURA: {
    label: 'Trabajo en Altura',
    descripcion: 'Autorización para trabajos sobre 1.8 metros',
    requiereGps: true,
    aprobacionesRequeridas: 2,
    rolesAprobacion: [
      { nivel: 1, roles: ['supervisor', 'admin'] },
      { nivel: 2, roles: ['prevencionista', 'admin'] },
    ],
    camposRequeridos: ['altura_maxima', 'tipo_estructura', 'sistema_anticaida', 'plan_rescate'],
  },
  IZAJE: {
    label: 'Izaje',
    descripcion: 'Plan y autorización de izaje de cargas',
    requiereGps: true,
    aprobacionesRequeridas: 2,
    rolesAprobacion: [
      { nivel: 1, roles: ['supervisor', 'admin'] },
      { nivel: 2, roles: ['prevencionista', 'admin'] },
    ],
    camposRequeridos: ['tipo_grua', 'capacidad_toneladas', 'peso_carga', 'radio_operacion', 'operador_nombre', 'rigger_nombre'],
  },
  ESPACIO_CONFINADO: {
    label: 'Espacio Confinado',
    descripcion: 'Autorización e ingreso a espacios confinados',
    requiereGps: true,
    aprobacionesRequeridas: 3,
    rolesAprobacion: [
      { nivel: 1, roles: ['supervisor', 'admin'] },
      { nivel: 2, roles: ['prevencionista', 'admin'] },
      { nivel: 3, roles: ['jefe_area', 'admin'] },
    ],
    camposRequeridos: ['tipo_espacio', 'atmosfera_peligrosa', 'prueba_gas', 'vigias', 'plan_rescate'],
  },
}
