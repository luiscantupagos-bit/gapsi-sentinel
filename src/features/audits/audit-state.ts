/**
 * Máquina de estados de la AUDITORÍA (TASK-010). Módulo PURO, cubierto por
 * pruebas. Transiciones válidas, etiquetas en español, tipos y guardas.
 */

export const AUDIT_STATUSES = [
  'draft',
  'planned',
  'ready',
  'in_progress',
  'report_drafting',
  'under_review',
  'completed',
  'follow_up',
  'closed',
  'cancelled',
] as const;
export type AuditStatus = (typeof AUDIT_STATUSES)[number];

export const AUDIT_STATUS_LABEL: Record<AuditStatus, string> = {
  draft: 'Borrador',
  planned: 'Planeada',
  ready: 'Lista para ejecutar',
  in_progress: 'En ejecución',
  report_drafting: 'Elaborando informe',
  under_review: 'En revisión',
  completed: 'Completada',
  follow_up: 'En seguimiento',
  closed: 'Cerrada',
  cancelled: 'Cancelada',
};

export const AUDIT_TYPES = [
  'internal',
  'process',
  'system',
  'product',
  'supplier',
  'readiness',
  'follow_up',
  'extraordinary',
  'second_party',
  'certification_drill',
  'other',
] as const;
export type AuditType = (typeof AUDIT_TYPES)[number];
export const AUDIT_TYPE_LABEL: Record<AuditType, string> = {
  internal: 'Auditoría interna',
  process: 'Auditoría de proceso',
  system: 'Auditoría de sistema',
  product: 'Auditoría de producto',
  supplier: 'Auditoría de proveedor',
  readiness: 'Auditoría de preparación',
  follow_up: 'Auditoría de seguimiento',
  extraordinary: 'Auditoría extraordinaria',
  second_party: 'Auditoría de segunda parte',
  certification_drill: 'Simulacro de certificación',
  other: 'Otra',
};

export const AUDIT_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;
export type AuditPriority = (typeof AUDIT_PRIORITIES)[number];
export const AUDIT_PRIORITY_LABEL: Record<AuditPriority, string> = {
  low: 'Baja',
  normal: 'Normal',
  high: 'Alta',
  urgent: 'Urgente',
};

export function isAuditStatus(v: unknown): v is AuditStatus {
  return typeof v === 'string' && (AUDIT_STATUSES as readonly string[]).includes(v);
}
export function isTerminalAudit(s: AuditStatus): boolean {
  return s === 'closed' || s === 'cancelled';
}

const ALLOWED: Record<AuditStatus, readonly AuditStatus[]> = {
  draft: ['planned', 'cancelled'],
  planned: ['ready', 'in_progress', 'cancelled'],
  ready: ['in_progress', 'planned', 'cancelled'],
  in_progress: ['report_drafting', 'cancelled'],
  report_drafting: ['under_review', 'in_progress', 'cancelled'],
  under_review: ['completed', 'report_drafting', 'cancelled'],
  completed: ['follow_up', 'closed'],
  follow_up: ['closed'],
  closed: [],
  cancelled: [],
};

const REOPEN: Record<AuditStatus, readonly AuditStatus[]> = {
  draft: [],
  planned: [],
  ready: [],
  in_progress: [],
  report_drafting: [],
  under_review: [],
  completed: [],
  follow_up: [],
  closed: ['follow_up'],
  cancelled: ['draft'],
};

export function canTransitionAudit(
  from: AuditStatus,
  to: AuditStatus,
  opts?: { reopen?: boolean },
): boolean {
  if (opts?.reopen) return REOPEN[from].includes(to);
  return ALLOWED[from].includes(to);
}
export function isAuditReopen(from: AuditStatus, to: AuditStatus): boolean {
  return REOPEN[from].includes(to);
}

export class InvalidAuditTransitionError extends Error {
  constructor(from: AuditStatus, to: AuditStatus) {
    super(`Transición de auditoría no permitida: ${from} → ${to}.`);
    this.name = 'InvalidAuditTransitionError';
  }
}
export function assertAuditTransition(
  from: AuditStatus,
  to: AuditStatus,
  opts?: { reopen?: boolean },
): void {
  if (!canTransitionAudit(from, to, opts)) throw new InvalidAuditTransitionError(from, to);
}

/** Estados en los que la auditoría está "en ejecución o más avanzada". */
export function isExecutionStarted(s: AuditStatus): boolean {
  return (
    s === 'in_progress' ||
    s === 'report_drafting' ||
    s === 'under_review' ||
    s === 'completed' ||
    s === 'follow_up' ||
    s === 'closed'
  );
}

/**
 * Guardas de negocio de una transición.
 * - ejecutar (ready/in_progress) requiere alcance, criterios y auditor líder;
 * - cerrar con hallazgos abiertos que requieren seguimiento exige justificación;
 * - cancelar exige motivo.
 */
export function validateAuditTransition(input: {
  to: AuditStatus;
  hasScope?: boolean;
  hasCriteria?: boolean;
  hasLead?: boolean;
  openFollowUpFindings?: number;
  justification?: string | null;
  reason?: string | null;
}): string[] {
  const errors: string[] = [];
  if (input.to === 'ready' || input.to === 'in_progress') {
    if (!input.hasScope) errors.push('Define el alcance antes de ejecutar.');
    if (!input.hasCriteria) errors.push('Define los criterios antes de ejecutar.');
    if (!input.hasLead) errors.push('Asigna un auditor líder antes de ejecutar.');
  }
  if (
    input.to === 'closed' &&
    (input.openFollowUpFindings ?? 0) > 0 &&
    !input.justification?.trim()
  ) {
    errors.push(
      'Existen hallazgos abiertos que requieren seguimiento; cierra o registra una justificación.',
    );
  }
  if (input.to === 'cancelled' && !input.reason?.trim()) {
    errors.push('Indica el motivo de la cancelación.');
  }
  return errors;
}
