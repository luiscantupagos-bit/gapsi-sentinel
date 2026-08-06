/**
 * Máquina de estados de proyectos (TASK-009). Módulo PURO, cubierto por pruebas.
 * Define transiciones, etiquetas en español, tipos, prioridades y estados de hito.
 */

export const PROJECT_STATUSES = [
  'draft',
  'planned',
  'active',
  'on_hold',
  'under_review',
  'completed',
  'cancelled',
] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  draft: 'Borrador',
  planned: 'Planeado',
  active: 'Activo',
  on_hold: 'En pausa',
  under_review: 'En revisión',
  completed: 'Completado',
  cancelled: 'Cancelado',
};

export const PROJECT_TYPES = [
  'continuous_improvement',
  'capa',
  'implementation',
  'compliance',
  'certification',
  'infrastructure',
  'training',
  'risk_reduction',
  'documentation',
  'other',
] as const;
export type ProjectType = (typeof PROJECT_TYPES)[number];
export const PROJECT_TYPE_LABEL: Record<ProjectType, string> = {
  continuous_improvement: 'Mejora continua',
  capa: 'CAPA',
  implementation: 'Implementación',
  compliance: 'Cumplimiento',
  certification: 'Certificación',
  infrastructure: 'Infraestructura',
  training: 'Capacitación',
  risk_reduction: 'Reducción de riesgos',
  documentation: 'Desarrollo documental',
  other: 'Otro',
};

export const PROJECT_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;
export type ProjectPriority = (typeof PROJECT_PRIORITIES)[number];
export const PROJECT_PRIORITY_LABEL: Record<ProjectPriority, string> = {
  low: 'Baja',
  normal: 'Normal',
  high: 'Alta',
  urgent: 'Urgente',
};

export const MILESTONE_STATUSES = [
  'pending',
  'at_risk',
  'reached',
  'overdue',
  'cancelled',
] as const;
export type MilestoneStatus = (typeof MILESTONE_STATUSES)[number];
export const MILESTONE_STATUS_LABEL: Record<MilestoneStatus, string> = {
  pending: 'Pendiente',
  at_risk: 'En riesgo',
  reached: 'Alcanzado',
  overdue: 'Vencido',
  cancelled: 'Cancelado',
};

export function isProjectStatus(value: unknown): value is ProjectStatus {
  return typeof value === 'string' && (PROJECT_STATUSES as readonly string[]).includes(value);
}

export function isTerminalProject(status: ProjectStatus): boolean {
  return status === 'completed' || status === 'cancelled';
}

const ALLOWED: Record<ProjectStatus, readonly ProjectStatus[]> = {
  draft: ['planned', 'active', 'cancelled'],
  planned: ['active', 'on_hold', 'cancelled'],
  active: ['on_hold', 'under_review', 'completed', 'cancelled'],
  on_hold: ['active', 'cancelled'],
  under_review: ['active', 'completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

const REOPEN: Record<ProjectStatus, readonly ProjectStatus[]> = {
  draft: [],
  planned: [],
  active: [],
  on_hold: [],
  under_review: [],
  completed: ['active'],
  cancelled: ['planned'],
};

export function canTransitionProject(
  from: ProjectStatus,
  to: ProjectStatus,
  opts?: { reopen?: boolean },
): boolean {
  if (opts?.reopen) return REOPEN[from].includes(to);
  return ALLOWED[from].includes(to);
}

export function isProjectReopen(from: ProjectStatus, to: ProjectStatus): boolean {
  return REOPEN[from].includes(to);
}

export class InvalidProjectTransitionError extends Error {
  constructor(from: ProjectStatus, to: ProjectStatus) {
    super(`Transición de proyecto no permitida: ${from} → ${to}.`);
    this.name = 'InvalidProjectTransitionError';
  }
}

export function assertProjectTransition(
  from: ProjectStatus,
  to: ProjectStatus,
  opts?: { reopen?: boolean },
): void {
  if (!canTransitionProject(from, to, opts)) throw new InvalidProjectTransitionError(from, to);
}

/**
 * Validaciones de negocio de una transición de proyecto.
 * - activar requiere responsable y fechas;
 * - completar requiere tareas obligatorias cerradas o justificación;
 * - cancelar requiere motivo.
 */
export function validateProjectTransition(input: {
  to: ProjectStatus;
  hasResponsible?: boolean;
  hasStartDate?: boolean;
  hasTargetDate?: boolean;
  openMandatoryTasks?: number;
  justification?: string | null;
  reason?: string | null;
}): string[] {
  const errors: string[] = [];
  if (input.to === 'active') {
    if (!input.hasResponsible) errors.push('Asigna un responsable antes de activar el proyecto.');
    if (!input.hasStartDate || !input.hasTargetDate) {
      errors.push('Define fecha de inicio y fecha objetivo antes de activar.');
    }
  }
  if (
    input.to === 'completed' &&
    (input.openMandatoryTasks ?? 0) > 0 &&
    !input.justification?.trim()
  ) {
    errors.push('Cierra las tareas obligatorias o registra una justificación para completar.');
  }
  if (input.to === 'cancelled' && !input.reason?.trim()) {
    errors.push('Indica el motivo de la cancelación.');
  }
  return errors;
}
