/**
 * HACCP-005 — helpers PUROS de validación de medidas de control. §43.
 */
import { describe, expect, it } from 'vitest';
import {
  HACCP_VALIDATION_STATUS_LABEL,
  HACCP_VALIDATION_RESULT_LABEL,
  validationMethodLabel,
  validateSatisfactory,
  deriveValidationStatus,
  validationCompleteness,
  validationStatusLabel,
  validationResultLabel,
} from '@/features/haccp/haccp-validation';

describe('estados y resultados (§5/§6)', () => {
  it('status en español (separado del resultado)', () => {
    expect(HACCP_VALIDATION_STATUS_LABEL.satisfactory).toBe('Satisfactoria');
    expect(HACCP_VALIDATION_STATUS_LABEL.needs_review).toBe('Revisión requerida');
    expect(validationStatusLabel('expired')).toBe('Vencida');
  });
  it('resultado técnico en español', () => {
    expect(HACCP_VALIDATION_RESULT_LABEL.inconclusive).toBe('No concluyente');
    expect(validationResultLabel('satisfactory')).toBe('Satisfactorio');
    expect(validationResultLabel(null)).toBe('—');
  });
  it('métodos en español', () => {
    expect(validationMethodLabel('plant_trial')).toBe('Prueba en planta');
    expect(validationMethodLabel(null)).toBe('—');
  });
});

const complete = {
  objective: 'Demostrar capacidad',
  methodType: 'literature',
  evidenceSummary: 'Estudio X',
  acceptanceCriteria: 'Reducción esperada',
  conclusion: 'La medida es capaz',
  performedAt: '2026-09-01',
  performedByUserId: 'u1',
};

describe('requisitos de «Satisfactoria» (§13)', () => {
  it('sin errores cuando están los requisitos mínimos', () => {
    expect(validateSatisfactory(complete)).toEqual([]);
  });
  it('exige objetivo, método, evidencia/fundamento, criterio, conclusión, fecha y actor', () => {
    expect(validateSatisfactory({ ...complete, objective: '' }).length).toBe(1);
    expect(validateSatisfactory({ ...complete, acceptanceCriteria: null }).length).toBe(1);
    expect(
      validateSatisfactory({ ...complete, performedByUserId: null, performedByExternalName: null })
        .length,
    ).toBe(1);
    // evidencia o fundamento: basta uno
    expect(
      validateSatisfactory({ ...complete, evidenceSummary: null, technicalBasis: 'base' }),
    ).toEqual([]);
  });
});

describe('derivación de status (§6/§14/§15)', () => {
  it('satisfactorio + requisitos → satisfactory', () => {
    expect(deriveValidationStatus('satisfactory', complete)).toBe('satisfactory');
  });
  it('satisfactorio SIN requisitos → in_progress (no se marca satisfactoria)', () => {
    expect(deriveValidationStatus('satisfactory', { objective: 'x' })).toBe('in_progress');
  });
  it('no satisfactorio → unsatisfactory; no concluyente → needs_review', () => {
    expect(deriveValidationStatus('unsatisfactory', complete)).toBe('unsatisfactory');
    expect(deriveValidationStatus('inconclusive', complete)).toBe('needs_review');
  });
  it('sin resultado → in_progress', () => {
    expect(deriveValidationStatus(null, {})).toBe('in_progress');
  });
});

describe('completitud (§34)', () => {
  it('cuenta requeridas/satisfactorias/pendientes/revisión', () => {
    const c = validationCompleteness({
      controlsRequiringValidation: 2,
      satisfactory: 0,
      pending: 2,
      needsReview: 0,
    });
    expect(c.required).toBe(2);
    expect(c.pending).toBe(2);
  });
});
