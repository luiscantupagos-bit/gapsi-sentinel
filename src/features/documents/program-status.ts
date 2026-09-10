/**
 * Derivación del estado OPERATIVO de una ocurrencia de Programa (DOC-003 §8/§9).
 * PURO. El estado se deriva de la TAREA vinculada (fuente de verdad), la fecha de
 * vencimiento y el estado de la propia instancia (superseded/cancelled). La vista
 * NO mantiene estado paralelo; solo lo interpreta.
 */
export type ExecutionStatus =
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'overdue'
  | 'cancelled'
  | 'superseded';

export const EXECUTION_STATUS_LABEL: Record<ExecutionStatus, string> = {
  scheduled: 'Programada',
  in_progress: 'En curso',
  completed: 'Completada',
  overdue: 'Vencida',
  cancelled: 'Cancelada',
  superseded: 'Sustituida',
};

/**
 * Deriva el estado visible de una ocurrencia. Prioridad:
 *  1) instancia superseded/cancelled;
 *  2) tarea completed/cancelled;
 *  3) tarea en curso (in_progress/blocked/under_review);
 *  4) vencida si `dueAt < now` y la tarea no es terminal (§9);
 *  5) programada.
 */
export function deriveExecutionStatus(
  instanceStatus: string,
  taskStatus: string | null,
  dueAt: string | null,
  now: string,
): ExecutionStatus {
  if (instanceStatus === 'superseded') return 'superseded';
  if (instanceStatus === 'cancelled') return 'cancelled';
  if (taskStatus === 'completed') return 'completed';
  if (taskStatus === 'cancelled') return 'cancelled';
  if (taskStatus === 'in_progress' || taskStatus === 'blocked' || taskStatus === 'under_review') {
    return 'in_progress';
  }
  if (dueAt && dueAt.slice(0, 10) < now.slice(0, 10)) return 'overdue';
  return 'scheduled';
}

/** ¿La ocurrencia cuenta para el progreso? Excluye cancelled/superseded (§6). */
export function countsForProgress(status: ExecutionStatus): boolean {
  return status !== 'cancelled' && status !== 'superseded';
}

export interface ExecutionSummary {
  total: number;
  completed: number;
  pending: number;
  overdue: number;
  dueSoon30: number;
}

export interface ExecutionProgress {
  completed: number;
  total: number;
  percent: number;
}

/** Días entre dos fechas ISO (b - a) en días UTC. */
function daysBetween(aIso: string, bIso: string): number {
  const a = Date.parse(`${aIso.slice(0, 10)}T00:00:00Z`);
  const b = Date.parse(`${bIso.slice(0, 10)}T00:00:00Z`);
  return Math.round((b - a) / 86400000);
}

export interface ExecutionRowLike {
  status: ExecutionStatus;
  dueAt: string | null;
}

/** Resumen operativo (§5): total ejecutables, completadas, pendientes, vencidas, próximas 30 días. */
export function executionSummary(rows: ExecutionRowLike[], now: string): ExecutionSummary {
  let total = 0;
  let completed = 0;
  let pending = 0;
  let overdue = 0;
  let dueSoon30 = 0;
  for (const r of rows) {
    if (!countsForProgress(r.status)) continue;
    total += 1;
    if (r.status === 'completed') completed += 1;
    else if (r.status === 'overdue') overdue += 1;
    else pending += 1; // scheduled | in_progress
    if (
      (r.status === 'scheduled' || r.status === 'in_progress') &&
      r.dueAt &&
      daysBetween(now, r.dueAt) >= 0 &&
      daysBetween(now, r.dueAt) <= 30
    ) {
      dueSoon30 += 1;
    }
  }
  return { total, completed, pending, overdue, dueSoon30 };
}

/** Progreso = completadas / total ejecutable (excluye cancelled/superseded, §6). */
export function executionProgress(rows: ExecutionRowLike[]): ExecutionProgress {
  const counting = rows.filter((r) => countsForProgress(r.status));
  const total = counting.length;
  const completed = counting.filter((r) => r.status === 'completed').length;
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
  return { completed, total, percent };
}
