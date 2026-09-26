/**
 * HACCP-004 — helpers PUROS de selección de medidas de control (árbol de decisión, resolver,
 * completitud del plan). §46.
 */
import { describe, expect, it } from 'vitest';
import {
  HACCP_CLASSIFICATION_LABEL,
  DEFAULT_DECISION_TREE,
  resolveClassification,
  isControlPlanComplete,
  controlMeasureCompleteness,
  classificationLabel,
} from '@/features/haccp/haccp-control';

describe('clasificación y etiquetas', () => {
  it('labels en español', () => {
    expect(HACCP_CLASSIFICATION_LABEL.pcc).toContain('PCC');
    expect(HACCP_CLASSIFICATION_LABEL.ppro).toContain('PPRO');
    expect(HACCP_CLASSIFICATION_LABEL.ppr).toContain('PPR');
    expect(classificationLabel('review_required')).toBe('Revisión requerida');
  });
});

describe('resolver del árbol de decisión (§7/§21)', () => {
  const t = DEFAULT_DECISION_TREE;
  it('P1 No → PPR', () => {
    const r = resolveClassification(t, [{ questionId: 'P1', answer: 'no' }]);
    expect(r.classification).toBe('ppr');
    expect(r.path).toHaveLength(1);
  });
  it('P1 Sí, P2 No → PPRO', () => {
    const r = resolveClassification(t, [
      { questionId: 'P1', answer: 'yes' },
      { questionId: 'P2', answer: 'no' },
    ]);
    expect(r.classification).toBe('ppro');
  });
  it('P1 Sí, P2 Sí, P3 Sí → PCC', () => {
    const r = resolveClassification(t, [
      { questionId: 'P1', answer: 'yes' },
      { questionId: 'P2', answer: 'yes' },
      { questionId: 'P3', answer: 'yes' },
    ]);
    expect(r.classification).toBe('pcc');
  });
  it('P1 Sí, P2 Sí, P3 No → PPRO', () => {
    const r = resolveClassification(t, [
      { questionId: 'P1', answer: 'yes' },
      { questionId: 'P2', answer: 'yes' },
      { questionId: 'P3', answer: 'no' },
    ]);
    expect(r.classification).toBe('ppro');
  });
  it('P1 N.A. → revisión requerida', () => {
    const r = resolveClassification(t, [{ questionId: 'P1', answer: 'na' }]);
    expect(r.classification).toBe('review_required');
  });
  it('incompleto → nextQuestionId', () => {
    const r = resolveClassification(t, [{ questionId: 'P1', answer: 'yes' }]);
    expect(r.classification).toBeNull();
    expect(r.nextQuestionId).toBe('P2');
  });
});

describe('completitud del plan (§12/§23)', () => {
  const full = {
    controlMeasure: 'x',
    criticalLimit: 'x',
    actionCriterion: 'x',
    monitoringWhat: 'x',
    monitoringHow: 'x',
    monitoringWho: 'x',
    monitoringWhen: 'x',
    correctiveAction: 'x',
  };
  it('PCC requiere límite crítico + monitoreo + acción correctiva', () => {
    expect(isControlPlanComplete('pcc', full)).toBe(true);
    expect(isControlPlanComplete('pcc', { ...full, criticalLimit: null })).toBe(false);
  });
  it('PPRO requiere criterio de acción (no límite crítico)', () => {
    expect(isControlPlanComplete('ppro', { ...full, criticalLimit: null })).toBe(true);
    expect(isControlPlanComplete('ppro', { ...full, actionCriterion: null })).toBe(false);
  });
  it('PPR requiere medida o registro relacionado', () => {
    expect(isControlPlanComplete('ppr', { controlMeasure: 'x' })).toBe(true);
    expect(isControlPlanComplete('ppr', { recordReference: 'doc' })).toBe(true);
    expect(isControlPlanComplete('ppr', {})).toBe(false);
  });
});

describe('completitud global (§24)', () => {
  it('cuenta significativos/evaluados/pendientes/clasificaciones', () => {
    const c = controlMeasureCompleteness({
      significantHazards: 4,
      evaluated: 1,
      pcc: 0,
      ppro: 1,
      ppr: 0,
      incompletePlans: 0,
    });
    expect(c.pending).toBe(3);
    expect(c.ppro).toBe(1);
  });
});
