/**
 * Máquina de estados del PROGRAMA de auditoría (TASK-010). Módulo PURO.
 */

export const PROGRAM_STATUSES = ['draft', 'approved', 'active', 'completed', 'cancelled'] as const;
export type ProgramStatus = (typeof PROGRAM_STATUSES)[number];

export const PROGRAM_STATUS_LABEL: Record<ProgramStatus, string> = {
  draft: 'Borrador',
  approved: 'Aprobado',
  active: 'Activo',
  completed: 'Completado',
  cancelled: 'Cancelado',
};

export const PROGRAM_FREQUENCIES = ['annual', 'semiannual', 'quarterly', 'custom'] as const;
export type ProgramFrequency = (typeof PROGRAM_FREQUENCIES)[number];
export const PROGRAM_FREQUENCY_LABEL: Record<ProgramFrequency, string> = {
  annual: 'Anual',
  semiannual: 'Semestral',
  quarterly: 'Trimestral',
  custom: 'Personalizado',
};

export function isTerminalProgram(s: ProgramStatus): boolean {
  return s === 'completed' || s === 'cancelled';
}

const ALLOWED: Record<ProgramStatus, readonly ProgramStatus[]> = {
  draft: ['approved', 'cancelled'],
  approved: ['active', 'cancelled'],
  active: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};
const REOPEN: Record<ProgramStatus, readonly ProgramStatus[]> = {
  draft: [],
  approved: [],
  active: [],
  completed: ['active'],
  cancelled: ['draft'],
};

export function canTransitionProgram(
  from: ProgramStatus,
  to: ProgramStatus,
  opts?: { reopen?: boolean },
): boolean {
  if (opts?.reopen) return REOPEN[from].includes(to);
  return ALLOWED[from].includes(to);
}
export function isProgramReopen(from: ProgramStatus, to: ProgramStatus): boolean {
  return REOPEN[from].includes(to);
}

export class InvalidProgramTransitionError extends Error {
  constructor(from: ProgramStatus, to: ProgramStatus) {
    super(`Transición de programa no permitida: ${from} → ${to}.`);
    this.name = 'InvalidProgramTransitionError';
  }
}
export function assertProgramTransition(
  from: ProgramStatus,
  to: ProgramStatus,
  opts?: { reopen?: boolean },
): void {
  if (!canTransitionProgram(from, to, opts)) throw new InvalidProgramTransitionError(from, to);
}

export function validateProgramTransition(input: {
  to: ProgramStatus;
  reason?: string | null;
}): string[] {
  const errors: string[] = [];
  if (input.to === 'cancelled' && !input.reason?.trim()) {
    errors.push('Indica el motivo de la cancelación.');
  }
  return errors;
}
