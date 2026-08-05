/**
 * Pruebas de la máquina de estados de CAPA (TASK-007). Módulo puro, sin BD.
 */
import { describe, expect, it } from 'vitest';
import {
  CAPA_STATUSES,
  CAPA_STATUS_LABEL,
  InvalidCapaTransitionError,
  assertCapaTransition,
  canReopenTo,
  canTransitionCapa,
  isCapaStatus,
  isLogicallyDeletable,
  isTerminalStatus,
} from '@/features/capa/capa-state';

describe('máquina de estados CAPA', () => {
  it('cada estado tiene etiqueta en español', () => {
    for (const s of CAPA_STATUSES) {
      expect(CAPA_STATUS_LABEL[s]).toBeTruthy();
    }
  });

  it('permite el avance secuencial del ciclo', () => {
    expect(canTransitionCapa('draft', 'reported')).toBe(true);
    expect(canTransitionCapa('reported', 'containment')).toBe(true);
    expect(canTransitionCapa('containment', 'under_investigation')).toBe(true);
    expect(canTransitionCapa('under_investigation', 'action_plan')).toBe(true);
    expect(canTransitionCapa('action_plan', 'in_implementation')).toBe(true);
    expect(canTransitionCapa('in_implementation', 'effectiveness_review')).toBe(true);
    expect(canTransitionCapa('effectiveness_review', 'closed')).toBe(true);
  });

  it('rechaza saltos arbitrarios', () => {
    expect(canTransitionCapa('draft', 'closed')).toBe(false);
    expect(canTransitionCapa('reported', 'action_plan')).toBe(false);
    expect(canTransitionCapa('under_investigation', 'closed')).toBe(false);
    expect(() => assertCapaTransition('draft', 'in_implementation')).toThrow(
      InvalidCapaTransitionError,
    );
  });

  it('eficacia no satisfactoria vuelve al plan de acciones', () => {
    expect(canTransitionCapa('effectiveness_review', 'action_plan')).toBe(true);
  });

  it('permite cancelar desde estados tempranos pero no desde eficacia/cerrada', () => {
    expect(canTransitionCapa('draft', 'cancelled')).toBe(true);
    expect(canTransitionCapa('in_implementation', 'cancelled')).toBe(true);
    expect(canTransitionCapa('effectiveness_review', 'cancelled')).toBe(false);
    expect(canTransitionCapa('closed', 'cancelled')).toBe(false);
  });

  it('estados terminales no avanzan', () => {
    expect(isTerminalStatus('closed')).toBe(true);
    expect(isTerminalStatus('cancelled')).toBe(true);
    expect(canTransitionCapa('closed', 'action_plan')).toBe(false);
    expect(canTransitionCapa('cancelled', 'draft')).toBe(false);
  });

  it('la reapertura solo apunta a investigación o plan de acciones', () => {
    expect(canReopenTo('under_investigation')).toBe(true);
    expect(canReopenTo('action_plan')).toBe(true);
    expect(canReopenTo('draft')).toBe(false);
    expect(canReopenTo('closed')).toBe(false);
  });

  it('solo el borrador es eliminable lógicamente', () => {
    expect(isLogicallyDeletable('draft')).toBe(true);
    expect(isLogicallyDeletable('reported')).toBe(false);
  });

  it('valida pertenencia de estado', () => {
    expect(isCapaStatus('closed')).toBe(true);
    expect(isCapaStatus('nope')).toBe(false);
  });
});
