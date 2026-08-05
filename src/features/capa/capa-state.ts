/**
 * Máquina de estados de las CAPA — No conformidades y acciones correctivas
 * (TASK-007). Módulo PURO y central, cubierto por pruebas. Define las
 * transiciones válidas del ciclo de vida y los catálogos (enums text + CHECK).
 * No permite saltos arbitrarios.
 *
 * Ciclo: Registro → Contención → Evaluación/Investigación → Causa raíz →
 * Plan de acciones → Implementación → Verificación de eficacia → Cierre.
 */

export const CAPA_STATUSES = [
  'draft',
  'reported',
  'containment',
  'under_investigation',
  'action_plan',
  'in_implementation',
  'effectiveness_review',
  'closed',
  'cancelled',
] as const;
export type CapaStatus = (typeof CAPA_STATUSES)[number];

export const CAPA_STATUS_LABEL: Record<CapaStatus, string> = {
  draft: 'Borrador',
  reported: 'Reportada',
  containment: 'En contención',
  under_investigation: 'En investigación',
  action_plan: 'Plan de acciones',
  in_implementation: 'En implementación',
  effectiveness_review: 'Verificación de eficacia',
  closed: 'Cerrada',
  cancelled: 'Cancelada',
};

export function isCapaStatus(value: unknown): value is CapaStatus {
  return typeof value === 'string' && (CAPA_STATUSES as readonly string[]).includes(value);
}

/** Estados terminales: solo lectura, sin transiciones normales de avance. */
export function isTerminalStatus(status: CapaStatus): boolean {
  return status === 'closed' || status === 'cancelled';
}

/**
 * Transiciones normales permitidas (avance secuencial + cancelación + retorno de
 * eficacia no satisfactoria a plan de acciones). La REAPERTURA de una CAPA
 * cerrada es una operación privilegiada aparte (ver `REOPEN_TARGETS`).
 */
const ALLOWED: Record<CapaStatus, readonly CapaStatus[]> = {
  draft: ['reported', 'cancelled'],
  reported: ['containment', 'cancelled'],
  containment: ['under_investigation', 'cancelled'],
  under_investigation: ['action_plan', 'cancelled'],
  action_plan: ['in_implementation', 'cancelled'],
  in_implementation: ['effectiveness_review', 'cancelled'],
  // Eficacia no satisfactoria vuelve al plan de acciones; satisfactoria cierra.
  effectiveness_review: ['closed', 'action_plan'],
  closed: [],
  cancelled: [],
};

export function canTransitionCapa(from: CapaStatus, to: CapaStatus): boolean {
  return ALLOWED[from].includes(to);
}

export class InvalidCapaTransitionError extends Error {
  constructor(from: CapaStatus, to: CapaStatus) {
    super(`Transición de CAPA no permitida: ${from} → ${to}.`);
    this.name = 'InvalidCapaTransitionError';
  }
}

export function assertCapaTransition(from: CapaStatus, to: CapaStatus): void {
  if (!canTransitionCapa(from, to)) {
    throw new InvalidCapaTransitionError(from, to);
  }
}

/** Estados a los que owner/admin puede REABRIR una CAPA cerrada. */
export const REOPEN_TARGETS = ['under_investigation', 'action_plan'] as const;
export type ReopenTarget = (typeof REOPEN_TARGETS)[number];

export function canReopenTo(target: CapaStatus): target is ReopenTarget {
  return (REOPEN_TARGETS as readonly string[]).includes(target);
}

/** Solo una CAPA en borrador puede eliminarse lógicamente. */
export function isLogicallyDeletable(status: CapaStatus): boolean {
  return status === 'draft';
}

// --- Catálogos (enums text + CHECK; etiquetas en español) --------------------

/** Tipo / origen del registro. */
export const CAPA_SOURCE_TYPES = [
  'internal_nc',
  'audit_nc',
  'deviation',
  'customer_complaint',
  'safety_incident',
  'legal_noncompliance',
  'documental_finding',
  'out_of_spec',
  'improvement',
  'other',
] as const;
export type CapaSourceType = (typeof CAPA_SOURCE_TYPES)[number];
export const CAPA_SOURCE_TYPE_LABEL: Record<CapaSourceType, string> = {
  internal_nc: 'No conformidad interna',
  audit_nc: 'No conformidad de auditoría',
  deviation: 'Desviación',
  customer_complaint: 'Queja de cliente',
  safety_incident: 'Incidente de inocuidad',
  legal_noncompliance: 'Incumplimiento legal',
  documental_finding: 'Hallazgo documental',
  out_of_spec: 'Resultado fuera de especificación',
  improvement: 'Oportunidad de mejora',
  other: 'Otro',
};

export const CAPA_SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;
export type CapaSeverity = (typeof CAPA_SEVERITIES)[number];
export const CAPA_SEVERITY_LABEL: Record<CapaSeverity, string> = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
  critical: 'Crítica',
};

export const CAPA_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;
export type CapaPriority = (typeof CAPA_PRIORITIES)[number];
export const CAPA_PRIORITY_LABEL: Record<CapaPriority, string> = {
  low: 'Baja',
  normal: 'Normal',
  high: 'Alta',
  urgent: 'Urgente',
};

