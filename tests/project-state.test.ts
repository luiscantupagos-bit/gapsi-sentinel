import { describe, expect, it } from 'vitest';
import {
  assertProjectTransition,
  canTransitionProject,
  InvalidProjectTransitionError,
  isTerminalProject,
  PROJECT_STATUS_LABEL,
  validateProjectTransition,
} from '@/features/projects/project-state';

describe('project-state — transiciones', () => {
  it('flujo normal draft → planned → active → completed', () => {
    expect(canTransitionProject('draft', 'planned')).toBe(true);
    expect(canTransitionProject('planned', 'active')).toBe(true);
    expect(canTransitionProject('active', 'completed')).toBe(true);
  });

  it('pausar y reanudar', () => {
    expect(canTransitionProject('active', 'on_hold')).toBe(true);
    expect(canTransitionProject('on_hold', 'active')).toBe(true);
  });

  it('rechaza saltos inválidos', () => {
    expect(canTransitionProject('draft', 'completed')).toBe(false);
    expect(() => assertProjectTransition('planned', 'completed')).toThrow(
      InvalidProjectTransitionError,
    );
  });

  it('completed/cancelled terminales; reapertura solo con flag', () => {
    expect(isTerminalProject('completed')).toBe(true);
    expect(canTransitionProject('completed', 'active')).toBe(false);
    expect(canTransitionProject('completed', 'active', { reopen: true })).toBe(true);
  });
});

describe('project-state — guardas', () => {
  it('activar exige responsable y fechas', () => {
    expect(validateProjectTransition({ to: 'active' }).length).toBeGreaterThan(0);
    expect(
      validateProjectTransition({
        to: 'active',
        hasResponsible: true,
        hasStartDate: true,
        hasTargetDate: true,
      }),
    ).toHaveLength(0);
  });

  it('completar con tareas obligatorias abiertas exige justificación', () => {
    expect(validateProjectTransition({ to: 'completed', openMandatoryTasks: 2 })).toHaveLength(1);
    expect(
      validateProjectTransition({ to: 'completed', openMandatoryTasks: 2, justification: 'ok' }),
    ).toHaveLength(0);
    expect(validateProjectTransition({ to: 'completed', openMandatoryTasks: 0 })).toHaveLength(0);
  });

  it('cancelar exige motivo', () => {
    expect(validateProjectTransition({ to: 'cancelled' })).toHaveLength(1);
  });

  it('etiquetas en español', () => {
    expect(PROJECT_STATUS_LABEL.on_hold).toBe('En pausa');
    expect(PROJECT_STATUS_LABEL.active).toBe('Activo');
  });
});
