import { describe, expect, it } from 'vitest';
import {
  deriveExecutionStatus,
  executionSummary,
  executionProgress,
  EXECUTION_STATUS_LABEL,
  type ExecutionRowLike,
} from '@/features/documents/program-status';

const NOW = '2026-10-10';

describe('deriveExecutionStatus (§8/§9)', () => {
  it('instancia superseded/cancelled tiene prioridad', () => {
    expect(deriveExecutionStatus('superseded', 'pending', '2026-10-15', NOW)).toBe('superseded');
    expect(deriveExecutionStatus('cancelled', 'in_progress', '2026-10-15', NOW)).toBe('cancelled');
  });

  it('deriva del estado de la Tarea', () => {
    expect(deriveExecutionStatus('scheduled', 'completed', '2026-10-15', NOW)).toBe('completed');
    expect(deriveExecutionStatus('scheduled', 'cancelled', '2026-10-15', NOW)).toBe('cancelled');
    expect(deriveExecutionStatus('scheduled', 'in_progress', '2026-10-15', NOW)).toBe(
      'in_progress',
    );
    expect(deriveExecutionStatus('scheduled', 'blocked', '2026-10-15', NOW)).toBe('in_progress');
  });

  it('vencida si dueAt < hoy y la tarea no es terminal (§9)', () => {
    expect(deriveExecutionStatus('scheduled', 'pending', '2026-10-05', NOW)).toBe('overdue');
    // Completada no se vuelve vencida.
    expect(deriveExecutionStatus('scheduled', 'completed', '2026-10-05', NOW)).toBe('completed');
  });

  it('programada por defecto (futuro, pendiente)', () => {
    expect(deriveExecutionStatus('scheduled', 'pending', '2026-10-20', NOW)).toBe('scheduled');
  });

  it('etiquetas en español', () => {
    expect(EXECUTION_STATUS_LABEL.scheduled).toBe('Programada');
    expect(EXECUTION_STATUS_LABEL.overdue).toBe('Vencida');
    expect(EXECUTION_STATUS_LABEL.superseded).toBe('Sustituida');
  });
});

describe('executionSummary / executionProgress (§5/§6)', () => {
  const rows: ExecutionRowLike[] = [
    { status: 'completed', dueAt: '2026-09-01' },
    { status: 'completed', dueAt: '2026-09-15' },
    { status: 'overdue', dueAt: '2026-10-05' },
    { status: 'scheduled', dueAt: '2026-10-20' }, // próxima 30 días
    { status: 'in_progress', dueAt: '2026-12-31' }, // fuera de 30 días
    { status: 'cancelled', dueAt: '2026-10-01' }, // excluida
    { status: 'superseded', dueAt: '2026-10-01' }, // excluida
  ];

  it('resumen cuenta ejecutables reales y excluye cancelled/superseded', () => {
    const s = executionSummary(rows, NOW);
    expect(s.total).toBe(5); // 2 completed + 1 overdue + 1 scheduled + 1 in_progress
    expect(s.completed).toBe(2);
    expect(s.overdue).toBe(1);
    expect(s.pending).toBe(2);
    expect(s.dueSoon30).toBe(1); // solo la del 2026-10-20
  });

  it('progreso = completadas / total ejecutable', () => {
    const p = executionProgress(rows);
    expect(p.total).toBe(5);
    expect(p.completed).toBe(2);
    expect(p.percent).toBe(40);
  });

  it('progreso 0 sin ejecutables', () => {
    expect(executionProgress([{ status: 'cancelled', dueAt: null }]).percent).toBe(0);
  });
});