export const CAPA_IMPACTS = [
  'quality',
  'safety',
  'legal',
  'customer',
  'product',
  'process',
  'personnel',
  'environment',
  'cost',
  'reputation',
] as const;
export type CapaImpact = (typeof CAPA_IMPACTS)[number];
export const CAPA_IMPACT_LABEL: Record<CapaImpact, string> = {
  quality: 'Calidad',
  safety: 'Inocuidad',
  legal: 'Legal',
  customer: 'Cliente',
  product: 'Producto',
  process: 'Proceso',
  personnel: 'Personal',
  environment: 'Ambiente',
  cost: 'Costo',
  reputation: 'Reputación',
};

export const CAPA_SCOPES = [
  'point',
  'batch',
  'line',
  'site',
  'organization',
  'customer',
  'market',
] as const;
export type CapaScope = (typeof CAPA_SCOPES)[number];
export const CAPA_SCOPE_LABEL: Record<CapaScope, string> = {
  point: 'Puntual',
  batch: 'Lote',
  line: 'Línea',
  site: 'Sitio',
  organization: 'Organización',
  customer: 'Cliente',
  market: 'Mercado',
};

/** Acciones inmediatas: contención (evita el efecto) o corrección (lo resuelve). */
export const IMMEDIATE_ACTION_TYPES = ['containment', 'correction'] as const;
export type ImmediateActionType = (typeof IMMEDIATE_ACTION_TYPES)[number];
export const IMMEDIATE_ACTION_TYPE_LABEL: Record<ImmediateActionType, string> = {
  containment: 'Contención',
  correction: 'Corrección',
};

/** Estado de una acción inmediata. */
export const IMMEDIATE_ACTION_STATUSES = [
  'pending',
  'in_progress',
  'completed',
  'cancelled',
] as const;
export type ImmediateActionStatus = (typeof IMMEDIATE_ACTION_STATUSES)[number];

/** Métodos de análisis de causa disponibles inicialmente. */
export const RCA_METHODS = [
  'five_whys',
  'free_analysis',
  'process_review',
  'document_review',
  'other',
] as const;
export type RcaMethod = (typeof RCA_METHODS)[number];
export const RCA_METHOD_LABEL: Record<RcaMethod, string> = {
  five_whys: '5 porqués',
  free_analysis: 'Análisis libre',
  process_review: 'Revisión de proceso',
  document_review: 'Revisión documental',
  other: 'Otro',
};

/** Tipos de acción del plan. */
export const ACTION_TYPES = [
  'correction',
  'containment',
  'corrective',
  'preventive',
  'training',
  'document_change',
  'process_change',
  'maintenance',
  'validation',
  'follow_up',
  'other',
] as const;
export type ActionType = (typeof ACTION_TYPES)[number];
export const ACTION_TYPE_LABEL: Record<ActionType, string> = {
  correction: 'Corrección',
  containment: 'Contención',
  corrective: 'Acción correctiva',
  preventive: 'Acción preventiva',
  training: 'Capacitación',
  document_change: 'Cambio documental',
  process_change: 'Cambio de proceso',
  maintenance: 'Mantenimiento',
  validation: 'Validación',
  follow_up: 'Seguimiento',
  other: 'Otro',
};

/** Estado de una acción del plan. */
export const ACTION_STATUSES = [
  'pending',
  'in_progress',
  'blocked',
  'completed',
  'cancelled',
] as const;
export type ActionStatus = (typeof ACTION_STATUSES)[number];
export const ACTION_STATUS_LABEL: Record<ActionStatus, string> = {
  pending: 'Pendiente',
  in_progress: 'En progreso',
  blocked: 'Bloqueada',
  completed: 'Completada',
  cancelled: 'Cancelada',
};

/** Conclusión de la verificación de eficacia. */
export const EFFECTIVENESS_RESULTS = ['effective', 'partially_effective', 'not_effective'] as const;
export type EffectivenessResult = (typeof EFFECTIVENESS_RESULTS)[number];
export const EFFECTIVENESS_RESULT_LABEL: Record<EffectivenessResult, string> = {
  effective: 'Eficaz',
  partially_effective: 'Parcialmente eficaz',
  not_effective: 'No eficaz',
};

/** Tipo/etapa de evidencia asociada a un archivo. */
export const CAPA_EVIDENCE_TYPES = [
  'finding',
  'containment',
  'investigation',
  'root_cause',
  'implementation',
  'effectiveness',
  'closure',
] as const;
export type CapaEvidenceType = (typeof CAPA_EVIDENCE_TYPES)[number];
export const CAPA_EVIDENCE_TYPE_LABEL: Record<CapaEvidenceType, string> = {
  finding: 'Evidencia del hallazgo',
  containment: 'Contención',
  investigation: 'Investigación',
  root_cause: 'Causa raíz',
  implementation: 'Implementación',
  effectiveness: 'Eficacia',
  closure: 'Cierre',
};

/** Tipos de vínculo de una CAPA con otras entidades. */
export const CAPA_RELATION_TYPES = [
  'site',
  'diagnostic',
  'document',
  'document_version',
  'requirement',
  'finding',
  'external',
] as const;
export type CapaRelationType = (typeof CAPA_RELATION_TYPES)[number];

/** Eventos del historial (append-only). */
export const CAPA_HISTORY_EVENTS = [
  'created',
  'reported',
  'responsible_assigned',
  'status_changed',
  'containment_added',
  'investigation_updated',
  'root_cause_concluded',
  'action_created',
  'action_updated',
  'evidence_added',
  'effectiveness_evaluated',
  'closed',
  'reopened',
  'cancelled',
] as const;
export type CapaHistoryEvent = (typeof CAPA_HISTORY_EVENTS)[number];
