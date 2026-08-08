/**
 * Máquina de estados del control documental (TASK-006). Módulo PURO y central,
 * cubierto por pruebas. Define las transiciones válidas del ciclo de vida de una
 * VERSIÓN documental. No permite saltos arbitrarios.
 */

export const VERSION_STATUSES = [
  'draft',
  'in_review',
  'changes_requested',
  'in_approval',
  'approved',
  'published',
  'obsolete',
  'archived',
] as const;

export type VersionStatus = (typeof VERSION_STATUSES)[number];

export const VERSION_STATUS_LABEL: Record<VersionStatus, string> = {
  draft: 'Borrador',
  in_review: 'En revisión',
  changes_requested: 'Cambios solicitados',
  in_approval: 'En aprobación',
  approved: 'Aprobado',
  published: 'Vigente',
  obsolete: 'Obsoleto',
  archived: 'Archivado',
};

export function isVersionStatus(value: unknown): value is VersionStatus {
  return typeof value === 'string' && (VERSION_STATUSES as readonly string[]).includes(value);
}

/** Solo estas versiones se pueden editar. */
export function isEditableStatus(status: VersionStatus): boolean {
  return status === 'draft' || status === 'changes_requested';
}

const ALLOWED: Record<VersionStatus, readonly VersionStatus[]> = {
  draft: ['in_review', 'archived'],
  changes_requested: ['in_review', 'archived'],
  in_review: ['in_approval', 'changes_requested'],
  in_approval: ['approved', 'changes_requested'],
  approved: ['published', 'changes_requested'],
  published: ['obsolete', 'archived'],
  obsolete: ['archived'],
  archived: [],
};

export function canTransitionVersion(from: VersionStatus, to: VersionStatus): boolean {
  return ALLOWED[from].includes(to);
}

export class InvalidVersionTransitionError extends Error {
  constructor(from: VersionStatus, to: VersionStatus) {
    super(`Transición de versión no permitida: ${from} → ${to}.`);
    this.name = 'InvalidVersionTransitionError';
  }
}

export function assertVersionTransition(from: VersionStatus, to: VersionStatus): void {
  if (!canTransitionVersion(from, to)) {
    throw new InvalidVersionTransitionError(from, to);
  }
}

// --- Estados de asignación (revisor/aprobador) ---
export const ASSIGNMENT_STATUSES = [
  'pending',
  'approved',
  'changes_requested',
  'rejected',
  'cancelled',
] as const;
export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];

export const ASSIGNMENT_ROLES = ['reviewer', 'approver'] as const;
export type AssignmentRole = (typeof ASSIGNMENT_ROLES)[number];

/** Etiquetas humanas (es-MX) para presentar estados del control documental. */
export const ASSIGNMENT_STATUS_LABEL: Record<string, string> = {
  pending: 'Pendiente',
  approved: 'Aprobada',
  changes_requested: 'Cambios solicitados',
  rejected: 'Rechazada',
  cancelled: 'Cancelada',
};

export const APPROVAL_DECISION_LABEL: Record<string, string> = {
  pending: 'Pendiente',
  approved: 'Aprobada',
  changes_requested: 'Cambios solicitados',
  rejected: 'Rechazada',
};

export const ASSIGNMENT_ROLE_LABEL: Record<string, string> = {
  reviewer: 'Revisor',
  approver: 'Aprobador',
};

export const DISTRIBUTION_TARGET_LABEL: Record<string, string> = {
  user: 'Usuario',
  role: 'Rol',
  organization: 'Organización',
  site: 'Sitio',
};

export const DISTRIBUTION_STATUS_LABEL: Record<string, string> = {
  active: 'Activa',
  superseded: 'Reemplazada',
};

export const COPY_STATUS_LABEL: Record<string, string> = {
  active: 'Activa',
  pending_recovery: 'Pendiente de recuperación',
  recovered: 'Recuperada',
  destroyed: 'Destruida',
  replaced: 'Reemplazada',
};
