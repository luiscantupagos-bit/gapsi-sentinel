/**
 * Máquina de estados del diagnóstico (dominio puro, sin BD ni UI).
 *
 * Estados y transiciones aprobados en TASK-002-DATA-MODEL-PROPOSAL.md. NO
 * implementa el motor de puntuación; solo valida transiciones y la reapertura.
 */

export const DIAGNOSTIC_STATUSES = [
  'draft',
  'in_progress',
  'submitted',
  'reviewed',
  'archived',
] as const;

export type DiagnosticStatus = (typeof DIAGNOSTIC_STATUSES)[number];

export function isDiagnosticStatus(value: unknown): value is DiagnosticStatus {
  return typeof value === 'string' && (DIAGNOSTIC_STATUSES as readonly string[]).includes(value);
}

/** Transiciones permitidas: estado origen → estados destino válidos. */
const ALLOWED_TRANSITIONS: Record<DiagnosticStatus, readonly DiagnosticStatus[]> = {
  draft: ['in_progress', 'archived'],
  in_progress: ['submitted', 'archived'],
  submitted: ['reviewed', 'in_progress'], // in_progress = reapertura
  reviewed: ['in_progress', 'archived'], // in_progress = reapertura
  archived: [],
};

/** Una reapertura es volver a `in_progress` desde `submitted` o `reviewed`. */
export function isReopen(from: DiagnosticStatus, to: DiagnosticStatus): boolean {
  return (from === 'submitted' || from === 'reviewed') && to === 'in_progress';
}

export function canTransition(from: DiagnosticStatus, to: DiagnosticStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export class InvalidTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidTransitionError';
  }
}

export interface TransitionContext {
  /** Usuario que realiza la transición (obligatorio para reaperturas). */
  actorUserId?: string;
  /** Motivo (obligatorio para reaperturas). */
  reason?: string;
}

/**
 * Valida una transición. Lanza `InvalidTransitionError` si no está permitida o
 * si es una reapertura sin usuario y motivo (autorización).
 *
 * Devuelve `{ invalidatesResult }` para que la capa de datos sepa que debe
 * invalidar el resultado vigente al reabrir (la invalidación en sí la hace la
 * capa de persistencia; aquí no hay BD).
 */
export function assertTransition(
  from: DiagnosticStatus,
  to: DiagnosticStatus,
  context: TransitionContext = {},
): { invalidatesResult: boolean } {
  if (!canTransition(from, to)) {
    throw new InvalidTransitionError(`Transición no permitida: ${from} → ${to}.`);
  }

  if (isReopen(from, to)) {
    if (!context.actorUserId || !context.reason || context.reason.trim() === '') {
      throw new InvalidTransitionError(
        'La reapertura requiere autorización: usuario y motivo son obligatorios.',
      );
    }
    return { invalidatesResult: true };
  }

  return { invalidatesResult: false };
}
