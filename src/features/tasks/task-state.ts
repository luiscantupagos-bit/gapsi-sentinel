/**
 * Máquina de estados del gestor global de tareas (TASK-009). Módulo PURO y
 * central, cubierto por pruebas. Define transiciones válidas, etiquetas en
 * español, prioridades y guardas de negocio. No accede a BD ni UI.
 */

export const TASK_STATUSES = [
  'draft',
  'pending',
  'in_progress',
  'blocked',
  'under_review',
  'completed',
  'cancelled',
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  draft: 'Borrador',
  pending: 'Pendiente',
  in_progress: 'En progreso',
  blocked: 'Bloqueada',
  under_review: 'En revisión',
  completed: 'Completada',
  cancelled: 'Cancelada',
};

export const TASK_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];
export const TASK_PRIORITY_LABEL: Record<TaskPriority, string> = {
  low: 'Baja',
  normal: 'Normal',
  high: 'Alta',
  urgent: 'Urgente',
};

export const TASK_TYPES = [
  'manual',
  'doc_review',
  'doc_approval',
  'doc_read',
  'capa_action',
  'effectiveness_review',
  'analysis',
  'fmea_action',
  'project',
  'follow_up',
  'other',
] as const;
export type TaskType = (typeof TASK_TYPES)[number];
export const TASK_TYPE_LABEL: Record<TaskType, string> = {
  manual: 'Manual',
  doc_review: 'Revisión documental',
  doc_approval: 'Aprobación documental',
  doc_read: 'Lectura documental',
  capa_action: 'Acción CAPA',
  effectiveness_review: 'Verificación de eficacia',
  analysis: 'Análisis de calidad',
  fmea_action: 'Acción AMEF',
  project: 'Tarea de proyecto',
  follow_up: 'Seguimiento',
  other: 'Otro',
};

export const TASK_ORIGINS = [
  'manual',
  'project',
  'capa',
  'analysis',
  'document',
  'fmea',
  'other',
] as const;
export type TaskOrigin = (typeof TASK_ORIGINS)[number];
export const TASK_ORIGIN_LABEL: Record<TaskOrigin, string> = {
  manual: 'Manual',
  project: 'Proyecto',
  capa: 'CAPA',
  analysis: 'Análisis',
  document: 'Documento',
  fmea: 'AMEF',
  other: 'Otro',
};

export function isTaskStatus(value: unknown): value is TaskStatus {
  return typeof value === 'string' && (TASK_STATUSES as readonly string[]).includes(value);
}

/** Estados terminales: quedan en solo lectura salvo reapertura autorizada. */
export function isTerminalTask(status: TaskStatus): boolean {
  return status === 'completed' || status === 'cancelled';
}

/** Transiciones normales (no reapertura). La reapertura es aparte y requiere permiso. */
const ALLOWED: Record<TaskStatus, readonly TaskStatus[]> = {
  draft: ['pending', 'cancelled'],
  pending: ['in_progress', 'blocked', 'cancelled'],
  in_progress: ['blocked', 'under_review', 'completed', 'cancelled'],
  blocked: ['in_progress', 'pending', 'cancelled'],
  under_review: ['in_progress', 'completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

/** Reaperturas permitidas solo a owner/admin (validado en servidor). */
const REOPEN: Record<TaskStatus, readonly TaskStatus[]> = {
  draft: [],
  pending: [],
  in_progress: [],
  blocked: [],
  under_review: [],
  completed: ['in_progress'],
  cancelled: ['pending'],
};

export function canTransitionTask(
  from: TaskStatus,
  to: TaskStatus,
  opts?: { reopen?: boolean },
): boolean {
  if (opts?.reopen) return REOPEN[from].includes(to);
  return ALLOWED[from].includes(to);
}

export function isReopenTransition(from: TaskStatus, to: TaskStatus): boolean {
  return REOPEN[from].includes(to);
}

export class InvalidTaskTransitionError extends Error {
  constructor(from: TaskStatus, to: TaskStatus) {
    super(`Transición de tarea no permitida: ${from} → ${to}.`);
    this.name = 'InvalidTaskTransitionError';
  }
}

export function assertTaskTransition(
  from: TaskStatus,
  to: TaskStatus,
  opts?: { reopen?: boolean },
): void {
  if (!canTransitionTask(from, to, opts)) throw new InvalidTaskTransitionError(from, to);
}

/**
 * ¿La tarea puede arrancar (pending→in_progress) considerando dependencias
 * obligatorias? Una dependencia obligatoria no completada bloquea el inicio.
 */
export function isBlockedByDependencies(
  deps: { mandatory: boolean; predecessorStatus: TaskStatus }[],
): boolean {
  return deps.some((d) => d.mandatory && d.predecessorStatus !== 'completed');
}

/** Validaciones de negocio de una transición (motivo/resultado obligatorios). */
export function validateTaskTransition(input: {
  to: TaskStatus;
  reason?: string | null;
  result?: string | null;
  hasEvidence?: boolean;
  requireResultOnComplete?: boolean;
}): string[] {
  const errors: string[] = [];
  if (input.to === 'blocked' && !input.reason?.trim()) {
    errors.push('Indica el motivo del bloqueo.');
  }
  if (input.to === 'cancelled' && !input.reason?.trim()) {
    errors.push('Indica el motivo de la cancelación.');
  }
  if (
    input.to === 'completed' &&
    input.requireResultOnComplete &&
    !input.result?.trim() &&
    !input.hasEvidence
  ) {
    errors.push('Registra un resultado o evidencia para completar la tarea.');
  }
  return errors;
}
