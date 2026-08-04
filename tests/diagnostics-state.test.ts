import { describe, expect, it } from 'vitest';
import {
  assertTransition,
  canTransition,
  DIAGNOSTIC_STATUSES,
  InvalidTransitionError,
  isDiagnosticStatus,
  isReopen,
} from '@/features/diagnostics/state';

describe('estados del diagnóstico', () => {
  it('define exactamente los estados aprobados', () => {
    expect([...DIAGNOSTIC_STATUSES]).toEqual([
      'draft',
      'in_progress',
      'submitted',
      'reviewed',
      'archived',
    ]);
  });

  it('reconoce estados válidos e inválidos', () => {
    expect(isDiagnosticStatus('draft')).toBe(true);
    expect(isDiagnosticStatus('unknown')).toBe(false);
  });
});

describe('transiciones', () => {
  it('permite las transiciones del flujo normal', () => {
    expect(canTransition('draft', 'in_progress')).toBe(true);
    expect(canTransition('in_progress', 'submitted')).toBe(true);
    expect(canTransition('submitted', 'reviewed')).toBe(true);
    expect(canTransition('reviewed', 'archived')).toBe(true);
  });

  it('rechaza transiciones inválidas', () => {
    expect(canTransition('draft', 'submitted')).toBe(false);
    expect(canTransition('archived', 'in_progress')).toBe(false);
    expect(canTransition('reviewed', 'submitted')).toBe(false);
  });

  it('assertTransition lanza en transiciones no permitidas', () => {
    expect(() => assertTransition('draft', 'reviewed')).toThrow(InvalidTransitionError);
  });

  it('no marca invalidación de resultado en transiciones normales', () => {
    expect(assertTransition('in_progress', 'submitted')).toEqual({ invalidatesResult: false });
  });
});

describe('reapertura', () => {
  it('identifica reaperturas', () => {
    expect(isReopen('submitted', 'in_progress')).toBe(true);
    expect(isReopen('reviewed', 'in_progress')).toBe(true);
    expect(isReopen('draft', 'in_progress')).toBe(false);
  });

  it('exige usuario y motivo para reabrir (autorización)', () => {
    expect(() => assertTransition('reviewed', 'in_progress')).toThrow(/requiere autorización/i);
    expect(() => assertTransition('reviewed', 'in_progress', { actorUserId: 'u1' })).toThrow(
      InvalidTransitionError,
    );
    expect(() => assertTransition('reviewed', 'in_progress', { reason: '   ' })).toThrow(
      InvalidTransitionError,
    );
  });

  it('permite reabrir con usuario y motivo, e indica invalidar el resultado', () => {
    expect(
      assertTransition('reviewed', 'in_progress', {
        actorUserId: 'u1',
        reason: 'Corrección de evidencia',
      }),
    ).toEqual({ invalidatesResult: true });
  });
});
