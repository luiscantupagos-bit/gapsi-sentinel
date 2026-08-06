import { describe, expect, it } from 'vitest';
import {
  assertTaskTransition,
  canTransitionTask,
  InvalidTaskTransitionError,
  isBlockedByDependencies,
  isReopenTransition,
  isTerminalTask,
  validateTaskTransition,
  TASK_STATUS_LABEL,
} from '@/features/tasks/task-state';

describe('task-state — transiciones', () => {
  it('permite el flujo normal pending → in_progress → under_review → completed', () => {
    expect(canTransitionTask('pending', 'in_progress')).toBe(true);
    expect(canTransitionTask('in_progress', 'under_review')).toBe(true);
    expect(canTransitionTask('under_review', 'completed')).toBe(true);
  });

  it('rechaza saltos arbitrarios', () => {
    expect(canTransitionTask('pending', 'completed')).toBe(false);
    expect(canTransitionTask('draft', 'in_progress')).toBe(false);
    expect(() => assertTaskTransition('pending', 'completed')).toThrow(InvalidTaskTransitionError);
  });

  it('completed y cancelled son terminales (solo lectura salvo reapertura)', () => {
    expect(isTerminalTask('completed')).toBe(true);
    expect(isTerminalTask('cancelled')).toBe(true);
    expect(canTransitionTask('completed', 'in_progress')).toBe(false);
    // Reapertura autorizada:
    expect(canTransitionTask('completed', 'in_progress', { reopen: true })).toBe(true);
    expect(isReopenTransition('cancelled', 'pending')).toBe(true);
  });

  it('bloquear y desbloquear', () => {
    expect(canTransitionTask('in_progress', 'blocked')).toBe(true);
    expect(canTransitionTask('blocked', 'in_progress')).toBe(true);
  });
});

describe('task-state — guardas de negocio', () => {
  it('bloquear exige motivo', () => {
    expect(validateTaskTransition({ to: 'blocked' })).toContain('Indica el motivo del bloqueo.');
    expect(validateTaskTransition({ to: 'blocked', reason: 'Falta insumo' })).toHaveLength(0);
  });

  it('cancelar exige motivo', () => {
    expect(validateTaskTransition({ to: 'cancelled' })).toHaveLength(1);
    expect(validateTaskTransition({ to: 'cancelled', reason: 'Duplicada' })).toHaveLength(0);
  });

  it('completar exige resultado o evidencia cuando el origen lo requiere', () => {
    expect(validateTaskTransition({ to: 'completed', requireResultOnComplete: true })).toHaveLength(
      1,
    );
    expect(
      validateTaskTransition({ to: 'completed', requireResultOnComplete: true, result: 'Hecho' }),
    ).toHaveLength(0);
    expect(
      validateTaskTransition({ to: 'completed', requireResultOnComplete: true, hasEvidence: true }),
    ).toHaveLength(0);
    // Sin requisito de resultado, completar no exige nada.
    expect(validateTaskTransition({ to: 'completed' })).toHaveLength(0);
  });
});

describe('task-state — dependencias', () => {
  it('una dependencia obligatoria no completada bloquea el inicio', () => {
    expect(isBlockedByDependencies([{ mandatory: true, predecessorStatus: 'in_progress' }])).toBe(
      true,
    );
    expect(isBlockedByDependencies([{ mandatory: true, predecessorStatus: 'completed' }])).toBe(
      false,
    );
    // Informativa no bloquea.
    expect(isBlockedByDependencies([{ mandatory: false, predecessorStatus: 'pending' }])).toBe(
      false,
    );
  });
});

describe('task-state — etiquetas', () => {
  it('todas las etiquetas están en español', () => {
    expect(TASK_STATUS_LABEL.in_progress).toBe('En progreso');
    expect(TASK_STATUS_LABEL.blocked).toBe('Bloqueada');
  });
});
